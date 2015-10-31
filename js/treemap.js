var margin = {
    top: 40, right: 10, bottom: 10, left: 10
  },
  width = window.innerWidth - margin.left - margin.right, // 760
  height = window.innerHeight - margin.top - margin.bottom, // 500

  x = d3.scale.linear()
    .domain([0, width])
    .range([0, width]),
  y = d3.scale.linear()
    .domain([0, height])
    .range([0, height])

var hue = d3.scale.category10();

var
  luminance = d3.scale
    .linear() // .sqrt()
    .domain([0, 11])
    .clamp(true)
    .range([75, 96]);

var o = d3.scale.linear()
    .range(["purple", "orange"]) // steelblue", "brown pink orange green", "blue
    .domain([1e2, 1e9])
    .interpolate(d3.interpolateLab) // interpolateHcl

/* TODO
text labels
- [x] align top left
- [ ] prevent overlapping
- [ ] align center
- [ ] appear on hover

interactions
- [ ] go into directory
- [ ] animations entering directory
- [ ] update tree
*/

var color = d3.scale.category20c();

var treemap = d3.layout.treemap()
    .size([width, height])
    .sticky(true)
    .round(false)
    // .children(function(d, depth) {
    //   return (depth > 2) ? null : d.children
    //   // return depth ? null : d._children;
    // })
    .sort(function(a, b) { return a.value - b.value; })
    .value(function(d) { return d.size; });

var canvas = document.getElementById('canvas')
canvas.style.width = width + "px"
canvas.style.height = height + "px"

canvas.width = width
canvas.height = height

var ctx = canvas.getContext('2d')

var detachedContainer = document.createElement("custom");
var dataContainer = d3.select(detachedContainer);

var svg =
  dataContainer
  .append("svg")
    .attr("width", width)
    .attr("height", height)
    .style("margin-left", -margin.left + "px")
    .style("margin.right", -margin.right + "px")
  .append("g")
    .attr("transform", "translate(" + margin.left + "," + margin.top + ")")
    .style("shape-rendering", "crispEdges")


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

  console.time('treemap')
  var nodes = treemap.nodes(root)

  nnn = nodes
    // .filter( (d) => { return d.depth < 3 })
    // .filter( d => { return !d.children } )
  console.timeEnd('treemap')

  var cell = svg.selectAll('g')
    .data( nnn )

    .enter().append('g')
      .attr("class", "cell")
      .call(rect)
      // .attr("transform", function(d) { return "translate(" + d.x + "," + d.y + ")"; })
      .on("click", function(d) { return zoom(node == d.parent ? root : d.parent); });

  cell.append("rect")
    .style("fill", function(d) {
      // return color(d.parent.name);\
        return color(d.name);
    })
    .call(rect)

  cell.append("text")
    .call(text)
    .attr("text-anchor", "middle")
    .text(function(d) { return d.name; })
    .style('font-size', '8px')
    .style("opacity", function(d) { d.w = this.getComputedTextLength(); return d.dx > d.w ? 1 : 0; });

    var d = data

    x.domain([d.x, d.x + d.dx]);
    y.domain([d.y, d.y + d.dy]);


  //   .on('mousedown', function(d) {
  //     var path = getPath(d).map(d => {return d.name }).join('/')
  //     console.log(path, d);
  //     d3.select('#legend').html(path)

  //     display(d)
  //   })
  //   .text(function(d) { return d.children ? null : d.size / total_size < 0.01 ? null: d.name });
}

function rect(rect) {
  rect.attr("x", function(d) { return x(d.x); })
      .attr("y", function(d) { return y(d.y); })
      .attr("width", function(d) { return x(d.x + d.dx) - x(d.x); })
      .attr("height", function(d) { return y(d.y + d.dy) - y(d.y); });
}

function text(text) {
  text
    .attr("x", function(d) {
      return x(d.x + d.dx /2 ) + this.getComputedTextLength() * 2; })
    .attr("y", function(d) {
      return y(d.y + d.dy / 2)
      return y(d.y) + 6 * 2; })
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

  /*
  d3.select(window).on("click", function() {
    console.log('click root')
    // zoom(root);
    zoom(current.parent)
  });
  */

}

var zooming = false;
var current;

var USE_GAP = 0, USE_BORDERS = 1, TREEMAP_LEVELS = 5

function showMore() {
  TREEMAP_LEVELS++
  console.log('TREEMAP_LEVELS', TREEMAP_LEVELS)
  drawer.run()
}

function showLess() {
  if (TREEMAP_LEVELS > 0)
  TREEMAP_LEVELS--
  console.log('TREEMAP_LEVELS', TREEMAP_LEVELS)
  drawer.run()
}

function draw(next) {
  console.time('canvas draw');
  ctx.clearRect(0, 0, canvas.width, canvas.height)

  var metrics = ctx.measureText('M');
  var height = metrics.width;

  console.time('dom')
  var dom = dataContainer
      .selectAll('.cell')[0]
  console.timeEnd('dom')
  dom.forEach((f)=> {
    ctx.save()
    g = f
    d = d3.select(g).datum()

    // if (d.depth > TREEMAP_LEVELS) return
    if (d.children) return // show all children only

    // hue('haha')
    var c = d3.lab(o(d.value))
    c.l = luminance(d.depth)

    var x, y, w, h
    x = d.x
    y = d.y
    w = d.dx
    h = d.dy

    if (USE_GAP) {
      var gap = 0.5 * d.depth

      x += gap
      y += gap
      w -= gap * 2
      h -= gap * 2
    }

    if (w > 0.5 && h > 0.5) {
      // hide when too small (could use percentages too)
      ctx.fillStyle = c;
      ctx.fillRect(x, y, w, h)
    }

    // border
    if (USE_BORDERS) {
      c.l = luminance(d.depth) + 4
      ctx.strokeStyle = c // '#eee'
      ctx.strokeRect(x, y, w, h)
    }

    if (w > 20 && h > 20) {
      ctx.font = '8px Tahoma' // Tahoma Arial serif
      ctx.fillStyle = '#333'
      ctx.textBaseline = 'top'
      ctx.textAlign = 'left'

      ctx.beginPath()
      ctx.rect(x, y, w, h);
      ctx.clip();
      ctx.fillText(d.name, x, y)
      ctx.fillText(format(d.value), x, y + height)

    }

    ctx.restore()
  });

  console.timeEnd('canvas draw');

  next()
}

drawer = new TimeoutTask(draw, 5000)


// drawer.run()


function zoom(d) {
  if (zooming || !d) return;
  zooming = true;
  current = d;

  console.log('hee')


  // var g2 = display(d),
  // t1 = g1.transition().duration(750),
  // t2 = g2.transition().duration(750);

  // Update the domain only after entering new elements.
  x.domain([d.x, d.x + d.dx]);
  y.domain([d.y, d.y + d.dy]);

  display(d)

  // Enable anti-aliasing during the transition.
  svg.style("shape-rendering", null);

  // var kx = width / d.dx, ky = height / d.dy;

  var t = svg.selectAll("g.cell").transition()
      .duration(d3.event.altKey ? 7500 : 750)
      // .attr("transform", function(d) { return "translate(" + x(d.x) + "," + y(d.y) + ")"; });
      .call(rect)

  t.select("rect")
      .call(rect)

  t.select("text")
      .call(text)
      // .style("opacity", function(d) { return kx * d.dx > d.w ? 1 : 0; });

  node = d;
  d3.event.stopPropagation();
  zooming = false;
}
