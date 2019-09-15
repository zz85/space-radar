// 1K 1e3
// 1MB 1e6
// 1GB 1e9
// 1TB 1e12
// 1PB 1e15

const size_scales = [0, 1e3, 1e5, 1e6, 1e8, 1e9, 1e12, 1e14, 1e15]
const color_range = d3.scale
  .linear()
  .range(['blue', 'red'])
  .interpolate(d3.interpolateLab)



// TODO fix lab deopt.
// https://github.com/colorjs/color-space
// chroma

const hue = d3.scale.category10() // colour hash

const size_color_range = color_range.ticks(size_scales.length - 1).map(v => color_range(v))
const linear = d3.scale.linear()

const size_scale_colors = d3.scale
  .linear()
  .domain(size_scales)
  .clamp(true)
  .range(size_color_range)

const size_luminance = d3.scale
  .linear()
  .domain([0, 1e9])
  .clamp(true)
  .range([90, 50])

const depth_luminance = d3.scale
  .linear() // .sqrt()
  .domain([0, 11])
  .clamp(true)
  .range([75, 96])

const greyScale = d3.scale
  .linear()
  // .range(['white', 'black'])
  .range(['black', 'white'])
  .domain([0, 12])
  .clamp(true)

let colorScheme = global[localStorage.color_extension_scheme] || schemeLsColor
let fill = global[localStorage.color_mode] || colorByProp
// colorByProp // filetypes
// colorBySize // size
// colorByParentName colorful
// colorByParent // children
// byExtension
;(() => {
  const remote = require('electron').remote
  const { app, Menu, MenuItem } = remote

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

  if (process.platform === 'darwin') {
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
    fill = global[type]
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
    colorScheme = global[scheme]
    switchColorMode('colorByProp')
  }

  template.push({
    label: 'Color Options',
    submenu: [
      // { type: 'radio', label: 'Color by Extension', click: () => { switchColorMode('colorByProp') } },
      {
        label: 'Color by Extension',
        submenu: [
          {
            type: 'radio',
            label: 'LS Colors',
            click: () => switchColorScheme('schemeLsColor')
          },
          {
            type: 'radio',
            label: 'Solarized Colors Ansi',
            click: () => switchColorScheme('schemeAnsi')
          },
          {
            type: 'radio',
            label: 'Solarized Colors 256',
            click: () => switchColorScheme('scheme256')
          },
          {
            type: 'radio',
            label: 'Hashed',
            click: () => switchColorScheme('schemeHue')
          }
        ]
      },
      {
        type: 'radio',
        label: 'Colorful Parents',
        click: () => {
          switchColorMode('colorByParentName')
        }
      }, //
      {
        type: 'radio',
        label: 'Color By Size (Blue - Red)',
        click: () => {
          switchColorMode('colorBySize')
        }
      }, //
      {
        type: 'radio',
        label: 'Color By Size (Black - White)',
        click: () => {
          switchColorMode('colorBySizeBw')
        }
      }, //
      {
        type: 'radio',
        label: 'Shades of Parents',
        click: () => {
          switchColorMode('colorByParent')
        }
      }, //
      { type: 'separator' }
      // black and white
    ]
  })

  const menu = Menu.buildFromTemplate(template)
  Menu.setApplicationMenu(menu)

  // var contextMenu = new Menu()
  // var openMenu = new MenuItem({ label: 'Color by Filetypes', click: () => {} })
  // contextMenu.append(openMenu)
  // Menu.setApplicationMenu(contextMenu)
})()

function colorByProp(d) {
  // using color prop
  return d.color
}

const ext_reg = /\.\w+$/

const tmpExtensions = new Set()
const randExt = {}

function schemeHue(ext) {
  if (!randExt[ext]) {
    // use hashes for exploration!
    randExt[ext] = hue(ext)
    // d3.rgb({
    //   r: Math.random() * 256 | 0,
    //   g: Math.random() * 256 | 0,
    //   b: Math.random() * 256 | 0
    // })
  }
  return d3.lab(randExt[ext])
}

function schemeAnsi(ext) {
  if (ext in extension_map_ansi_dark) {
    const { r, g, b } = extension_map_ansi_dark[ext]
    return d3.lab(d3.rgb(r, g, b))
  }
}

function schemeLsColor(ext) {
  if (ext in LS_COLORS) {
    return d3.lab(LS_COLORS[ext])
  }
}

function scheme256(ext) {
  if (ext in extension_map_256_dark) {
    const { r, g, b } = extension_map_256_dark[ext]
    return d3.lab(d3.rgb(r, g, b))
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

function colorBySize(d) {
  const c = d3.lab(size_scale_colors(d.value))
  c.l = size_luminance(d.value)
  return c
}

function colorBySizeBw(d) {
  const c = d3.lab()
  c.l = size_luminance(d.value)
  return c
}

// TODO file size using domain on screen

function colorByParent(d) {
  const p = getParent(d)
  // const c = d3.lab(hue(p.sum)); // size
  // const c = d3.lab(hue(p.count)); // number
  // // var c = d3.lab(hue(p.name)) // parent name
  const c = d3.lab(hue(p.children ? p.children.length : 0))
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
  l = l * 1.03 // adjusts as it diffuses the directory
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

/*
archive = violet, compressed archive = violet + bold
audio = orange, video = orange + bold
*/



// More color references
// https://github.com/d3/d3-scale-chromatic
// http://bl.ocks.org/emmasaunders/52fa83767df27f1fc8b3ee2c6d372c74
