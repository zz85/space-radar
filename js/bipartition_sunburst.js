function onResize() {

}

/*
 TODOs
 - color by
   - size
   - filetype
   - last modified
   - number of files
- Explorer Tree View
- Async file checking
- Responsive
- Git integration
- Real Disk usage
- Labels
- Pie Magnifier
- File Types
- Threshold - hide small files
- Hover stats
- Canvas implementation: http://bl.ocks.org/mbostock/1276463
- Absolute or relative file size intensity

DONE
 - custom levels
 - percentage as root of inner core

*/

var len = Math.min(window.innerWidth, window.innerHeight);

var width = innerWidth,
    height = innerHeight,
    radius = len / 3;

var LEVELS = 5
  , PATH_DELIMITER = '/'
  , USE_COUNT = 0

var hue = d3.scale.category10();

var luminance = d3.scale.sqrt()
    .domain([0, 1e9])
    .clamp(true)
    .range([90, 20]);


var svg = d3.select("body").append("svg")
    .attr("width", width)
    .attr("height", height)
  .append("g")
    .attr("transform", "translate(" + width / 2 + "," + (height / 2 + 10) + ")");

var partition = d3.layout.partition()
    .value(function(d) { return d.size; })
    .sort(function(a, b) { return d3.ascending(a.name, b.name); })
    .size([2 * Math.PI, radius])
    ;

var arc = d3.svg.arc()
    .startAngle(function(d) { return d.x; })
    .endAngle(function(d) { return d.x + d.dx - .01 / (d.depth + .5); })
    .innerRadius(function(d) { return radius / LEVELS * d.depth; })
    .outerRadius(function(d) { return radius / LEVELS * (d.depth + 1) - 1; });

// var legend = d3.select("#legend")
var legend = d3.select("body").append("div")
  .attr('id', 'legend')

// d3.json("flare.json", onJson);
// d3.json("test.json", onJson);
onJson(null, json)
var current_p;

function onJson(error, root) {
  if (error) throw error;



  // Compute the initial layout on the entire tree to sum sizes.
  // Also compute the full name and fill color for each node,
  // and stash the children so they can be restored as we descend.
  partition
    .value(d => {
      if (Math.random() < 0.01) console.log('value1')
      return 1
    })
    .nodes(root)
    .forEach(d => {
      d.count = d.value
    })

  partition
      .value((d) => {
        if (Math.random() < 0.01)console.log('value2')
        return d.size;
      })
      .nodes(root)
      .forEach(function(d) {
        d._children = d.children;
        d.sum = d.value;
        d.key = key(d);
        d.fill = fill(d);
      });

  // Now redefine the value function to use the previously-computed sum.
  partition
      .children(function(d, depth) {
        console.log('children');
        if (depth >= LEVELS - 1) return null
        if (!d._children) return null;

        var children = [];
        d._children.forEach(c => {
          var ref = current_p || root
          if (c.sum / ref.sum * 100 > 0.1) children.push(c)
        })

        return children;

        return depth < LEVELS - 1 ? d._children : null;
      })
      .value(function(d) {
        // decide count or sum
        return USE_COUNT ? d.count : d.sum
      })

  var center = svg.append("circle")
      .attr("r", radius / LEVELS)
      .on("click", zoomOut);

  center.append("title")
      .text("zoom out");

  var path = svg.selectAll("path")
      .data(partition.nodes(root).slice(1))
    .enter().append("path")
      .attr("d", arc)
      .style("fill", function(d) { return d.fill; })
      .each(function(d) { this._current = updateArc(d); })
      .on("click", zoomIn)
      .on("mouseover", mouseover)

  function mouseover(d) {
    var percent = (d.sum / (current_p || root).sum * 100).toFixed(2) + '%'
    // center.select('title').text(d.name + '\t' + format(d.value))
    legend.html("<h2>"+d.key+"</h2><p>size: "+format(d.value)+" "+percent+"</p>")
  }

  ///
 function zoomIn(p) {
    if (p.depth > 1) p = p.parent;
    if (!p.children) return;
    zoom(p, p);
  }

  function zoomOut(p) {
    if (!p || !p.parent) return;
    zoom(p.parent, p);
  }

  window.redraw = () => zoom(current_p, current_p);

  // Zoom to the specified new root.
  function zoom(root, p) {
    console.log(p.name, format(p.value), p);
    current_p = root;

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

    d3.transition().duration(d3.event.altKey ? 7500 : 750).each(function() {
      path.exit().transition()
          .style("fill-opacity", function(d) { return d.depth === 1 + (root === p) ? 1 : 0; })
          .attrTween("d", function(d) { return arcTween.call(this, exitArc(d)); })
          .remove();

      path.enter().append("path")
          .style("fill-opacity", function(d) { return d.depth === 2 - (root === p) ? 1 : 0; })
          .style("fill", function(d) { return d.fill; })
          .on("click", zoomIn)
          .each(function(d) { this._current = enterArc(d); })
          .on("mouseover", mouseover);

      path.transition()
          .style("fill-opacity", 1)
          .attrTween("d", function(d) { return arcTween.call(this, updateArc(d)); });
    });
  }

}

function key(d) {
  var k = [], p = d;
  while (p.depth) k.push(p.name), p = p.parent;
  return k.reverse().join(PATH_DELIMITER);
}

function fill(d) {
  var p = d;
  while (p.depth > 1) p = p.parent;
  // var c = d3.lab(hue(p.name));
  // var c = d3.lab(hue(p.children));
  var c = d3.lab(hue(p.children ? p.children.length : 0));
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

// d3.select(self.frameElement).style("height", margin.top + margin.bottom + "px");

