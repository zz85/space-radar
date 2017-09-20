'use strict'

function SunBurst() {
  function onResize() {
    log('resize')
    calcDimensions()
    svg_container
      .select('svg')
      // .attr("viewBox", "0 0 " + width + " " + height)
      .attr('width', width)
      .attr('height', height)
      .select('g')
      .attr('transform', 'translate(' + width / 2 + ',' + (height / 2 + 10) + ')')
    redraw()
  }

  /*
   TODOs

  - HDD Scanning
    - Monitoring - eg https://github.com/paulmillr/chokidar
    - Directory caching
    - Real Disk usage
    - Grab free space!
    - Grab drives

  - Cross platform

  - UI
     - color by
       - size
       - filetype
       - last modified
       - number of files
    - Explorer Tree View
    - Responsive resizing (Zooming)
    - Filter hidden directories / files
    - combine hidden file sizes
    - Labels
    - Pie Magnifier
    - Absolute or relative file size intensity
    - Back / Fwd paths

  - Perf
    - Streaming partition datastructures
    - Named Pipes

  - Others
    - Git integration
    - Spotlike style
    - Mac Preview style (or integrate Preview)
    - Auto update (or use Electron Builder)
    - Import Es6 Modules

  DONE
   - Custom levels rendering
   - percentage as root of inner core
   - threshold - hide small files
   - Async file checking
   - hover over states
   - Streaming/incremental updates (sort of by recreating partitions & jsons)
   - Hover stats
   - Faster scanning
   - correct hover states for core
   - computation done in separate process
   - change numbers of center to selection
   - shows children selection on hover
   - Allow destination scanning (root / folder)
   - tested on windows
   - Canvas implementation: http://bl.ocks.org/mbostock/1276463
   - Fastest IPC (headless node / electron)
  */

  var len = Math.min(window.innerWidth, window.innerHeight)

  var width = innerWidth,
    height = innerHeight,
    radius = len * 0.45

  function calcDimensions() {
    width = innerWidth
    height =
      innerHeight -
      document.querySelector('header').getBoundingClientRect().height -
      document.querySelector('footer').getBoundingClientRect().height
    radius = len * 0.45
    log(innerHeight, height)
  }

  calcDimensions()

  var LEVELS = 11,
    INNER_LEVEL = 7,
    PATH_DELIMITER = '/',
    USE_COUNT = 0,
    HIDE_THRESHOLD = 0.1, // percentage (use 0.01, 1)
    CORE_RADIUS = radius * 0.4, // radius / LEVELS
    OUTER_RADIUS = radius - CORE_RADIUS,
    FLEXI_LEVEL = Math.min(LEVELS, INNER_LEVEL)

  var luminance = d3.scale
    .sqrt()
    .domain([0, 1e9])
    .clamp(true)
    .range([90, 20])

  var svg_container = d3.select('body').select('.svg-container')

  var svg = svg_container
    .append('svg')
    .attr('width', width)
    .attr('height', height)
    // .attr("preserveAspectRatio", "xMinYMin meet")
    // .attr("viewBox", "0 0 " + width + " " + height)
    //class to make it responsive
    // .classed("svg-content-responsive", true)
    .append('g')
    .attr('transform', 'translate(' + width / 2 + ',' + (height / 2 + 10) + ')')

  var partition

  var ADJUSTMENT = - Math.PI / 2
  var arc = d3.svg
    .arc()
    .startAngle(function(d) {
      return d.x + ADJUSTMENT
    })
    .endAngle(function(d) {
      return d.x + d.dx - 0.01 / (d.depth + 0.5) + ADJUSTMENT
    })
    .innerRadius(function(d) {
      return CORE_RADIUS + OUTER_RADIUS / FLEXI_LEVEL * (d.depth - 1)
      // return Math.sqrt(d.y); // ROOT
    })
    .outerRadius(function(d) {
      // return Math.sqrt(d.y + d.dy); // ROOT
      return CORE_RADIUS + OUTER_RADIUS / FLEXI_LEVEL * (d.depth + 0) - 1
    })

  var realroot,
    currentNode,
    max_level,
    current_level = 0

  var circular_meter = svg.append('g')
  // TODO make a tiny border around the rim of center to show the percentage of current space

  document.addEventListener('ready', function() {
    explanation.on('click', zoomOut)
  })

  // Data Bind Elements
  var path
  var center

  function updateCore(d) {
    // d3.select(this).style('stroke', 'red').style('stroke-width', 2)
    var percent = (d.sum / (currentNode || root).sum * 100).toFixed(2) + '%'

    // 1. lengend
    // legend.html("<h2>"+d.key+"</h2><p>size: "+format(d.value)+" "+percent+"</p>")

    // 2. core
    // core_tag.html(d.name + '<br/>' + format(d.value) + ' (' + percent + ')')

    core_top.html(d.name)
    core_center.html(
      format(d.sum)
        .split(' ')
        .join('<br/>')
    )
    core_tag.html(percent + '<br/>')
    // + '<br/>' + format(currentNode.value)
    // + ' (' + percent + ')<br/>'

    updateBreadcrumbs(d)
  }

  function mouseover(d) {
    lastover = d

    updateCore(d)

    svg
      .selectAll('path')
      .style('opacity', 1 / (1 + d.depth))
      .filter(node => {
        if (node.depth < d.depth) {
          // node is parent of d
          return false
        } else {
          // d is parent of node
          var e = node
          while (e) {
            if (e == d) return true
            e = e.parent
          }
          return false
        }
      })
      .style('opacity', 1)

    updateSelection(d)
  }

  function mouseout(d) {
    lastover = null
    updateSelection(null)

    if (path) path.style('opacity', 0.8)

    if (currentNode) updateCore(currentNode)
  }

  function zoomIn(p) {
    if (p.depth > 1) {
      p = p.parent
    }
    if (!p.children) return
    zoom(p, p)
  }

  function zoomOut(p) {
    if (!p || !p.parent) return
    zoom(p.parent, p)
  }

  // Zoom to the specified node
  // updating the reference new root
  // uses a previous node for animation
  function zoom(root, p) {
    if (document.documentElement.__transition__) return

    updateNavigation(keys(root))
    updateBreadcrumbs(root)

    core_center.html(format(root.sum))
    core_top.html(root.name)

    max_level = 0
    current_level = 0

    var tmp = root.parent
    while (tmp) {
      current_level++
      tmp = tmp.parent
    }

    currentNode = root
    // console.log('current_level', current_level)

    // Rescale outside angles to match the new layout.
    var enterArc,
      exitArc,
      outsideAngle = d3.scale.linear().domain([0, 2 * Math.PI])

    function insideArc(d) {
      var pkey = key(p),
        dkey = key(d)
      return pkey > dkey
        ? { depth: d.depth - 1, x: 0, dx: 0 }
        : pkey < dkey ? { depth: d.depth - 1, x: 2 * Math.PI, dx: 0 } : { depth: 0, x: 0, dx: 2 * Math.PI }
    }

    function outsideArc(d) {
      return { depth: d.depth + 1, x: outsideAngle(d.x), dx: outsideAngle(d.x + d.dx) - outsideAngle(d.x) }
    }

    center
      .datum(root)
      .on('mouseover', mouseover)
      .on('mouseout', mouseout)

    // When zooming in, arcs enter from the outside and exit to the inside.
    // Entering outside arcs start from the old layout.
    if (root === p) (enterArc = outsideArc), (exitArc = insideArc), outsideAngle.range([p.x, p.x + p.dx])

    path = path.data(partition.nodes(root).slice(1), function(d) {
      return key(d)
    })

    // When zooming out, arcs enter from the inside and exit to the outside.
    // Exiting outside arcs transition to the new layout.
    if (root !== p) (enterArc = insideArc), (exitArc = outsideArc), outsideAngle.range([p.x, p.x + p.dx])

    FLEXI_LEVEL = Math.min(LEVELS, INNER_LEVEL, max_level)

    var transition = d3.event && d3.event.altKey ? 7500 : 750
    d3
      .transition()
      .duration(transition)
      .each(function() {
        path
          .exit()
          .transition()
          .style('fill-opacity', function(d) {
            return d.depth === 1 + (root === p) ? 1 : 0
          })
          .attrTween('d', function(d) {
            return arcTween.call(this, exitArc(d))
          })
          .remove()

        path
          .enter()
          .append('path')
          .style('fill-opacity', function(d) {
            return d.depth === 2 - (root === p) ? 1 : 0
          })
          .style('fill', function(d) {
            return fill(d)
          })
          .on('click', zoomIn)
          .each(function(d) {
            this._current = enterArc(d)
          })
          .attr('class', 'area')
          .on('mouseover', mouseover)
          .on('mouseout', mouseout)

        path
          .transition()
          .style('fill-opacity', 1)
          .attrTween('d', function(d) {
            return arcTween.call(this, updateArc(d))
          })
      })
  }

  function redraw(node) {
    node = node || currentNode
    if (node) zoom(node, node)
  }

  var jsoned = false

  var lastover

  function generateSunburst(r) {
    var root = r

    var oldLineage
    if (currentNode) oldLineage = keys(currentNode)

    currentNode = root
    realroot = r

    function namesort(a, b) {
      return d3.ascending(a.name, b.name)
    }
    function sizesort(a, b) {
      return d3.ascending(a.sum, b.sum)
    }

    partition = d3.layout
      .partition()
      .value(function(d) {
        return d.size
      })
      .sort(sizesort) // namesort
      .size([2 * Math.PI, radius]) // use r*r for equal area

    // Compute the initial layout on the entire tree to sum sizes.
    // Also compute the full name and fill color for each node,
    // and stash the children so they can be restored as we descend.
    console.time('compute1')
    partition
      .value(d => {
        // if (Math.random() < 0.01) console.log('value1')
        return 1
      })
      .nodes(root)
      .forEach(d => {
        d.count = d.value
      })
    console.timeEnd('compute1')

    console.time('compute2')
    partition
      .value(d => {
        // if (Math.random() < 0.01) console.log('value2')
        return d.size
      })
      .nodes(root)
      // .filter(function(d) {
      //   return (d.dx > 0.005); // 0.005 radians = 0.29 degrees
      // })
      .forEach(function(d) {
        d._children = d.children
        d.sum = d.value
        // d.key = key(d);
        // d.fill = fill(d);
      })

    console.timeEnd('compute2')

    console.log('ROOT SIZE', format(root.value))
    console.time('compute3')
    // Now redefine the value function to use the previously-computed sum.

    max_level = 0
    partition
      .children(function(d, depth) {
        // console.log('children');
        max_level = Math.max(depth, max_level)
        if (depth >= LEVELS) {
          return null
        }
        if (!d._children) return null

        var children = []
        d._children.forEach(c => {
          var ref = root
          if (c.sum / ref.sum * 100 > HIDE_THRESHOLD) children.push(c)
        })

        return children
        // return depth < LEVELS ? d._children : null;
      })
      .value(function(d) {
        // decide count or sum
        return USE_COUNT ? d.count : d.sum
      })

    console.timeEnd('compute3')

    if (jsoned) {
      // this attempts to place you in the same view after you refresh the data
      if (oldLineage) {
        var n = root
        var name = oldLineage.shift()

        if (n.name != name) return redraw()

        while ((name = oldLineage.shift())) {
          var children = n.children.filter(function(n) {
            return n.name == name
          })

          if (children.length != 1) {
            return redraw(n)
          }

          n = children[0]
        }
        if (n) return redraw(n)
      }

      updateCore(root)
      return redraw()
    }
    jsoned = true

    center = svg
      .append('g')
      .attr('id', 'core')
      .on('click', zoomOut)

    center.append('circle').attr('r', CORE_RADIUS)

    center.append('title').text('zoom out')

    path = svg
      .selectAll('path')
      .data(partition.nodes(root).slice(1))
      .enter()
      .append('path')
      .attr('d', arc)
      .attr('class', 'area')
      .style('fill', function(d) {
        return fill(d)
      })
      .each(function(d) {
        this._current = updateArc(d)
      })
      .on('click', zoomIn)
      .on('mouseover', mouseover)
      .on('mouseout', mouseout)
    // .style("visibility", function(d) {
    //   var ref = currentNode || root
    //   // return d.sum / ref.sum * 100 > HIDE_THRESHOLD ? 'visible' : 'hidden'
    //   return d.sum / ref.sum * 100 > HIDE_THRESHOLD ? 'display' : 'none'
    // })

    if (RENDER_3D) plot3d(partition.nodes(root))
    redraw()
  }

  function fill(d) {
    var p = d
    while (p.depth > 1) p = p.parent
    // var c = d3.lab(hue(p.sum));
    // var c = d3.lab(hue(p.count));
    // var c = d3.lab(hue(p.key));
    var c = d3.lab(hue(p.name))
    // var c = d3.lab(hue(p._children));
    // var c = d3.lab(hue(p.children ? p.children.length : 0));

    c.l = luminance(d.sum)
    return c
  }

  function arcTween(b) {
    var i = d3.interpolate(this._current, b)
    this._current = i(0)
    return function(t) {
      return arc(i(t))
    }
  }

  function updateArc(d) {
    return { depth: d.depth, x: d.x, dx: d.dx }
  }

  // Export plugin interface
  return {
    resize: onResize,
    generate: generateSunburst,
    showMore: function() {
      LEVELS++
      redraw()
    },
    showLess: function() {
      if (LEVELS <= 1) return
      LEVELS--
      redraw()
    },
    navigateUp: function() {
      zoomOut(currentNode)
    },
    cleanup: function() {
      if (path) {
        // do some GC()!!!
        path.remove()
        center.remove()

        d3
          .select('#sequence')
          .select('div')
          .selectAll('a')
          .remove()

        partition = null
        realroot = currentNode = null
        path = center = null

        jsoned = false
      }
    },
    navigateTo: function(keys) {
      var n = getNodeFromPath(keys, realroot)
      zoom(n, n)
    }
  }
}
