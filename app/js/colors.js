// More color references
// https://github.com/d3/d3-scale-chromatic
// http://bl.ocks.org/emmasaunders/52fa83767df27f1fc8b3ee2c6d372c74

const size_scales = [0, 1e3, 1e5, 1e6, 1e8, 1e9, 1e12, 1e14, 1e15]
// 1K 1e3
// 1MB 1e6
// 1GB 1e9
// 1TB 1e12
// 1PB 1e15

var accent = d3.scaleOrdinal(d3.schemeAccent)
// try multi-hue
const color_range = d3.scale
  .linear()
  .range(['#000004', '#fcffa4'])
  .interpolate(d3.interpolateLab)

// TODO fix lab deopt.
// https://github.com/colorjs/color-space
// chroma

const hue = d3.scale.category10() // legacy palette (used for some schemes)

const size_color_range = color_range.ticks(size_scales.length - 1).map(v => color_range(v))
const linear = d3.scale.linear()

const size_scale_colors = d3.scale
  .linear()
  .domain(size_scales)
  .clamp(true)
  .range(['#000004', '#fcffa4'])

const depth_luminance = d3.scale
  .linear() // .sqrt()
  .domain([0, 11])
  .clamp(true)
  .range([75, 96])

const greyScale = d3.scale
  .linear()
  .range(['black', 'white'])
  .domain([0, 12])
  .clamp(true)

const COLOR_SCHEMES = { schemeCat6: schemeCat6, schemeCat11: schemeCat11, schemeHue: schemeHue }
const COLOR_MODES = {
  colorByProp: colorByProp,
  colorBySizeBw: colorBySizeBw,
  colorBySize: colorBySize,
  colorByParentName: colorByParentName,
  colorByParent: colorByParent
}

let colorScheme = COLOR_SCHEMES[localStorage.color_extension_scheme] || schemeHue
let fill = COLOR_MODES[localStorage.color_mode] || colorByProp
// colorByProp // filetypes
// colorBySize // size
// colorByParentName colorful
// colorByParent // children
// byExtension
;(() => {
  // Avoid deprecated remote; build menu only when available
  let Menu, MenuItem, app
  try {
    const electron = require('electron')
    Menu = electron.Menu
    MenuItem = electron.MenuItem
    app = electron.app
  } catch (e) {}

  const template = [
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'pasteandmatchstyle' },
        { role: 'delete' },
        { role: 'selectall' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forcereload' },
        { role: 'toggledevtools' },
        { type: 'separator' },
        { role: 'resetzoom' },
        { role: 'zoomin' },
        { role: 'zoomout' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      role: 'window',
      submenu: [{ role: 'minimize' }, { role: 'close' }]
    },
    {
      role: 'help',
      submenu: [
        {
          label: 'Learn More',
          click() {
            require('electron').shell.openExternal('https://electron.atom.io')
          }
        }
      ]
    }
  ]

  if (process.platform === 'darwin' && app && typeof app.getName === 'function') {
    template.unshift({
      label: app.getName(),
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'services', submenu: [] },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideothers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    })

    // Edit menu
    template[1].submenu.push(
      { type: 'separator' },
      {
        label: 'Speech',
        submenu: [{ role: 'startspeaking' }, { role: 'stopspeaking' }]
      }
    )

    // Window menu
    template[3].submenu = [
      { role: 'close' },
      { role: 'minimize' },
      { role: 'zoom' },
      { type: 'separator' },
      { role: 'front' }
    ]
  }

  function switchColorMode(type) {
    fill = COLOR_MODES[type] || colorByProp
    localStorage.color_mode = type
    PluginManager.navigateTo(Navigation.currentPath())

    if (PluginManager.data)
      State.showWorking(done => {
        PluginManager.cleanup()
        PluginManager.loadLast()
        done()
      })
  }

  function switchColorScheme(scheme) {
    localStorage.color_extension_scheme = scheme
    colorScheme = COLOR_SCHEMES[scheme] || schemeCat6
    switchColorMode('colorByProp')
  }

  template.push({
    label: 'Color Options',
    submenu: [
      // { type: 'radio', label: 'Color by Extension', click: () => { switchColorMode('colorByProp') } },
      {
        type: 'radio',
        label: 'File extensions - 6 Categories',
        click: () => switchColorScheme('schemeCat6')
      },
      {
        type: 'radio',
        label: 'File extensions - 11 Categories',
        click: () => switchColorScheme('schemeCat11')
      },
      {
        type: 'radio',
        label: 'File extensions - Hashed',
        click: () => switchColorScheme('schemeHue')
      },
      {
        type: 'radio',
        label: 'Root Colors (Original Scheme)',
        click: () => {
          switchColorMode('colorByParent')
        }
      }, //
      {
        type: 'radio',
        label: 'Root Colors (Numbers)',
        click: () => {
          switchColorMode('colorByParentName')
        }
      }, //
      {
        type: 'radio',
        label: 'Color By Size (Greyscale)',
        click: () => {
          switchColorMode('colorBySizeBw')
        }
      }, //
      {
        type: 'radio',
        label: 'Color By Size',
        click: () => {
          switchColorMode('colorBySize')
        }
      }, //
      { type: 'separator' }
      // black and white
    ]
  })

  if (Menu && Menu.buildFromTemplate) {
    const menu = Menu.buildFromTemplate(template)
    try { Menu.setApplicationMenu(menu) } catch (e) {}
  }
})()

