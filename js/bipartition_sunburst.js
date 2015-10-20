d3.select(window).on('resize', onResize)

function onResize() {
  console.log('resize')
  width = innerWidth
  height = innerHeight
  svg_container.select('svg')
    // .attr("viewBox", "0 0 " + width + " " + height)
    .attr("width", width)
    .attr("height", height)
  .select("g")
    .attr("transform", "translate(" + width / 2 + "," + (height / 2 + 10) + ")");
  redraw()
}

/*
 TODOs
 - color by
   - size
   - filetype
   - last modified
   - number of files
- Explorer Tree View
- Responsive resizing
- Git integration
- Real Disk usage
- Labels
- Pie Magnifier
- File Types
- Canvas implementation: http://bl.ocks.org/mbostock/1276463
- Absolute or relative file size intensity
- return Max Depth
- Pie chart zooming
- Filter hidden directories / files
- combine hidden file sizes
- add drives
- idea: show children only upon mouseover
- do computation in webworkers
- use https://github.com/paulmillr/chokidar
- Directory caching

DONE
 - custom levels
 - percentage as root of inner core
 - threshold - hide small files
 - Async file checking
 - hover over states
 - Streaming/incremental updates (sort of by recreating partitions & jsons)
 - Hover stats
*/

var len = Math.min(window.innerWidth, window.innerHeight);

var width = innerWidth,
    height = innerHeight,
    radius = len * 0.45;

var LEVELS = 11
  , INNER_LEVEL = 7
  , PATH_DELIMITER = '/'
  , USE_COUNT = 0
  , HIDE_THRESHOLD = 0.1 // percentage (use 0.01, 1)
  , CORE_RADIUS = radius * 0.4 // radius / LEVELS
  , OUTER_RADIUS = radius - CORE_RADIUS
  , FLEXI_LEVEL = Math.min(LEVELS, INNER_LEVEL)
var hue = d3.scale.category10();

var luminance = d3.scale.sqrt()
    .domain([0, 1e9])
    .clamp(true)
    .range([90, 20]);

var svg_container = d3.select("body")
  .append("div")
   .classed("svg-container", true) //container class to make it responsive
  ;

var svg = svg_container
  .append("svg")
    .attr("width", width)
    .attr("height", height)
    // .attr("preserveAspectRatio", "xMinYMin meet")
    // .attr("viewBox", "0 0 " + width + " " + height)
    //class to make it responsive
    // .classed("svg-content-responsive", true)
  .append("g")
    .attr("transform", "translate(" + width / 2 + "," + (height / 2 + 10) + ")");

var partition;

var arc = d3.svg.arc()
    .startAngle(function(d) { return d.x; })
    .endAngle(function(d) { return d.x + d.dx - .01 / (d.depth + .5); })
    .innerRadius(function(d) {
      return CORE_RADIUS + OUTER_RADIUS / FLEXI_LEVEL * (d.depth - 1);
      // return Math.sqrt(d.y); // ROOT
    })
    .outerRadius(function(d) {
      // return Math.sqrt(d.y + d.dy); // ROOT
      return CORE_RADIUS + OUTER_RADIUS / FLEXI_LEVEL * (d.depth + 0) - 1;
    });

var legend = d3.select("#legend")
var explanation = d3.select("#explanation")
var core_top = d3.select("#core_top")
var core_center = d3.select("#core_center")
var core_tag = d3.select("#core_tag")

var current_p, max_level, current_level = 0;

var center = svg.append("g")
    .attr("id", "core")
    .on("click", zoomOut);

explanation.on('click', zoomOut)

center
    .append("circle")
    .attr("r", CORE_RADIUS)

center.append("title")
  .text("zoom out");

var path;

