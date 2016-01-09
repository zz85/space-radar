'use strict'

function TreeMap() {
  var
    width = window.innerWidth,
    height = window.innerHeight - document.querySelector('header').getBoundingClientRect().height - document.querySelector('footer').getBoundingClientRect().height,

    xd = d3.scale.linear()
      .domain([0, width])
      .range([0, width]),
    yd = d3.scale.linear()
      .domain([0, height])
      .range([0, height])

  let
    textHeight

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

  var
    drawer = new TimeoutRAFTask(draw),
    canceller = new TimeoutTask(function() {
      // stop draw task after 500ms
      drawer.cancel()
    }, 500)

  function drawThenCancel() {
    // run this on RAF
    drawer.run()
    canceller.schedule() // schedule a task to stop the animation
  }

  /* TODO
  text labels
  - [x] align top left
  - [x] visible labels for each directory
  - [x] prevent overlapping (clipped now)
  - [ ] align center (for files)
  - [ ] appear on hover

  interactions
  - [x] go into directory
  - [x] show more children
  - [x] color gradients
  - [ ] animations entering directory
  - [ ] update tree
  - [ ] show number of files / subdirectories

  optimizations
  - [ ] full repaint
  - [ ] calculate children per level basics
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
      // .size([width, height])
      // .sticky(true) // revalues when you call treemap(), also prevents shifting of boxes
      .round(false)
      // .padding([10, 4, 4, 4])
      // .ratio(height / width * 0.5 * (1 + Math.sqrt(5)))
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

  function onResize() {
    width = window.innerWidth
    height = window.innerHeight - document.querySelector('header').getBoundingClientRect().height - document.querySelector('footer').getBoundingClientRect().height

    xd = d3.scale.linear()
      .domain([0, width])
      .range([0, width])

    yd = d3.scale.linear()
      .domain([0, height])
      .range([0, height])


    canvas.width = width * window.devicePixelRatio
    canvas.height = height * window.devicePixelRatio

    canvas.style.width = width + "px"
    canvas.style.height = height + "px"

    ctx.font = '8px Tahoma' // Tahoma Arial serif
    ctx.textBaseline = 'top'
    ctx.textAlign = 'left'
    var metrics = ctx.measureText('M');
    textHeight = metrics.width;

    // full_repaint = true
    if (currentNode) navigateTo(currentNode)
  }


  class FakeSVG {
    constructor (key) {
      // fake d3 svg grahpical intermediate representation
      // emulates the d3 join pattern
      this.objects = []
      this.map = new Map()
      this.key = key

      this.entering = []
      this.leaving = []
    }

    data(data) {
      let d;

      let map = this.map

      let enter = [], exit = []

      // mark item to be removed
      this.objects.forEach(o => {
        o.__remove__ = true
      })

      for (var i = 0, il = data.length; i < il; i++) {
        d = data[i]
        var key = this.key(d)
        var o;
        if (!map.has(key)) {
          // create a new object
          o = {}
          enter.push(o)
          map.set(key, o);
        }
        o = map.get(key);
        o.__data__ = d
        o.__remove__ = false;
      }

      var objects = []

      var z = 0, zx = 0, zy = 0;
      map.forEach(function(o, k) {
        z++;
        if (false && o.__remove__) {
          exit.push(o)
          map.delete(k)
          zx ++
        } else {
          objects.push(o)
          zy ++
        }
      })

      console.log('total keys', z, objects.length, zy, 'added', enter.length, 'removed', exit.length)
      this.objects = objects

      // this.leaving = this.leaving.concat(exit);

      return [enter, exit]
    }
  }

  var ctx = canvas.getContext('2d')

  var fake_svg = new FakeSVG(key)
  var nnn

  onResize()

  // this is when we handle the rendering of data
  function display(data, relayout) {
    log('display', data)

    console.time('treemap')
    var nodes;
    // nodes is a JS like representation of tree structure
    if (!nnn || relayout) {
      nodes = treemap.nodes(data)
    }

    var total_size = data.value
    console.log('total size', total_size)

    nodes = walk(data, null, currentDepth + TREEMAP_LEVELS + 1)

    console.timeEnd('treemap')

    console.time('filter')
    console.log('before', nodes.length)
    nnn = nodes
      // .filter( d => { return d.depth < TREEMAP_LEVELS } )
      .filter( d => {
        return d.depth >= currentDepth &&
          d.depth <= currentDepth + TREEMAP_LEVELS + 1 &&
          d.value / total_size > 0.000001
      } )
      // .filter( d => { return !d.children } ) // leave nodes only
    console.timeEnd('filter')
    console.log('after', nnn.length)

    var d = data

    console.time('fake_svg')
    // we bind the JS data to a fake graphical representation
    var updates = fake_svg.data( nnn )
    console.timeEnd('fake_svg')

    var exit = updates[1]
    var enter = updates[0]
    enter.forEach(rectB)

    // Update the domain only after entering new elements.
    xd.domain([d.x, d.x + d.dx])
    yd.domain([d.y, d.y + d.dy])

    fake_svg.objects = [...fake_svg.map.values()];

    console.time('forEach')
    // we resize the graphical objects
    fake_svg.objects.forEach(rect)
    console.timeEnd('forEach')



    console.time('sort')
    fake_svg.objects.sort(function sort(a, b) {
      return a.__data__.depth - b.__data__.depth
    })
    console.timeEnd('sort')

    // start drawing
    drawThenCancel()

    // TODO - exit update enter

  }

  function rect(g) {
    rectC(g, true);
  }

  function rectB(g) {
    rectC(g, false);
  }

  function rectC(g, animate) {
    var d = g.__data__
    let x, y, w, h

    x = xd(d.x)
    y = yd(d.y)
    w = xd(d.x + d.dx) - xd(d.x)
    h = yd(d.y + d.dy) - yd(d.y)

    // var depthDiff = d.depth - currentDepth
    // var labelAdjustment = textHeight * 1.4

    // var chain = [d]
    // var ry = []
    // for (var i = 0, n = d; i < depthDiff; i++, n = p) {
    //   var p = n.parent
    //   chain.push(p)
    //   ry.push(gy(n) - gy(p))
    // }

    // var p = chain.pop()
    // h = gh(p)
    // var parentHeight = p.parent ? gh(p.parent) : height
    // var ny = gy(p) / parentHeight * (parentHeight - labelAdjustment)
    // for (i = chain.length; i--; ) {
    //   var n = chain[i]
    //   ny += ry[i] / gh(p) * (h - labelAdjustment)
    //   h = gh(n) / gh(p) * (h - labelAdjustment)
    //   p = n
    // }

    // y = ny + labelAdjustment * depthDiff

    if (animate) {
      let now = Date.now(),
      end = now + 400

      let t = g.__transition__ = {}

      transition(t, 'x', g, x, now, end, linear)
      transition(t, 'y', g, y, now, end, linear)
      transition(t, 'w', g, w, now, end, linear)
      transition(t, 'h', g, h, now, end, linear)
    } else {
      g.x = x
      g.y = y
      g.h = h
      g.w = w

    }



  }

  function transition(o, prop, a, b, c, d, func) {
    if (prop in a) {
      o[prop] = {
        valueStart: a[prop],
        valueEnd: b,
        timeStart: c,
        timeEnd: d,
        ease: func
      }
    } else {
      a[prop] = b
    }
  }

  function linear(k) {
    return k;
  }

  var currentDepth = 0,
    currentNode,
    rootNode

  function generateTreemap(data) {
    rootNode = data // TODO cleanup
    log('generateTreemap', rootNode)

    let oldPath
    if (currentNode) {
      oldPath = keys(currentNode)
    }

    currentNode = rootNode
    currentDepth = 0
    // mktreemap()
    display(rootNode, true)

    if (oldPath) navigateToPath(oldPath)
  }

  function navigateToPath(keys) {
    let n = getNodeFromPath(keys, rootNode)
    if (n) navigateTo(n)
  }

  var zooming = false;

  var USE_GAP = 0, USE_BORDERS = 1, TREEMAP_LEVELS = 2, BENCH = 0,
    USE_LABEL_GAP = 1
  var mouseclicked, mousex, mousey, mouseovered = null;

  function showMore() {
    TREEMAP_LEVELS++
    console.log('TREEMAP_LEVELS', TREEMAP_LEVELS)
    zoom(currentNode)
  }

  function showLess() {
    if (TREEMAP_LEVELS > 1)
    TREEMAP_LEVELS--
    console.log('TREEMAP_LEVELS', TREEMAP_LEVELS)
    zoom(currentNode)
  }

  d3.select(canvas)
  .on("mousemove", function() {
    mousex = d3.event.offsetX
    mousey = d3.event.offsetY
    drawThenCancel()
    // console.log(d3.event.offsetX, d3.event.offsetY)
    // console.log(d3.event.clientX, d3.event.clientY)
  })
  .on('mouseout', function() {
    updateBreadcrumbs(currentNode)
    mouseovered = null
    updateSelection(mouseovered)
    mousex = -1
    mousey = -1
  })

  d3.select(canvas).on("click", function() {
    // console.log('click')
    mouseclicked = true
    drawThenCancel()
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
    // if (full_repaint)
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    if (BENCH) console.time('dom')

    var dom = fake_svg.objects
    log('cells', dom.length)

    if (BENCH) console.timeEnd('dom')

    var found = [], hover = []

    ctx.save()
    let dpr = window.devicePixelRatio
    ctx.scale(dpr, dpr)


    console.time('each')

    // Update animation
    dom.forEach(function each(g) {
      let d = g.__data__
      let t = g.__transition__

      if (t) {
        let now = Date.now()

        for (let key in t) {
          let prop = t[key]

          let dur = prop.timeEnd - prop.timeStart
          let diff = prop.valueEnd - prop.valueStart
          let lapse = now - prop.timeStart
          let k = lapse / dur
          g[key] = prop.ease(k) * diff + prop.valueStart

          // console.log(k)

          if (now >= prop.timeEnd) {
            delete t[key]
            g[key] = prop.valueEnd
            if (g.__remove__) {
              // console.log('total keys done', fake_svg.map.size)
              fake_svg.map.delete(fake_svg.key(d))
            }
          }
        }
      }
    });

    // now draw the elements if needed
    dom.forEach(function each(g) {
      let d = g.__data__

      if (d.depth < currentDepth) return

      var l = d.parent == mouseovered ? 1 : 0
      if (d.depth > (TREEMAP_LEVELS + currentDepth + l)) {
         return
      }

      ctx.save()

      // if (d.children) return // show all children only

      let x, y, w, h, c
      x = g.x
      y = g.y
      w = g.w
      h = g.h

      let depthDiff = d.depth - currentDepth

      if (USE_GAP) {
        // this is buggy
        let gap = 0.5 * depthDiff * 2

        x += gap
        y += gap
        w -= gap * 2
        h -= gap * 2
      }

      ctx.globalAlpha = 0.8
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
        if (mouseovered == d) {
          ctx.fillStyle = 'yellow';
          ctx.globalAlpha = 1
        }

        if (d.depth <= currentDepth + TREEMAP_LEVELS) {
          hover.push(d)
        }

        if (mouseclicked) {
          found.push(d)
        }
      }
      // else if (!full_repaint) {
      //   ctx.restore();
      //   return;
      // }

      // if (d.depth < currentDepth + TREEMAP_LEVELS)
      ctx.fill()

      if (USE_BORDERS) {
        // c.l = luminance(d.depth) + 4
        // ctx.strokeStyle = c
        ctx.strokeStyle = '#eee'
        ctx.stroke()
      }

      // * h
      if (w > 70) { // draw text only on areas > 100 units squared
        ctx.clip();
        ctx.fillStyle = '#333'
        ctx.fillText(d.name + ' ' + format(d.value), x + 3, y)

        // TODO center on box if not directory
      }

      ctx.restore()
    });

    console.timeEnd('each')
    ctx.restore()

    if (BENCH) console.timeEnd('canvas draw');
    if (hover.length)
      mouseovered = hover[hover.length - 1]
      if (mouseovered) {
        updateBreadcrumbs(mouseovered)
        updateSelection(mouseovered)
      }
      mouseclicked = false

    if (found.length) {
      let d = found[hover.length - 1]
      navigateTo( d.children ? d : d.parent )
    }

    full_repaint = false

    // if (zooming)
    next(100)
  }

  function navigateTo(d) {
    if (!d) return
    if (!d.children) return

    full_repaint = true
    console.log('navigate to', d)
    currentDepth = d.depth
    currentNode = d

    zoom(d)

    updateNavigation(keys(d))
    updateBreadcrumbs(currentNode)
  }

  function navigateUp() {
    navigateTo(currentNode.parent)
  }

  // breath first expansion
  function walk(node, a, maxDepth) {
    a = a ? a : [node]

    if (node.depth < maxDepth && node.children) {
      for (var i = 0, len = node.children.length; i < len; i++) {
        var n = node.children[i]
        a.push(n)
        walk(n, a, maxDepth)
      }
    }

    return a
  }

  function zoom(d) {
    if (zooming || !d) return;
    zooming = true;

    log('zoom')

    display(d)

    // TODO transition of 500-750ms

    zooming = false;

    // d3.event.stopPropagation();
  }

  // Export plugin interface
  return {
    generate: generateTreemap,
    navigateUp: navigateUp,
    showLess: showLess,
    showMore: showMore,
    resize: onResize,
    cleanup: function() {
      // TODO
    },
    navigateTo: navigateToPath
  }

}

