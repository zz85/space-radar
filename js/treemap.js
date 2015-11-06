var margin = {
    top: 40, right: 10, bottom: 10, left: 10
  },
  width = window.innerWidth - margin.left - margin.right, // 760
  height = window.innerHeight - margin.top - margin.bottom, // 500

  xd = x = d3.scale.linear()
    .domain([0, width])
    .range([0, width]),
  yd = y = d3.scale.linear()
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
- [ ] align center (for files)
- [ ] appear on hover
- [x] visible labels for each directory


interactions
- [ ] go into directory
- [x] animations entering directory
- [ ] update tree
- [x] show more children
*/

var color = d3.scale.category20c();

var treemap = d3.layout.treemap()
    .size([width, height])
    .sticky(true)
    .round(false)
    .ratio(height / width * 0.5 * (1 + Math.sqrt(5)))
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
    .style("margin-right", -margin.right + "px")
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
  var total_size = data.value
  console.log('total size', total_size)

  console.time('treemap')
  var nodes = treemap.nodes(data)
  console.timeEnd('treemap')

  console.time('filter')
  nnn = nodes
    // .filter( d => { return d.depth < TREEMAP_LEVELS } )
    .filter( d => {
      return d.depth >= currentDepth &&
        d.depth < currentDepth + TREEMAP_LEVELS &&
        d.value / total_size > 0.001
    } )
    // .filter( d => { return !d.children } ) // leave nodes only
  console.timeEnd('filter')

  var cell = svg.selectAll('g')
    .data( nnn, key )

  cell.exit()
    .transition(500)
    .attr("opacity", 0)
    .remove()

  cell.enter()
    .append('g')
    .attr('class', 'cell')
    .call(rect)
    .attr("opacity", 0)
      .transition(500)
      .attr("opacity", 0.8)
    // .attr("transform", function(d) { return "translate(" + d.x + "," + d.y + ")"; })
    // .on("click", function(d) { return zoom(node == d.parent ? root : d.parent) });


  // cell.append("rect")
  //   .style("fill", function(d) {
  //     // return color(d.parent.name);\
  //     return color(d.name);
  //   })
  //   .call(rect)

  // cell.append("text")
  //   .call(text)
  //   .attr("text-anchor", "middle")
  //   .text(function(d) { return d.name })
  //   .style('font-size', '8px')
  //   .style("opacity", function(d) { d.w = this.getComputedTextLength(); return d.dx > d.w ? 1 : 0; });

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
      return y(d.y) + 6 * 2;
    })
}

function generateTreemap(data) {

  node = root = data // TODO cleanup
  console.log('display root', root)
  // initialize(root)
  // accumulate(root)
  // layout(root)
  // console.log(root)

  display(root)
  currentNode = root

  // d3.select(window).on("click", function() {
  //   console.log('click root')
  //   // zoom(root);
  //   // zoom(current.parent)
  //   navigateTo(root)
  // });
}

var zooming = false;
var current;

var USE_GAP = 0, USE_BORDERS = 1, TREEMAP_LEVELS = 2, BENCH = 0,
  USE_LABEL_GAP = 1
var mouseclicked, mousex, mousey, mouseovered = null;

var currentDepth = 0,
  currentNode,
  height = 10

function showMore() {
  TREEMAP_LEVELS++
  console.log('TREEMAP_LEVELS', TREEMAP_LEVELS)
  zoom(currentNode)
  drawer.run()
}

function showLess() {
  if (TREEMAP_LEVELS > 0)
  TREEMAP_LEVELS--
  console.log('TREEMAP_LEVELS', TREEMAP_LEVELS)
  zoom(currentNode)
  drawer.run()
}

d3.select(canvas).on("mousemove", function() {
  mousex = d3.event.offsetX
  mousey = d3.event.offsetY
  drawer.schedule(10)
  canceller.schedule()
  // console.log(d3.event.offsetX, d3.event.offsetY)
  // console.log(d3.event.clientX, d3.event.clientY)
})

d3.select(canvas).on("click", function() {
  // console.log('click')
  mouseclicked = true
  drawer.schedule(10)
})

function gx(d) {
  return xd(d.x)
}

function gy(d) {
  return yd(d.y)
}

function gw(d) {
  return xd(d.x + d.dx) - xd(d.x)
}

function gh(d) {
  return yd(d.y + d.dy) - yd(d.y)
}

var full_repaint = true

