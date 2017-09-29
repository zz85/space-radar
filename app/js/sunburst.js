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

  - Perf
    - Streaming partition datastructures
    - Named Pipes

  - Others
    - Git integration
    - Spotlike style
    - Mac Preview style (or integrate Preview)
    - Auto update (or use Electron Builder)

  DONE
   - Back / Fwd paths
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

  var radius = len * 0.45

  function calcDimensions() {
    radius = len * 0.45
    log(innerHeight, height)
  }

  // calcDimensions()

  var LEVELS = 11,
    INNER_LEVEL = 7,
    PATH_DELIMITER = '/',
    USE_COUNT = 0,
    HIDE_THRESHOLD = 0.1, // percentage (use 0.01, 1)
    CORE_RADIUS = radius * 0.4, // radius / LEVELS
    OUTER_RADIUS = radius - CORE_RADIUS,
    FLEXI_LEVEL = Math.min(LEVELS, INNER_LEVEL)

  let svg_container, svg
  let explanation, core_top, core_center, core_tag

  function initDom() {
    svg_container = d3.select('body').select('#sunburst-chart')
    svg = svg_container.append('svg').append('g')

    explanation = d3.select('#explanation')
    core_top = d3.select('#core_top')
    core_center = d3.select('#core_center')
    core_tag = d3.select('#core_tag')
  }

  initDom()

  const ADJUSTMENT = -Math.PI / 2

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

  var rootNode,
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
  }

  function mouseover(d) {
    State.highlightPath(keys(d))
  }

  function mouseout() {
    State.highlightPath()
  }

  function highlightPath(_path, d) {
    if (d) {
      _mouseover(d)
    } else {
      _mouseout(d)
    }
  }

  function _mouseover(d) {
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
  }

  function _mouseout(d) {
    if (path) path.style('opacity', 0.8)

    if (currentNode) updateCore(currentNode)
  }

  function zoomIn(p) {
    if (p.depth > 1) {
      p = p.parent
    }
    if (!p.children) return

    // zoom(p, p)
    State.navigateTo(keys(p))
  }

  function zoomOut(p) {
    if (!p || !p.parent) return
    // zoom(p.parent, p)
    State.navigateTo(keys(p.parent))
  }

  // Zoom to the specified node
  // updating the reference new root
  // uses a previous node for animation
  function zoom(node, prevNode) {
    core_center.html(format(node.sum))
    core_top.html(node.name)

    max_level = 0
    current_level = 0

    var tmp = node.parent
    while (tmp) {
      current_level++
      tmp = tmp.parent
    }

    currentNode = node
    // console.log('current_level', current_level)

    // Rescale outside angles to match the new layout.
    var enterArc,
      exitArc,
      outsideAngle = d3.scale.linear().domain([0, 2 * Math.PI])

    function insideArc(d) {
      var pkey = key(prevNode),
        dkey = key(d)
      return pkey > dkey
        ? { depth: d.depth - 1, x: 0, dx: 0 }
        : pkey < dkey ? { depth: d.depth - 1, x: 2 * Math.PI, dx: 0 } : { depth: 0, x: 0, dx: 2 * Math.PI }
    }

    function outsideArc(d) {
      return { depth: d.depth + 1, x: outsideAngle(d.x), dx: outsideAngle(d.x + d.dx) - outsideAngle(d.x) }
    }

    center
      .datum(node)
      .on('mouseover', mouseover)
      .on('mouseout', mouseout)

    // When zooming in, arcs enter from the outside and exit to the inside.
    // Entering outside arcs start from the old layout.
    if (node === prevNode)
      (enterArc = outsideArc), (exitArc = insideArc), outsideAngle.range([prevNode.x, prevNode.x + prevNode.dx])

    const flatten_nodes = partition.nodes(node).slice(1)

    // When zooming out, arcs enter from the inside and exit to the outside.
    // Exiting outside arcs transition to the new layout.
    if (node !== prevNode)
      (enterArc = insideArc), (exitArc = outsideArc), outsideAngle.range([prevNode.x, prevNode.x + prevNode.dx])

    FLEXI_LEVEL = Math.min(LEVELS, INNER_LEVEL, max_level)

    var transition_time = d3.event && d3.event.altKey ? 7500 : 750

    path = svg.selectAll('path').data(flatten_nodes, key)

    // exit
    path
      .exit()
      .transition()
      .duration(transition_time)
      .style('fill-opacity', function(d) {
        return d.depth === 1 + (node === prevNode) ? 1 : 0
      })
      .attrTween('d', function(d) {
        return arcTween.call(this, exitArc(d))
      })
      .remove()

    // enter
    path
      .enter()
      .append('path')
      .attr('class', 'area')
      .style('fill', fill)
      .style('fill-opacity', d => {
        // return 1
        return d.depth === 2 - (node === prevNode) ? 1 : 0
      })
      .on('click', zoomIn)
      .each(function(d) {
        this._current = enterArc(d)
      })
      .on('mouseover', mouseover)
      .on('mouseout', mouseout)
      // update
      .merge(path)
      .attr('d', arc)
      .transition()
      .duration(transition_time)
      .style('fill-opacity', 1)
      .attrTween('d', function(d) {
        return arcTween.call(this, updateArc(d))
      })
  }

  function redraw(node) {
    if (!rootNode) return
    node = node || currentNode
    zoom(node, node)
  }

  var jsoned = false

  function generateSunburst(root) {
    var oldLineage
    // if (currentNode) oldLineage = keys(currentNode)

    currentNode = root
    rootNode = root

    partition = d3.layout.partition()

    partition
      .value(d => d.size)
      .sort(namesort) // namesort countsort sizesort
      .size([2 * Math.PI, radius]) // use r*r for equal area

    computeNodeCount(root)
    computeNodeSize(root)

    console.log('Root count', root.count, 'ROOT size', format(root.value))

    console.time('compute3')
    // Now redefine the value function to use the previously-computed sum.

    max_level = 0
    partition
      .children(function(d, depth) {
        max_level = Math.max(depth, max_level)
        if (depth >= LEVELS) {
          return null
        }
        if (!d._children) return null

        const children = d._children.filter(c => c.sum / root.sum * 100 > HIDE_THRESHOLD)
        return children
        // return depth < LEVELS ? d._children : null;
      })
      .value(function(d) {
        // decide count or sum
        // max_level = Math.max(d.depth, max_level)
        return USE_COUNT ? d.count : d.sum
      })

    console.timeEnd('compute3')

    // if (jsoned) {
    //   // this attempts to place you in the same view after you refresh the data
    //   if (oldLineage) {
    //     const node = getNodeFromPath(oldLineage, root)
    //     return redraw(node)
    //   }

    //   updateCore(root)
    //   return redraw()
    // }
    jsoned = true

    center = svg
      .append('g')
      .attr('id', 'core')
      .on('click', zoomOut)

    center.append('circle').attr('r', CORE_RADIUS)

    center.append('title').text('zoom out')

    if (RENDER_3D) plot3d(partition.nodes(root))
    redraw()
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
    cleanup: function() {
      if (path) {
        // do some GC()!!!
        path.remove()
        center.remove()

        // d3
        //   .select('#sequence')
        //   .select('div')
        //   .selectAll('a')
        //   .remove()

        rootNode = currentNode = null
        path = center = null

        jsoned = false
      }
    },
    navigateTo: function(keys) {
      if (!rootNode) return
      var n = getNodeFromPath(keys, rootNode)
      zoom(n, currentNode)
    },
    highlightPath: highlightPath
  }
}
