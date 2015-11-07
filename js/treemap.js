var
  width = window.innerWidth,
  height = window.innerHeight - document.querySelector('header').getBoundingClientRect().height - document.querySelector('footer').getBoundingClientRect().height,

  xd = x = d3.scale.linear()
    .domain([0, width])
    .range([0, width]),
  yd = y = d3.scale.linear()
    .domain([0, height])
    .range([0, height])

var hue = d3.scale.category10(); // colour hash

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


o = d3.scale.linear()
    .range(["white", "black"]) // steelblue", "brown pink orange green", "blue
    .domain([0, 12])
    .interpolate(d3.interpolateLab)

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
- [ ] color gradients

*/

function isPointInRect(mousex, mousey, x, y, w, h) {
  return mousex >= x &&
    mousex <= x + w &&
    mousey >= y &&
    mousey <= y + h
}

var color = d3.scale.category20c();

var treemap

function mktreemap() {

 treemap = d3.layout.treemap()
    .size([width, height])
    .sticky(true) // revalues when you call treemap()
    .round(false)
    // .padding([10, 4, 4, 4])
    .ratio(height / width * 0.5 * (1 + Math.sqrt(5)))
    // .children(function(d, depth) {
    //   return (depth > 2) ? null : d.children
    //   // return depth ? null : d._children;
    // })
    .sort(function(a, b) { return a.value - b.value; })
    .value(function(d) { return d.size; });
}

mktreemap()

// Canvas

var canvas = document.getElementById('canvas')
canvas.style.width = width + "px"
canvas.style.height = height + "px"

canvas.width = width
canvas.height = height

var ctx = canvas.getContext('2d')
var svg = new FakeSVG(key)


function FakeSVG(key) {
  // fake d3 svg grahpical intermediate representation
  // emulates the d3 join pattern
  this.objects = []
  this.map = {}
  this.key = key
}

FakeSVG.prototype.data = function(data) {
  var d;

  var map = this.map

  var enter = [], exit = []

  this.objects.forEach(function(o) {
    o.__data__ = null
  })
  for (var i = 0, il = data.length; i < il; i++) {
    d = data[i]
    var key = this.key(d)
    if (!map[key]) {
      var o = {}
      enter.push(o)
      map[key] = o
    }
    map[key].__data__ = d
  }

  var objects = []
  // new Array(data.length)

  var z = 0, zx = 0, zy = 0;
  Object.keys(map).forEach(function(k) {
    z++;
    var o = map[k]
    if (!o.__data__) {
      exit.push(o)
      delete map[k]
      zx ++
    } else {
      objects.push(o)
      zy ++
    }
  })

  console.log('total keys', z, 'removed', exit.length, 'still in', zy)

  this.objects = objects

  return [enter, exit]
}



function object_values(o) {
  return Object.keys(o).map(function(k) { return o[k] });
}

var fake_svg = new FakeSVG();
var nnn;

function display(data) {
  log('display', data)
  var total_size = data.value
  console.log('total size', total_size)

  // mktreemap()
  console.time('treemap')
  var nodes;
  if (!nnn) {
    nodes = treemap.nodes(data)
  } else {
    nodes = walk(data)
  }
  console.timeEnd('treemap')

  console.time('filter')
  console.log('before', nodes.length)
  nnn = nodes
    // .filter( d => { return d.depth < TREEMAP_LEVELS } )
    .filter( d => {
      return d.depth >= currentDepth &&
        d.depth < currentDepth + TREEMAP_LEVELS &&
        d.value / total_size > 0.000001
    } )
    // .filter( d => { return !d.children } ) // leave nodes only
  console.timeEnd('filter')
  console.log('after', nnn.length)

  var d = data
  x.domain([d.x, d.x + d.dx])
  y.domain([d.y, d.y + d.dy])

  console.time('svg')
  var updates = svg.data( nnn )
  console.timeEnd('svg')

  // var exit = updates[1]
  // var enter = updates[0]
  console.time('forEach')
  svg.objects.forEach(rect)
  console.timeEnd('forEach')

  // TODO - exit update enter

}