function colorByProp(d) {
  // using color prop
  return d.color
}

var ext_reg = /\.\w+$/

const tmpExtensions = new Set()
const randExt = {}

function schemeHue(ext) {
  // Stable rainbow mapping: hash extension -> hue angle
  function hashString(s) {
    let h = 2166136261 >>> 0
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i)
      h = Math.imul(h, 16777619)
    }
    return h >>> 0
  }

  if (!randExt[ext]) {
    const h = hashString(ext) % 360
    const color = d3.hsl(h, 0.65, 0.55) // vivid but readable
    randExt[ext] = color.toString()
  }
  return d3.lab(randExt[ext])
}

function schemeCat6(ext) {
  if (ext in extension_categories_6) {
    return d3.lab(hue(extension_categories_6[ext]))
  }
}

function schemeCat11(ext) {
  if (ext in extension_categories_11) {
    return d3.lab(hue(extension_categories_11[ext]))
  }
}

function byExtension(d, def) {
  const m = ext_reg.exec(d.name)
  const ext = m && m[0]
  if (ext) {
    return colorScheme(ext)
  }

  return def ? null : d3.rgb(0, 0, 0)
}

const size_luminance = d3.scale
  .linear()
  .domain([0, 1e9])
  .clamp(true)
  .range([90, 50])

function colorBySizeBw(d) {
  const c = d3.lab()
  c.l = size_luminance(d.value)
  return c
}

const size_luminance2 = d3.scale
  .linear()
  .domain([0, 1e9])
  .clamp(true)
  .range([50, 90])

function colorBySize(d) {
  const c = d3.lab(size_scale_colors(d.value))
  c.l = size_luminance2(d.value)
  return c
}

// TODO file size using domain on screen

function colorByParent(d) {
  const p = getParent(d)
  // const c = d3.lab(hue(p.sum)); // size
  const c = d3.lab(hue(p.count)) // number
  // const c = d3.lab(hue(p.children ? p.children.length : 0))
  // c.l = luminance(d.value)
  c.l = depth_luminance(d.depth)
  return c
}

function colorByParentName(d) {
  const p = getParent(d)
  const c = d3.lab(hue(p.name))
  c.l = size_luminance(d.sum || d.value)
  return c
}

function getParent(d) {
  let p = d
  while (p.depth > 1) p = p.parent
  return p
}

/*
const _color_cache = new Map()
function color_cache(x) {
  if (!_color_cache.has(x)) {
    _color_cache.set(x, colorScale(x))
  }

  return _color_cache.get(x)
}
*/

function colorWalkNode(node) {
  const color = byExtension(node, true)
  if (color) {
    node.color = color
    return
  }

  const { children } = node
  const len = children && children.length
  if (!children || !len) {
    node.color = d3.lab(80, 0, 0)
    return
  }

  // size is orignal size, sum is calculated including all descendents
  const v = node.sum
  // if (!v) {
  //   node.color = d3.lab(50, 0, 0)
  //   return
  // }

  let l = 0
  let a = 0
  let b = 0

  for (let i = 0; i < len; i++) {
    const child = children[i]
    const color = child.color
    const weight = v
      ? child.sum / v // weighted by size
      : 1 / len // weighted by count

    l = l + color.l * weight
    a = a + color.a * weight
    b = b + color.b * weight
  }

  // darker - saturated cores, lighter - whiter cores
  l = l * 1.05 // adjusts brighter as it diffuses the directory
  // l = l * 0.96
  l = Math.max(Math.min(98, l), 2)

  node.color = d3.lab(l, a, b)
}

function colorByTypes(data) {
  childrenFirst(data, colorWalkNode)
}

function childrenFirst(data, func) {
  const { children } = data
  if (children) {
    children.forEach(v => {
      childrenFirst(v, func)
    })
  }

  func(data)
}
