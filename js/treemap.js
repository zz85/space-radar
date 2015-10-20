var margin = {
    top: 40, right: 10, bottom: 10, left: 10
  },
  width = 760 - margin.left - margin.right,
  height = 500 - margin.top - margin.bottom,

  x = d3.scale.linear().range([0, width]),
  y = d3.scale.linear().range([0, height])

var color = d3.scale.category20c();

var treemap = d3.layout.treemap()
    .size([width, height])
    .sticky(true)
    .round(false)
    // .children(function(d, depth) { return depth ? null : d._children; })
    .sort(function(a, b) { return a.value - b.value; })
    .value(function(d) { return d.size; });

var div = d3.select("body").append("div")
  .attr("class", "chart")
    .style("width", width + "px")
    .style("height", height + "px")

var svg = div
  .append("svg:svg")
    .attr("width", width)
    .attr("height", height)
  .append("svg:g")
    .attr("transform", "translate(.5,.5)");

function getPath(d) {
  var path = [d]
  d = d.parent
  while (d) {
    path.unshift(d)
    d = d.parent
  }

  return path
}

function initialize(root) {
  root.x = root.y = 0;
  root.dx = width;
  root.dy = height;
  root.depth = 0;
}

// Aggregate the values for internal nodes. This is normally done by the
// treemap layout, but not here because of our custom implementation.
// We also take a snapshot of the original children (_children) to avoid
// the children being overwritten when when layout is computed.
function accumulate(d) {
  return (d._children = d.children)
    // recursion step, note that p and v are defined by reduce
      ? d.value = d.children.reduce(function(p, v) {return p + accumulate(v); }, 0)
      : d.value;
}



// Compute the treemap layout recursively such that each group of siblings
// uses the same size (1×1) rather than the dimensions of the parent cell.
// This optimizes the layout for the current zoom state. Note that a wrapper
// object is created for the parent node for each group of siblings so that
// the parent’s dimensions are not discarded as we recurse. Since each group
// of sibling was laid out in 1×1, we must rescale to fit using absolute
// coordinates. This lets us use a viewport to zoom.
function layout(d) {
  if (d._children) {
    // treemap nodes comes from the treemap set of functions as part of d3
    treemap.nodes({_children: d._children});
    d._children.forEach(function(c) {
      c.x = d.x + c.x * d.dx;
      c.y = d.y + c.y * d.dy;
      c.dx *= d.dx;
      c.dy *= d.dy;
      c.parent = d;
      // recursion
      layout(c);
    });
  }
}

function display(data) {

  var total_size = root.value

  var nodes = treemap.nodes(root)
    .filter( d => { return !d.children } )

  var cell = svg.selectAll('g')
    .data( nodes )
    .enter().append( 'svg:g' )
      .attr("class", "cell")
      .attr("transform", function(d) { return "translate(" + d.x + "," + d.y + ")"; })
      .on("click", function(d) { return zoom(node == d.parent ? root : d.parent); });

  cell.append("svg:rect")
    .attr("width", function(d) { return d.dx - 1; })
    .attr("height", function(d) { return d.dy - 1; })
    .style("fill", function(d) { return color(d.parent.name); });

  cell.append("svg:text")
    .attr("x", function(d) { return d.dx / 2; })
    .attr("y", function(d) { return d.dy / 2; })
    .attr("dy", ".35em")
    .attr("text-anchor", "middle")
    .text(function(d) { return d.name; })
    .style("opacity", function(d) { d.w = this.getComputedTextLength(); return d.dx > d.w ? 1 : 0; });


  //   .on('mousedown', function(d) {
  //     var path = getPath(d).map(d => {return d.name }).join('/')
  //     console.log(path, d);
  //     d3.select('#legend').html(path)

  //     display(d)
  //   })
  //   .text(function(d) { return d.children ? null : d.size / total_size < 0.01 ? null: d.name });
}

function onJson(error, data) {
  if (error) throw error;
  node = root = data
  console.log('display root', root)


  // initialize(root)
  // accumulate(root)
  // layout(root)
  // console.log(root)

  display(root)

  d3.select(window).on("click", function() { zoom(root); });

  // d3.select("select").on("change", function() {
  //   treemap.value(this.value == "size" ? size : count).nodes(root);
  //   zoom(node);
  // });
}


function zoom(d) {
  var kx = width / d.dx, ky = height / d.dy;
  x.domain([d.x, d.x + d.dx]);
  y.domain([d.y, d.y + d.dy]);

  var t = svg.selectAll("g.cell").transition()
      .duration(d3.event.altKey ? 7500 : 750)
      .attr("transform", function(d) { return "translate(" + x(d.x) + "," + y(d.y) + ")"; });

  t.select("rect")
      .attr("width", function(d) { return kx * d.dx - 1; })
      .attr("height", function(d) { return ky * d.dy - 1; })

  t.select("text")
      .attr("x", function(d) { return kx * d.dx / 2; })
      .attr("y", function(d) { return ky * d.dy / 2; })
      .style("opacity", function(d) { return kx * d.dx > d.w ? 1 : 0; });

  node = d;
  d3.event.stopPropagation();
}
