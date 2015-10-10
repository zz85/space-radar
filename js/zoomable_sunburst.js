var len = Math.min(window.innerWidth, window.innerHeight);

function onResize() {

}

var width = len,
    height = len,
    radius = len / 3;

var x = d3.scale.linear()
    .range([0, 2 * Math.PI]);

// d3.scale.sqrt
var y = d3.scale.linear()
    .range([0, radius]);

var color = d3.scale.category20c();
var hue = d3.scale.category10();

var luminance = d3.scale.sqrt()
    .domain([0, 1e6])
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
    // .size([2 * Math.PI, radius])
    ;

var expanded = 50;
var arc = d3.svg.arc()
    .startAngle(function(d) { return Math.max(0, Math.min(2 * Math.PI, x(d.x))); })
    .endAngle(function(d) { return Math.max(0, Math.min(2 * Math.PI, x(d.x + d.dx))); })
    .innerRadius(function(d) { return expanded + Math.max(0, y(d.y)); })
    .outerRadius(function(d) { return expanded + Math.max(0, y(d.y + d.dy)); });

// d3.json("flare.json", onJson);
// d3.json("test.json", onJson);
onJson(null, json)

function onJson(error, root) {
  if (error) throw error;

  // Compute the initial layout on the entire tree to sum sizes.
  // Also compute the full name and fill color for each node,
  // and stash the children so they can be restored as we descend.
  partition
      .value(function(d) { return d.size; })
      .nodes(root)
      .forEach(function(d) {
        d._children = d.children;
        d.sum = d.value;
        d.key = key(d);
        d.fill = fill(d);
      });

  // Now redefine the value function to use the previously-computed sum.
  // partition
  //     .children(function(d, depth) { return depth < 2 ? d._children : null; })
  //     .value(function(d) { return d.sum; });

  var path = svg.selectAll("path")
      .data(partition(root))
    .enter().append("path")
      .attr("d", arc)
      .style("fill", function(d) { return d.fill; })
      .on("click", click)
      .on('mouseover', mouseover)
      // .text(d => { return d.name + ' ' + format(d.value)} )

  var test = svg
    .append("text")
    .attr("x", function(d) { return 0 })
    .attr("y", 0)
    .text((d) => { return 'Test'; });

  function mouseover(d) {
    // console.log(d.name, format(d.value));
    test.text(d.name + '\t' + format(d.value))
    // this.style('fill', '#f00')`
  }

  function click(d) {
    console.log(d.name, format(d.value), d);
    path.transition()
      .duration(750)
      .attrTween("d", arcTween(d));
  }
}

d3.select(self.frameElement).style("height", height + "px");

function key(d) {
  var k = [], p = d;
  while (p.depth) k.push(p.name), p = p.parent;
  return k.reverse().join("/");
}

function fill(d) {
  var p = d;
  while (p.depth > 1) p = p.parent;
  // var c = d3.lab(hue(p.name));
  var c = d3.lab(hue(p.name));
  c.l = luminance(d.sum);
  return c;
}

// Interpolate the scales!
function arcTween(d) {
  var xd = d3.interpolate(x.domain(), [d.x, d.x + d.dx]),
      yd = d3.interpolate(y.domain(), [d.y, 1]),
      yr = d3.interpolate(y.range(), [d.y ? 20 : 0, radius]);
  return function(d, i) {
    return i
        ? function(t) { return arc(d); }
        : function(t) { x.domain(xd(t)); y.domain(yd(t)).range(yr(t)); return arc(d); };
  };
}