function draw(next) {
  if (BENCH) console.time('canvas draw');
  ctx.clearRect(0, 0, canvas.width, canvas.height)

  var metrics = ctx.measureText('M');
  height = metrics.width;

  if (BENCH) console.time('dom')
  var dom = dataContainer
    .selectAll('.cell')
    log('cells', dom[0].length)
  if (BENCH) console.timeEnd('dom')

  var found = [], hover = []

  console.time('sort')
  dom.sort(function sort(a, b) {
    return a.depth - b.depth
  })
  console.timeEnd('sort')

  console.time('each')
  dom.each(function each(d) {
    ctx.save()
    g = d3.select(this)
    // d = d3.select(g).datum()

    if (d.depth < currentDepth) return

    var l = d.parent == mouseovered ? 1 : 0
    if (d.depth > (TREEMAP_LEVELS + currentDepth + l)) {
       return
    }

    // if (d.children) return // show all children only

    // hue('haha')
    var c = d3.lab(o(d.value))
    c.l = luminance(d.depth)

    var x, y, w, h
    // x = xd(d.x)
    // y = yd(d.y)
    // w = xd(d.x + d.dx) - xd(d.x)
    // h = yd(d.y + d.dy) - yd(d.y)

    x = g.attr('x')
    y = g.attr('y')
    w = g.attr('width')
    h = g.attr('height')

    // if (USE_GAP) {
    //   var gap = 0.5 * depthDiff

    //   x += gap
    //   y += gap
    //   w -= gap * 2
    //   h -= gap * 2
    // }

    var depthDiff = d.depth - currentDepth

    var labelAdjustment = height * 1.4

    if (USE_LABEL_GAP) {

      var chain = [d]
      var ry = []
      for (var i = 0, n = d; i < depthDiff; i++, n = p) {
        var p = n.parent
        chain.push(p)
        ry.push(gy(n) - gy(p))
      }

      var p = chain.pop()
      h = gh(p)
      var parentHeight = p.parent ? gh(p.parent) : height
      var ny = gy(p) / parentHeight * (parentHeight - labelAdjustment)
      for (i = chain.length; i--; ) {
        var n = chain[i]
        ny += ry[i] / gh(p) * (h - labelAdjustment)
        h = gh(n) / gh(p) * (h - labelAdjustment)
        p = n
      }

      y = ny + labelAdjustment * depthDiff
    }

    ctx.globalAlpha = 0.8

    // var opacity = g.attr('opacity')
    // ctx.globalAlpha = opacity


    if (w > 0.5 && h > 0.5) {
      // hide when too small (could use percentages too)
      ctx.beginPath()
      ctx.rect(x, y, w, h)

      ctx.fillStyle = c

      if (ctx.isPointInPath(mousex, mousey)) {
        if (mouseovered == d) {
          ctx.fillStyle = 'yellow';
          ctx.globalAlpha = 1
        }

        if (d.depth <= currentDepth + TREEMAP_LEVELS) {
          hover.push(d)
        } else if (!full_repaint) {
          ctx.restore();
          return;
        }

        if (mouseclicked) {
          found.push(d)
        }
      }
      ctx.fill()
    }

    // border
    if (USE_BORDERS) {
      c.l = luminance(d.depth) + 4
      ctx.strokeStyle = c
      // ctx.strokeStyle = '#eee'
      ctx.strokeRect(x, y, w, h)
    }

    if (w > 10 && h > 10) {
      ctx.font = '8px Tahoma' // Tahoma Arial serif
      ctx.fillStyle = '#333'
      ctx.textBaseline = 'top'
      ctx.textAlign = 'left'

      ctx.beginPath()
      ctx.rect(x, y, w, h);
      ctx.clip();
      ctx.fillText(d.name + ' ' + format(d.value), x + 3, y)
      // ctx.fillText(format(d.value), x + 3, y + height * 1.4)
    }

    ctx.restore()
  });

  console.timeEnd('each')

  if (BENCH) console.timeEnd('canvas draw');
  if (hover.length)
    mouseovered = hover[hover.length - 1]
    bottom_status.innerHTML = breadcrumbs(mouseovered)
    mouseclicked = false

  if (found.length) {
    // d = found[1]
    d = found[hover.length - 1]
    // console.log(found, d.name)
    navigateTo( d.children ? d : d.parent )
  }

  full_repaint = false;

  // if (zooming)
    next(100)
}

function navigateTo(d) {
  if (!d) return
  if (!d.children) return

  full_repaint = true
  console.log('navigate to', d)
  xd.domain([d.x, d.x + d.dx])
  yd.domain([d.y, d.y + d.dy])
  currentDepth = d.depth
  currentNode = d
  zoom(d)
  drawer.schedule(10)
}

function navigateUp() {
  navigateTo(currentNode.parent)
}

drawer = new TimeoutTask(draw, 50)
canceller = new TimeoutTask(function() {
  drawer.cancel()
}, 1000)
// drawer.run()

function zoom(d) {
  if (zooming || !d) return;
  zooming = true;
  current = d;

  console.log('zoom')

  // var g2 = display(d),
  // t1 = g1.transition().duration(750),
  // t2 = g2.transition().duration(750);

  // Update the domain only after entering new elements.
  x.domain([d.x, d.x + d.dx]);
  y.domain([d.y, d.y + d.dy]);

  display(d)

  // Enable anti-aliasing during the transition.
  // svg.style("shape-rendering", null);

  // var kx = width / d.dx, ky = height / d.dy;

  // d3.event.altKey ? 7500 :

  var t = svg.selectAll("g.cell").transition()
      .duration(750)
      .call(rect)

  // t.select("rect")
  //  .call(rect)
  // t.select("text")
    // .call(text)
    // .style("opacity", function(d) { return kx * d.dx > d.w ? 1 : 0; });

  node = d;
  // d3.event.stopPropagation();
  zooming = false;
}