function mouseover(d) {
  // d3.select(this).style('stroke', 'red').style('stroke-width', 2)

  var percent = (d.sum / (current_p || root).sum * 100).toFixed(2) + '%'

  // 3 or 4 movable parts

  // 1. lengend
  legend.html("<h2>"+d.key+"</h2><p>size: "+format(d.value)+" "+percent+"</p>")

  // 2. core
  core_tag.html('' + format(d.value) + ' (' + percent + ')<br/>'  + d.name)
  core_tag.html(d.name + '<br/>' + format(d.value) + ' (' + percent + ')')

  // core_tag.html(percent)
  // core_tag.html(format(d.value))
  // core_tag.html(d.name)


  // 3. breadcrumbs
  // updateBreadcrumbs(getAncestors(d), percent);

  // 4. hover over mouse

}


function onProcess(path, b) {
  legend.html("<h2>scanning: "+b+"</h2><p>"+path+"</p>")
}

function zoomIn(p) {
  if (p.depth > 1) {
    p = p.parent;
  }
  if (!p.children) return;
  zoom(p, p);
}

function zoomOut(p) {
  if (!p || !p.parent) return;
  zoom(p.parent, p);
}

// Zoom to the specified new root.
function zoom(root, p) {
  updateBreadcrumbs(getAncestors(root), '');

  core_center.html(format(root.value));
  core_top.html(root.name)

  max_level = 0
  current_level = 0

  var tmp = root.parent
  while (tmp) {
    current_level++
    tmp = tmp.parent
  }

  current_p = root
  // console.log('current_level', current_level)

  if (document.documentElement.__transition__) return;

  // Rescale outside angles to match the new layout.
  var enterArc,
      exitArc,
      outsideAngle = d3.scale.linear().domain([0, 2 * Math.PI]);

  function insideArc(d) {
    return p.key > d.key
        ? {depth: d.depth - 1, x: 0, dx: 0} : p.key < d.key
        ? {depth: d.depth - 1, x: 2 * Math.PI, dx: 0}
        : {depth: 0, x: 0, dx: 2 * Math.PI};
  }

  function outsideArc(d) {
    return {depth: d.depth + 1, x: outsideAngle(d.x), dx: outsideAngle(d.x + d.dx) - outsideAngle(d.x)};
  }

  center.datum(root);

  // When zooming in, arcs enter from the outside and exit to the inside.
  // Entering outside arcs start from the old layout.
  if (root === p) enterArc = outsideArc, exitArc = insideArc, outsideAngle.range([p.x, p.x + p.dx]);

  path = path.data(partition.nodes(root).slice(1), function(d) { return d.key; });

  // When zooming out, arcs enter from the inside and exit to the outside.
  // Exiting outside arcs transition to the new layout.
  if (root !== p) enterArc = insideArc, exitArc = outsideArc, outsideAngle.range([p.x, p.x + p.dx]);

  FLEXI_LEVEL = Math.min(LEVELS, INNER_LEVEL, max_level);

  var transition = d3.event && d3.event.altKey ? 7500 : 750
  d3.transition().duration(transition).each(function() {
    path.exit().transition()
        .style("fill-opacity", function(d) { return d.depth === 1 + (root === p) ? 1 : 0; })
        .attrTween("d", function(d) { return arcTween.call(this, exitArc(d)); })
        .remove();

    path.enter().append("path")
        .style("fill-opacity", function(d) { return d.depth === 2 - (root === p) ? 1 : 0; })
        .style("fill", function(d) { return d.fill; })
        .on("click", zoomIn)
        .each(function(d) { this._current = enterArc(d); })
        .attr("class", "hmm")
        .on("mouseover", mouseover);

    path.transition()
        .style("fill-opacity", 1)
        .attrTween("d", function(d) { return arcTween.call(this, updateArc(d)); });
  });
}

window.redraw = () => zoom(current_p, current_p);

var jsoned = false;