function rect(g) {
  var d = g.__data__
  g.x = x(d.x)
  g.y = y(d.y)
  g.w = x(d.x + d.dx) - x(d.x)
  g.h = y(d.y + d.dy) - y(d.y)
}

function generateTreemap(data) {
  node = root = data // TODO cleanup
  console.log('display root', root)

  display(root)
  currentNode = root
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
  if (full_repaint) ctx.clearRect(0, 0, canvas.width, canvas.height)

  var metrics = ctx.measureText('M');
  height = metrics.width;

  if (BENCH) console.time('dom')
  var dom = svg.objects

  log('cells', dom.length)
  if (BENCH) console.timeEnd('dom')

  var found = [], hover = []

  console.time('sort')
  dom.sort(function sort(a, b) {
    return a.__data__.depth - b.__data__.depth
  })
  console.timeEnd('sort')

  ctx.font = '8px Tahoma' // Tahoma Arial serif
  ctx.textBaseline = 'top'
  ctx.textAlign = 'left'

  console.time('each')
  dom.forEach(function each(g) {
    var d = g.__data__
    if (d.depth < currentDepth) return

    var l = d.parent == mouseovered ? 1 : 0
    if (d.depth > (TREEMAP_LEVELS + currentDepth + l)) {
       return
    }

    ctx.save()

    // if (d.children) return // show all children only

    // hue('haha')
    var x, y, w, h, c

    // x = xd(d.x)
    // y = yd(d.y)
    // w = xd(d.x + d.dx) - xd(d.x)
    // h = yd(d.y + d.dy) - yd(d.y)

    x = g.x
    y = g.y
    w = g.w
    h = g.h

    var depthDiff = d.depth - currentDepth

    if (USE_GAP) {
      var gap = 0.5 * depthDiff

      x += gap
      y += gap
      w -= gap * 2
      h -= gap * 2
    }

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

    // ctx.globalAlpha = 0.8
    // ctx.globalAlpha = opacity

    if (w < 0.5 || h < 0.5) {
      // hide when too small (could use percentages too)
      return ctx.restore()
    }

    ctx.beginPath()
    ctx.rect(x, y, w, h)

    c = o(d.depth)
    ctx.fillStyle = c

    if (isPointInRect(mousex, mousey, x, y, w, h)) {
    // if (ctx.isPointInPath(mousex, mousey)) {
      if (mouseovered == d) {
        ctx.fillStyle = 'yellow';
        ctx.globalAlpha = 1
      }

      if (d.depth <= currentDepth + TREEMAP_LEVELS) {
        hover.push(d)
        console.log(d.value)
      }

      if (mouseclicked) {
        found.push(d)
      }
    }
    // else if (!full_repaint) {
    //   ctx.restore();
    //   return;
    // }

    ctx.fill()
    // border
    if (USE_BORDERS) {
      // c.l = luminance(d.depth) + 4
      // ctx.strokeStyle = c
      ctx.strokeStyle = '#eee'
      // ctx.strokeRect(x, y, w, h)
      ctx.stroke()
    }

    // * h
    if (w > 100) { // draw text only on areas > 100 units squared
      // ctx.beginPath()
      // ctx.rect(x, y, w, h);
      ctx.clip();
      ctx.fillStyle = '#333'
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
}, 100)
// drawer.run()

// breath first expansion
function walk(node, a) {
  a = a ? a : [node]

  if (node.children) {
    for (var i = 0, len = node.children.length; i < len; i++) {
      var n = node.children[i]
      a.push(n)
      walk(n, a)
    }
  }

  return a
}

function zoom(d) {
  if (zooming || !d) return;
  zooming = true;
  current = d;

  console.log('zoom')

  // Update the domain only after entering new elements.
  x.domain([d.x, d.x + d.dx]);
  y.domain([d.y, d.y + d.dy]);

  display(d)

  // TODO transition of 500-750ms

  node = d;
  zooming = false;

  // d3.event.stopPropagation();
}