var realroot;
var root;
function onJson(error, r) {
  root = r;
  realroot = r;

  if (error) throw error;

  partition = d3.layout.partition()
    .value(function(d) { return d.size; })
    .sort(function(a, b) { return d3.ascending(a.name, b.name); })
    .size([2 * Math.PI, radius])
    // .size([2 * Math.PI, radius * radius]) // ROOT
    ;

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
      .value((d) => {
        // if (Math.random() < 0.01) console.log('value2')
        return d.size;
      })
      .nodes(root)
      // .filter(function(d) {
      //   return (d.dx > 0.005); // 0.005 radians = 0.29 degrees
      // })
      .forEach(function(d) {
        d._children = d.children;
        d.sum = d.value;
        d.key = key(d);
        d.fill = fill(d);
      })

      ;
  console.timeEnd('compute2')

  console.log('ROOT SIZE', format(root.value))
  console.time('compute3')
  // Now redefine the value function to use the previously-computed sum.

  max_level = 0;
  partition
      .children(function(d, depth) {
        // console.log('children');
        max_level = Math.max(depth, max_level);
        if (depth >= LEVELS) {
          return null
        }
        if (!d._children) return null;

        var children = [];
        d._children.forEach(c => {
          var ref = current_p || root
          if (c.sum / ref.sum * 100 > HIDE_THRESHOLD) children.push(c)
        })

        return children;

        // return depth < LEVELS ? d._children : null;
      })
      .value(function(d) {
        // decide count or sum
        return USE_COUNT ? d.count : d.sum
      })


  console.timeEnd('compute3')


  current_p = root;
  if (jsoned) {
    return redraw();
    // path.remove()
  }
  jsoned = true;

  path = svg.selectAll("path")
      .data(partition.nodes(root).slice(1))
    .enter().append("path")
      .attr("d", arc)
      .attr("class", "hmm")
      .style("fill", function(d) { return d.fill; })
      .each(function(d) { this._current = updateArc(d); })
      .on("click", zoomIn)
      .on("mouseover", mouseover)
      // .style("visibility", function(d) {
      //   var ref = current_p || root
      //   // return d.sum / ref.sum * 100 > HIDE_THRESHOLD ? 'visible' : 'hidden'
      //   return d.sum / ref.sum * 100 > HIDE_THRESHOLD ? 'display' : 'none'
      // })

  redraw()

  ///

}

function key(d) {
  var k = [], p = d;
  while (p.depth) k.push(p.name), p = p.parent;
  return k.reverse().join(PATH_DELIMITER);
}

function fill(d) {
  var p = d;
  while (p.depth > 1) p = p.parent;
  // var c = d3.lab(hue(p.sum));
  // var c = d3.lab(hue(p.count));
  // var c = d3.lab(hue(p.key));
  var c = d3.lab(hue(p.name));
  // var c = d3.lab(hue(p._children));
  // var c = d3.lab(hue(p.children ? p.children.length : 0));

  c.l = luminance(d.sum);
  return c;
}

function arcTween(b) {
  var i = d3.interpolate(this._current, b);
  this._current = i(0);
  return function(t) {
    return arc(i(t));
  };
}

function updateArc(d) {
  return {depth: d.depth, x: d.x, dx: d.dx};
}

//
// Breadcrumbs
//

// Given a node in a partition layout, return an array of all of its ancestor
// nodes, highest first, but excluding the root.
function getAncestors(node) {
  var path = [];
  var current = node;
  while (current.parent) {
    path.unshift(current);
    current = current.parent;
  }

  // path.unshift(realroot);

  path = realroot.name.split(PATH_DELIMITER).slice(1).map(d => {
    return {
      name: d,
      depth: -1,
      root: true
    }
  }).concat(path)

  return path;
}

// Update the breadcrumb trail to show the current sequence and percentage.
function updateBreadcrumbs(nodeArray, percentageString) {

  // Data join; key function combines name and depth (= position in sequence).
  var g = d3
    .select("#sequence")
    .select('div')
      .selectAll("a")
      .data(nodeArray, function(d) { return d.name + d.depth; });

  // Add breadcrumb and label for entering nodes.
  var entering = g.enter()
    .append('a')
    .attr('href', '#')
      .style("background", function(d) {
        var h = hue(d.key);
        return h;
        // var c = d3.lab(hue(p.name));
        // c.l = luminance(d.sum);
        // return colors[d.name];
      })
    .on('click', d => {
      if (d.root)
        zoom(realroot, realroot)
      else
        zoom(d, d)
    })

  entering.text(function(d) { return d.name; })

  // Remove exiting nodes.
  g.exit().remove();

}
