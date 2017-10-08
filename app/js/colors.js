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

// .range(['purple', 'orange']) // "steelblue", "brown pink orange green", "blue"
// .interpolate(d3.interpolateLab) // interpolateHcl

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

function colorByTypes(data) {
  childrenFirst(data, node => {
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

      l += color.l * weight
      a += color.a * weight
      b += color.b * weight
    }

    // darker - saturated cores, lighter - whiter cores
    l *= 1.03 // adjusts as it diffuses the directory
    l = Math.max(Math.min(98, l), 2)

    node.color = d3.lab(l, a, b)
  })
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

const extension_map_256_dark = {
  '.tar': { r: '108', g: '113', b: '196' },
  '.tgz': { r: '108', g: '113', b: '196' },
  '.arj': { r: '108', g: '113', b: '196' },
  '.taz': { r: '108', g: '113', b: '196' },
  '.lzh': { r: '108', g: '113', b: '196' },
  '.lzma': { r: '108', g: '113', b: '196' },
  '.tlz': { r: '108', g: '113', b: '196' },
  '.txz': { r: '108', g: '113', b: '196' },
  '.zip': { r: '108', g: '113', b: '196' },
  '.z': { r: '108', g: '113', b: '196' },
  '.Z': { r: '108', g: '113', b: '196' },
  '.dz': { r: '108', g: '113', b: '196' },
  '.gz': { r: '108', g: '113', b: '196' },
  '.lz': { r: '108', g: '113', b: '196' },
  '.xz': { r: '108', g: '113', b: '196' },
  '.bz2': { r: '108', g: '113', b: '196' },
  '.bz': { r: '108', g: '113', b: '196' },
  '.tbz': { r: '108', g: '113', b: '196' },
  '.tbz2': { r: '108', g: '113', b: '196' },
  '.tz': { r: '108', g: '113', b: '196' },
  '.deb': { r: '108', g: '113', b: '196' },
  '.rpm': { r: '108', g: '113', b: '196' },
  '.jar': { r: '108', g: '113', b: '196' },
  '.rar': { r: '108', g: '113', b: '196' },
  '.ace': { r: '108', g: '113', b: '196' },
  '.zoo': { r: '108', g: '113', b: '196' },
  '.cpio': { r: '108', g: '113', b: '196' },
  '.7z': { r: '108', g: '113', b: '196' },
  '.rz': { r: '108', g: '113', b: '196' },
  '.apk': { r: '108', g: '113', b: '196' },
  '.gem': { r: '108', g: '113', b: '196' },
  '.jpg': { r: '181', g: '137', b: '0' },
  '.JPG': { r: '181', g: '137', b: '0' },
  '.jpeg': { r: '181', g: '137', b: '0' },
  '.gif': { r: '181', g: '137', b: '0' },
  '.bmp': { r: '181', g: '137', b: '0' },
  '.pbm': { r: '181', g: '137', b: '0' },
  '.pgm': { r: '181', g: '137', b: '0' },
  '.ppm': { r: '181', g: '137', b: '0' },
  '.tga': { r: '181', g: '137', b: '0' },
  '.xbm': { r: '181', g: '137', b: '0' },
  '.xpm': { r: '181', g: '137', b: '0' },
  '.tif': { r: '181', g: '137', b: '0' },
  '.tiff': { r: '181', g: '137', b: '0' },
  '.png': { r: '181', g: '137', b: '0' },
  '.PNG': { r: '181', g: '137', b: '0' },
  '.svg': { r: '181', g: '137', b: '0' },
  '.svgz': { r: '181', g: '137', b: '0' },
  '.mng': { r: '181', g: '137', b: '0' },
  '.pcx': { r: '181', g: '137', b: '0' },
  '.dl': { r: '181', g: '137', b: '0' },
  '.xcf': { r: '181', g: '137', b: '0' },
  '.xwd': { r: '181', g: '137', b: '0' },
  '.yuv': { r: '181', g: '137', b: '0' },
  '.cgm': { r: '181', g: '137', b: '0' },
  '.emf': { r: '181', g: '137', b: '0' },
  '.eps': { r: '181', g: '137', b: '0' },
  '.CR2': { r: '181', g: '137', b: '0' },
  '.ico': { r: '181', g: '137', b: '0' },
  '.tex': { r: '147', g: '161', b: '161' },
  '.rdf': { r: '147', g: '161', b: '161' },
  '.owl': { r: '147', g: '161', b: '161' },
  '.n3': { r: '147', g: '161', b: '161' },
  '.ttl': { r: '147', g: '161', b: '161' },
  '.nt': { r: '147', g: '161', b: '161' },
  '.torrent': { r: '147', g: '161', b: '161' },
  '.xml': { r: '147', g: '161', b: '161' },
  '*Makefile': { r: '147', g: '161', b: '161' },
  '*Rakefile': { r: '147', g: '161', b: '161' },
  '*Dockerfile': { r: '147', g: '161', b: '161' },
  '*build.xml': { r: '147', g: '161', b: '161' },
  '*rc': { r: '147', g: '161', b: '161' },
  '*1': { r: '147', g: '161', b: '161' },
  '.nfo': { r: '147', g: '161', b: '161' },
  '*README': { r: '147', g: '161', b: '161' },
  '*README.txt': { r: '147', g: '161', b: '161' },
  '*readme.txt': { r: '147', g: '161', b: '161' },
  '.md': { r: '147', g: '161', b: '161' },
  '*README.markdown': { r: '147', g: '161', b: '161' },
  '.ini': { r: '147', g: '161', b: '161' },
  '.yml': { r: '147', g: '161', b: '161' },
  '.cfg': { r: '147', g: '161', b: '161' },
  '.conf': { r: '147', g: '161', b: '161' },
  '.h': { r: '147', g: '161', b: '161' },
  '.hpp': { r: '147', g: '161', b: '161' },
  '.c': { r: '147', g: '161', b: '161' },
  '.cpp': { r: '147', g: '161', b: '161' },
  '.cxx': { r: '147', g: '161', b: '161' },
  '.cc': { r: '147', g: '161', b: '161' },
  '.objc': { r: '147', g: '161', b: '161' },
  '.sqlite': { r: '147', g: '161', b: '161' },
  '.go': { r: '147', g: '161', b: '161' },
  '.sql': { r: '147', g: '161', b: '161' },
  '.csv': { r: '147', g: '161', b: '161' },
  '.log': { r: '88', g: '110', b: '117' },
  '.bak': { r: '88', g: '110', b: '117' },
  '.aux': { r: '88', g: '110', b: '117' },
  '.lof': { r: '88', g: '110', b: '117' },
  '.lol': { r: '88', g: '110', b: '117' },
  '.lot': { r: '88', g: '110', b: '117' },
  '.out': { r: '88', g: '110', b: '117' },
  '.toc': { r: '88', g: '110', b: '117' },
  '.bbl': { r: '88', g: '110', b: '117' },
  '.blg': { r: '88', g: '110', b: '117' },
  '*': { r: '88', g: '110', b: '117' },
  '.part': { r: '88', g: '110', b: '117' },
  '.incomplete': { r: '88', g: '110', b: '117' },
  '.swp': { r: '88', g: '110', b: '117' },
  '.tmp': { r: '88', g: '110', b: '117' },
  '.temp': { r: '88', g: '110', b: '117' },
  '.o': { r: '88', g: '110', b: '117' },
  '.pyc': { r: '88', g: '110', b: '117' },
  '.class': { r: '88', g: '110', b: '117' },
  '.cache': { r: '88', g: '110', b: '117' },
  '.aac': { r: '203', g: '75', b: '22' },
  '.au': { r: '203', g: '75', b: '22' },
  '.flac': { r: '203', g: '75', b: '22' },
  '.mid': { r: '203', g: '75', b: '22' },
  '.midi': { r: '203', g: '75', b: '22' },
  '.mka': { r: '203', g: '75', b: '22' },
  '.mp3': { r: '203', g: '75', b: '22' },
  '.mpc': { r: '203', g: '75', b: '22' },
  '.ogg': { r: '203', g: '75', b: '22' },
  '.opus': { r: '203', g: '75', b: '22' },
  '.ra': { r: '203', g: '75', b: '22' },
  '.wav': { r: '203', g: '75', b: '22' },
  '.m4a': { r: '203', g: '75', b: '22' },
  '.axa': { r: '203', g: '75', b: '22' },
  '.oga': { r: '203', g: '75', b: '22' },
  '.spx': { r: '203', g: '75', b: '22' },
  '.xspf': { r: '203', g: '75', b: '22' },
  '.mov': { r: '203', g: '75', b: '22' },
  '.MOV': { r: '203', g: '75', b: '22' },
  '.mpg': { r: '203', g: '75', b: '22' },
  '.mpeg': { r: '203', g: '75', b: '22' },
  '.m2v': { r: '203', g: '75', b: '22' },
  '.mkv': { r: '203', g: '75', b: '22' },
  '.ogm': { r: '203', g: '75', b: '22' },
  '.mp4': { r: '203', g: '75', b: '22' },
  '.m4v': { r: '203', g: '75', b: '22' },
  '.mp4v': { r: '203', g: '75', b: '22' },
  '.vob': { r: '203', g: '75', b: '22' },
  '.qt': { r: '203', g: '75', b: '22' },
  '.nuv': { r: '203', g: '75', b: '22' },
  '.wmv': { r: '203', g: '75', b: '22' },
  '.asf': { r: '203', g: '75', b: '22' },
  '.rm': { r: '203', g: '75', b: '22' },
  '.rmvb': { r: '203', g: '75', b: '22' },
  '.flc': { r: '203', g: '75', b: '22' },
  '.avi': { r: '203', g: '75', b: '22' },
  '.fli': { r: '203', g: '75', b: '22' },
  '.flv': { r: '203', g: '75', b: '22' },
  '.gl': { r: '203', g: '75', b: '22' },
  '.m2ts': { r: '203', g: '75', b: '22' },
  '.divx': { r: '203', g: '75', b: '22' },
  '.webm': { r: '203', g: '75', b: '22' },
  '.axv': { r: '203', g: '75', b: '22' },
  '.anx': { r: '203', g: '75', b: '22' },
  '.ogv': { r: '203', g: '75', b: '22' },
  '.ogx': { r: '203', g: '75', b: '22' }
}

const extension_map_ansi_dark = {
  '.txt': { r: '133', g: '153', b: '0' },
  '.org': { r: '133', g: '153', b: '0' },
  '.md': { r: '133', g: '153', b: '0' },
  '.mkd': { r: '133', g: '153', b: '0' },
  '.h': { r: '133', g: '153', b: '0' },
  '.hpp': { r: '133', g: '153', b: '0' },
  '.c': { r: '133', g: '153', b: '0' },
  '.C': { r: '133', g: '153', b: '0' },
  '.cc': { r: '133', g: '153', b: '0' },
  '.cpp': { r: '133', g: '153', b: '0' },
  '.cxx': { r: '133', g: '153', b: '0' },
  '.objc': { r: '133', g: '153', b: '0' },
  '.cl': { r: '133', g: '153', b: '0' },
  '.sh': { r: '133', g: '153', b: '0' },
  '.bash': { r: '133', g: '153', b: '0' },
  '.csh': { r: '133', g: '153', b: '0' },
  '.zsh': { r: '133', g: '153', b: '0' },
  '.el': { r: '133', g: '153', b: '0' },
  '.vim': { r: '133', g: '153', b: '0' },
  '.java': { r: '133', g: '153', b: '0' },
  '.pl': { r: '133', g: '153', b: '0' },
  '.pm': { r: '133', g: '153', b: '0' },
  '.py': { r: '133', g: '153', b: '0' },
  '.rb': { r: '133', g: '153', b: '0' },
  '.hs': { r: '133', g: '153', b: '0' },
  '.php': { r: '133', g: '153', b: '0' },
  '.htm': { r: '133', g: '153', b: '0' },
  '.html': { r: '133', g: '153', b: '0' },
  '.shtml': { r: '133', g: '153', b: '0' },
  '.erb': { r: '133', g: '153', b: '0' },
  '.haml': { r: '133', g: '153', b: '0' },
  '.xml': { r: '133', g: '153', b: '0' },
  '.rdf': { r: '133', g: '153', b: '0' },
  '.css': { r: '133', g: '153', b: '0' },
  '.sass': { r: '133', g: '153', b: '0' },
  '.scss': { r: '133', g: '153', b: '0' },
  '.less': { r: '133', g: '153', b: '0' },
  '.js': { r: '133', g: '153', b: '0' },
  '.coffee': { r: '133', g: '153', b: '0' },
  '.man': { r: '133', g: '153', b: '0' },
  '.0': { r: '133', g: '153', b: '0' },
  '.1': { r: '133', g: '153', b: '0' },
  '.2': { r: '133', g: '153', b: '0' },
  '.3': { r: '133', g: '153', b: '0' },
  '.4': { r: '133', g: '153', b: '0' },
  '.5': { r: '133', g: '153', b: '0' },
  '.6': { r: '133', g: '153', b: '0' },
  '.7': { r: '133', g: '153', b: '0' },
  '.8': { r: '133', g: '153', b: '0' },
  '.9': { r: '133', g: '153', b: '0' },
  '.l': { r: '133', g: '153', b: '0' },
  '.n': { r: '133', g: '153', b: '0' },
  '.p': { r: '133', g: '153', b: '0' },
  '.pod': { r: '133', g: '153', b: '0' },
  '.tex': { r: '133', g: '153', b: '0' },
  '.go': { r: '133', g: '153', b: '0' },
  '.sql': { r: '133', g: '153', b: '0' },
  '.csv': { r: '133', g: '153', b: '0' },
  '.sv': { r: '133', g: '153', b: '0' },
  '.svh': { r: '133', g: '153', b: '0' },
  '.v': { r: '133', g: '153', b: '0' },
  '.vh': { r: '133', g: '153', b: '0' },
  '.vhd': { r: '133', g: '153', b: '0' },
  '.bmp': { r: '181', g: '137', b: '0' },
  '.cgm': { r: '181', g: '137', b: '0' },
  '.dl': { r: '181', g: '137', b: '0' },
  '.dvi': { r: '181', g: '137', b: '0' },
  '.emf': { r: '181', g: '137', b: '0' },
  '.eps': { r: '181', g: '137', b: '0' },
  '.gif': { r: '181', g: '137', b: '0' },
  '.jpeg': { r: '181', g: '137', b: '0' },
  '.jpg': { r: '181', g: '137', b: '0' },
  '.JPG': { r: '181', g: '137', b: '0' },
  '.mng': { r: '181', g: '137', b: '0' },
  '.pbm': { r: '181', g: '137', b: '0' },
  '.pcx': { r: '181', g: '137', b: '0' },
  '.pdf': { r: '181', g: '137', b: '0' },
  '.pgm': { r: '181', g: '137', b: '0' },
  '.png': { r: '181', g: '137', b: '0' },
  '.PNG': { r: '181', g: '137', b: '0' },
  '.ppm': { r: '181', g: '137', b: '0' },
  '.pps': { r: '181', g: '137', b: '0' },
  '.ppsx': { r: '181', g: '137', b: '0' },
  '.ps': { r: '181', g: '137', b: '0' },
  '.svg': { r: '181', g: '137', b: '0' },
  '.svgz': { r: '181', g: '137', b: '0' },
  '.tga': { r: '181', g: '137', b: '0' },
  '.tif': { r: '181', g: '137', b: '0' },
  '.tiff': { r: '181', g: '137', b: '0' },
  '.xbm': { r: '181', g: '137', b: '0' },
  '.xcf': { r: '181', g: '137', b: '0' },
  '.xpm': { r: '181', g: '137', b: '0' },
  '.xwd': { r: '181', g: '137', b: '0' },
  '.yuv': { r: '181', g: '137', b: '0' },
  '.aac': { r: '181', g: '137', b: '0' },
  '.au': { r: '181', g: '137', b: '0' },
  '.flac': { r: '181', g: '137', b: '0' },
  '.m4a': { r: '181', g: '137', b: '0' },
  '.mid': { r: '181', g: '137', b: '0' },
  '.midi': { r: '181', g: '137', b: '0' },
  '.mka': { r: '181', g: '137', b: '0' },
  '.mp3': { r: '181', g: '137', b: '0' },
  '.mpa': { r: '181', g: '137', b: '0' },
  '.mpeg': { r: '181', g: '137', b: '0' },
  '.mpg': { r: '181', g: '137', b: '0' },
  '.ogg': { r: '181', g: '137', b: '0' },
  '.opus': { r: '181', g: '137', b: '0' },
  '.ra': { r: '181', g: '137', b: '0' },
  '.wav': { r: '181', g: '137', b: '0' },
  '.anx': { r: '181', g: '137', b: '0' },
  '.asf': { r: '181', g: '137', b: '0' },
  '.avi': { r: '181', g: '137', b: '0' },
  '.axv': { r: '181', g: '137', b: '0' },
  '.flc': { r: '181', g: '137', b: '0' },
  '.fli': { r: '181', g: '137', b: '0' },
  '.flv': { r: '181', g: '137', b: '0' },
  '.gl': { r: '181', g: '137', b: '0' },
  '.m2v': { r: '181', g: '137', b: '0' },
  '.m4v': { r: '181', g: '137', b: '0' },
  '.mkv': { r: '181', g: '137', b: '0' },
  '.mov': { r: '181', g: '137', b: '0' },
  '.MOV': { r: '181', g: '137', b: '0' },
  '.mp4': { r: '181', g: '137', b: '0' },
  '.mp4v': { r: '181', g: '137', b: '0' },
  '.nuv': { r: '181', g: '137', b: '0' },
  '.ogm': { r: '181', g: '137', b: '0' },
  '.ogv': { r: '181', g: '137', b: '0' },
  '.ogx': { r: '181', g: '137', b: '0' },
  '.qt': { r: '181', g: '137', b: '0' },
  '.rm': { r: '181', g: '137', b: '0' },
  '.rmvb': { r: '181', g: '137', b: '0' },
  '.swf': { r: '181', g: '137', b: '0' },
  '.vob': { r: '181', g: '137', b: '0' },
  '.webm': { r: '181', g: '137', b: '0' },
  '.wmv': { r: '181', g: '137', b: '0' },
  '.doc': { r: '220', g: '50', b: '47' },
  '.docx': { r: '220', g: '50', b: '47' },
  '.rtf': { r: '220', g: '50', b: '47' },
  '.odt': { r: '220', g: '50', b: '47' },
  '.dot': { r: '220', g: '50', b: '47' },
  '.dotx': { r: '220', g: '50', b: '47' },
  '.ott': { r: '220', g: '50', b: '47' },
  '.xls': { r: '220', g: '50', b: '47' },
  '.xlsx': { r: '220', g: '50', b: '47' },
  '.ods': { r: '220', g: '50', b: '47' },
  '.ots': { r: '220', g: '50', b: '47' },
  '.ppt': { r: '220', g: '50', b: '47' },
  '.pptx': { r: '220', g: '50', b: '47' },
  '.odp': { r: '220', g: '50', b: '47' },
  '.otp': { r: '220', g: '50', b: '47' },
  '.fla': { r: '220', g: '50', b: '47' },
  '.psd': { r: '220', g: '50', b: '47' },
  '.7z': { r: '211', g: '54', b: '130' },
  '.apk': { r: '211', g: '54', b: '130' },
  '.arj': { r: '211', g: '54', b: '130' },
  '.bin': { r: '211', g: '54', b: '130' },
  '.bz': { r: '211', g: '54', b: '130' },
  '.bz2': { r: '211', g: '54', b: '130' },
  '.cab': { r: '211', g: '54', b: '130' },
  '.deb': { r: '211', g: '54', b: '130' },
  '.dmg': { r: '211', g: '54', b: '130' },
  '.gem': { r: '211', g: '54', b: '130' },
  '.gz': { r: '211', g: '54', b: '130' },
  '.iso': { r: '211', g: '54', b: '130' },
  '.jar': { r: '211', g: '54', b: '130' },
  '.msi': { r: '211', g: '54', b: '130' },
  '.rar': { r: '211', g: '54', b: '130' },
  '.rpm': { r: '211', g: '54', b: '130' },
  '.tar': { r: '211', g: '54', b: '130' },
  '.tbz': { r: '211', g: '54', b: '130' },
  '.tbz2': { r: '211', g: '54', b: '130' },
  '.tgz': { r: '211', g: '54', b: '130' },
  '.tx': { r: '211', g: '54', b: '130' },
  '.war': { r: '211', g: '54', b: '130' },
  '.xpi': { r: '211', g: '54', b: '130' },
  '.xz': { r: '211', g: '54', b: '130' },
  '.z': { r: '211', g: '54', b: '130' },
  '.Z': { r: '211', g: '54', b: '130' },
  '.zip': { r: '211', g: '54', b: '130' },
  '.ANSI-30-black': { r: '7', g: '54', b: '66' },
  '.ANSI-01;30-brblack': { r: '7', g: '54', b: '66' },
  '.ANSI-31-red': { r: '220', g: '50', b: '47' },
  '.ANSI-01;31-brred': { r: '220', g: '50', b: '47' },
  '.ANSI-32-green': { r: '133', g: '153', b: '0' },
  '.ANSI-01;32-brgreen': { r: '133', g: '153', b: '0' },
  '.ANSI-33-yellow': { r: '181', g: '137', b: '0' },
  '.ANSI-01;33-bryellow': { r: '181', g: '137', b: '0' },
  '.ANSI-34-blue': { r: '38', g: '139', b: '210' },
  '.ANSI-01;34-brblue': { r: '38', g: '139', b: '210' },
  '.ANSI-35-magenta': { r: '211', g: '54', b: '130' },
  '.ANSI-01;35-brmagenta': { r: '211', g: '54', b: '130' },
  '.ANSI-36-cyan': { r: '42', g: '161', b: '152' },
  '.ANSI-01;36-brcyan': { r: '42', g: '161', b: '152' },
  '.ANSI-37-white': { r: '238', g: '232', b: '213' },
  '.ANSI-01;37-brwhite': { r: '238', g: '232', b: '213' },
  '.log': { r: '133', g: '153', b: '0' },
  '*~': { r: '133', g: '153', b: '0' },
  '*#': { r: '133', g: '153', b: '0' },
  '.bak': { r: '181', g: '137', b: '0' },
  '.BAK': { r: '181', g: '137', b: '0' },
  '.old': { r: '181', g: '137', b: '0' },
  '.OLD': { r: '181', g: '137', b: '0' },
  '.org_archive': { r: '181', g: '137', b: '0' },
  '.off': { r: '181', g: '137', b: '0' },
  '.OFF': { r: '181', g: '137', b: '0' },
  '.dist': { r: '181', g: '137', b: '0' },
  '.DIST': { r: '181', g: '137', b: '0' },
  '.orig': { r: '181', g: '137', b: '0' },
  '.ORIG': { r: '181', g: '137', b: '0' },
  '.swp': { r: '181', g: '137', b: '0' },
  '.swo': { r: '181', g: '137', b: '0' },
  '*,v': { r: '181', g: '137', b: '0' },
  '.gpg': { r: '38', g: '139', b: '210' },
  '.pgp': { r: '38', g: '139', b: '210' },
  '.asc': { r: '38', g: '139', b: '210' },
  '.3des': { r: '38', g: '139', b: '210' },
  '.aes': { r: '38', g: '139', b: '210' },
  '.enc': { r: '38', g: '139', b: '210' },
  '.sqlite': { r: '38', g: '139', b: '210' }
}

const LS_COLORS = {
  '*README': '#ffd700',
  '*README.rst': '#ffd700',
  '*LICENSE': '#ffd700',
  '*COPYING': '#ffd700',
  '*INSTALL': '#ffd700',
  '*COPYRIGHT': '#ffd700',
  '*AUTHORS': '#ffd700',
  '*HISTORY': '#ffd700',
  '*CONTRIBUTORS': '#ffd700',
  '*PATENTS': '#ffd700',
  '*VERSION': '#ffd700',
  '*NOTICE': '#ffd700',
  '*CHANGES': '#ffd700',
  '.log': '#d7ff00',
  '.txt': '#dadada',
  '.etx': '#d7d700',
  '.info': '#d7d700',
  '.markdown': '#d7d700',
  '.md': '#d7d700',
  '.mkd': '#d7d700',
  '.nfo': '#d7d700',
  '.pod': '#c0c0c0',
  '.tex': '#d7d700',
  '.textile': '#d7d700',
  '.json': '#d7af00',
  '.msg': '#d7af00',
  '.pgn': '#d7af00',
  '.rss': '#d7af00',
  '.xml': '#d7af00',
  '.yaml': '#d7af00',
  '.yml': '#d7af00',
  '.RData': '#d7af00',
  '.rdata': '#d7af00',
  '.cbr': '#af87ff',
  '.cbz': '#af87ff',
  '.chm': '#af87ff',
  '.djvu': '#af87ff',
  '.pdf': '#af87ff',
  '.PDF': '#af87ff',
  '.docm': '#87afff',
  '.doc': '#87afff',
  '.docx': '#87afff',
  '.eps': '#875fff',
  '.ps': '#875fff',
  '.odb': '#87afff',
  '.odt': '#87afff',
  '.rtf': '#87afff',
  '.odp': '#d75f00',
  '.pps': '#d75f00',
  '.ppt': '#d75f00',
  '.pptx': '#d75f00',
  '.ppts': '#d75f00',
  '.pptxm': '#d75f00',
  '.pptsm': '#d75f00',
  '.csv': '#5fd787',
  '.ods': '#87d700',
  '.xla': '#5fd700',
  '.xls': '#87d700',
  '.xlsx': '#87d700',
  '.xlsxm': '#87d700',
  '.xltm': '#5fafaf',
  '.xltx': '#5fafaf',
  '*cfg': '#800000',
  '*conf': '#800000',
  '*rc': '#800000',
  '.ini': '#800000',
  '.plist': '#800000',
  '.viminfo': '#800000',
  '.pcf': '#800000',
  '.psf': '#800000',
  '.git': '#ff005f',
  '.gitignore': '#585858',
  '.gitattributes': '#585858',
  '.gitmodules': '#585858',
  '.awk': '#d78700',
  '.bash': '#d78700',
  '.bat': '#d78700',
  '.BAT': '#d78700',
  '.sed': '#d78700',
  '.sh': '#d78700',
  '.zsh': '#d78700',
  '.vim': '#d78700',
  '.ahk': '#00d75f',
  '.py': '#00d75f',
  '.pl': '#ff8700',
  '.PL': '#d70000',
  '.t': '#c0c0c0',
  '.msql': '#ffd787',
  '.mysql': '#ffd787',
  '.pgsql': '#ffd787',
  '.sql': '#ffd787',
  '.tcl': '#5f8700',
  '.r': '#00ffaf',
  '.R': '#00ffaf',
  '.gs': '#5fd7ff',
  '.asm': '#5fd7ff',
  '.cl': '#5fd7ff',
  '.lisp': '#5fd7ff',
  '.lua': '#5fd7ff',
  '.moon': '#5fd7ff',
  '.c': '#5fd7ff',
  '.C': '#5fd7ff',
  '.h': '#87afd7',
  '.H': '#87afd7',
  '.tcc': '#87afd7',
  '.c++': '#5fd7ff',
  '.h++': '#87afd7',
  '.hpp': '#87afd7',
  '.hxx': '#87afd7',
  '.ii': '#87afd7',
  '.M': '#87afd7',
  '.m': '#87afd7',
  '.cc': '#5fd7ff',
  '.cs': '#5fd7ff',
  '.cp': '#5fd7ff',
  '.cpp': '#5fd7ff',
  '.cxx': '#5fd7ff',
  '.cr': '#5fd7ff',
  '.go': '#5fd7ff',
  '.f': '#5fd7ff',
  '.for': '#5fd7ff',
  '.ftn': '#5fd7ff',
  '.s': '#87afd7',
  '.S': '#87afd7',
  '.rs': '#5fd7ff',
  '.swift': '#ffafff',
  '.sx': '#5fd7ff',
  '.hi': '#87afd7',
  '.hs': '#5fd7ff',
  '.lhs': '#5fd7ff',
  '.pyc': '#585858',
  '.css': '#af005f',
  '.less': '#af005f',
  '.sass': '#af005f',
  '.scss': '#af005f',
  '.htm': '#af005f',
  '.html': '#af005f',
  '.jhtm': '#af005f',
  '.mht': '#af005f',
  '.eml': '#af005f',
  '.mustache': '#af005f',
  '.coffee': '#undefined',
  '.java': '#undefined',
  '.js': '#undefined',
  '.jsm': '#undefined',
  '.jsp': '#undefined',
  '.php': '#5fd7ff',
  '.ctp': '#5fd7ff',
  '.twig': '#5fd7ff',
  '.vb': '#5fd7ff',
  '.vba': '#5fd7ff',
  '.vbs': '#5fd7ff',
  '*Dockerfile': '#afff5f',
  '.dockerignore': '#585858',
  '*Makefile': '#afff5f',
  '*MANIFEST': '#767676',
  '*pm_to_blib': '#585858',
  '.am': '#666666',
  '.in': '#666666',
  '.hin': '#666666',
  '.scan': '#666666',
  '.m4': '#666666',
  '.old': '#666666',
  '.out': '#666666',
  '.SKIP': '#808080',
  '.diff': '#ff005f',
  '.patch': '#ff005f',
  '.bmp': '#875faf',
  '.tiff': '#875faf',
  '.tif': '#875faf',
  '.TIFF': '#875faf',
  '.cdr': '#875faf',
  '.gif': '#875faf',
  '.ico': '#875faf',
  '.jpeg': '#875faf',
  '.JPG': '#875faf',
  '.jpg': '#875faf',
  '.nth': '#875faf',
  '.png': '#875faf',
  '.psd': '#875faf',
  '.xpm': '#875faf',
  '.ai': '#875fff',
  '.epsf': '#875fff',
  '.drw': '#875fff',
  '.svg': '#875fff',
  '.avi': '#87d787',
  '.divx': '#87d787',
  '.IFO': '#87d787',
  '.m2v': '#87d787',
  '.m4v': '#87d787',
  '.mkv': '#87d787',
  '.MOV': '#87d787',
  '.mov': '#87d787',
  '.mp4': '#87d787',
  '.mpeg': '#87d787',
  '.mpg': '#87d787',
  '.ogm': '#87d787',
  '.rmvb': '#87d787',
  '.sample': '#87d787',
  '.wmv': '#87d787',
  'mobile/streaming': '#008000',
  '.3g2': '#87d7af',
  '.3gp': '#87d7af',
  '.gp3': '#87d7af',
  '.webm': '#87d7af',
  '.gp4': '#87d7af',
  '.asf': '#87d7af',
  '.flv': '#87d7af',
  '.ts': '#87d7af',
  '.ogv': '#87d7af',
  '.f4v': '#87d7af',
  lossless: '#008000',
  '.VOB': '#87d7af',
  '.vob': '#87d7af',
  '.3ga': '#af875f',
  '.S3M': '#af875f',
  '.aac': '#af875f',
  '.au': '#af875f',
  '.dat': '#af875f',
  '.dts': '#af875f',
  '.fcm': '#af875f',
  '.m4a': '#af875f',
  '.mid': '#af875f',
  '.midi': '#af8700',
  '.mod': '#af875f',
  '.mp3': '#af875f',
  '.mp4a': '#af875f',
  '.oga': '#af875f',
  '.ogg': '#af875f',
  '.opus': '#af875f',
  '.s3m': '#af875f',
  '.sid': '#af875f',
  '.wma': '#af875f',
  '.ape': '#af8700',
  '.aiff': '#af8700',
  '.cda': '#af8700',
  '.flac': '#af8700',
  '.alac': '#af8700',
  '.pcm': '#af8700',
  '.wav': '#af8700',
  '.wv': '#af8700',
  '.wvc': '#af8700',
  '.afm': '#5f8787',
  '.fon': '#5f8787',
  '.fnt': '#5f8787',
  '.pfb': '#5f8787',
  '.pfm': '#5f8787',
  '.ttf': '#5f8787',
  '.otf': '#5f8787',
  '.PFA': '#5f8787',
  '.pfa': '#5f8787',
  '.7z': '#00d700',
  '.a': '#00d700',
  '.arj': '#00d700',
  '.bz2': '#00d700',
  '.cpio': '#00d700',
  '.gz': '#00d700',
  '.lrz': '#00d700',
  '.lz': '#00d700',
  '.lzma': '#00d700',
  '.lzo': '#00d700',
  '.rar': '#00d700',
  '.s7z': '#00d700',
  '.sz': '#00d700',
  '.tar': '#00d700',
  '.tgz': '#00d700',
  '.xz': '#00d700',
  '.z': '#00d700',
  '.Z': '#00d700',
  '.zip': '#00d700',
  '.zipx': '#00d700',
  '.zoo': '#00d700',
  '.zpaq': '#00d700',
  '.zz': '#00d700',
  apps: '#008000',
  '.apk': '#ffaf5f',
  '.deb': '#ffaf5f',
  '.rpm': '#ffaf5f',
  '.jad': '#ffaf5f',
  '.jar': '#ffaf5f',
  '.cab': '#ffaf5f',
  '.pak': '#ffaf5f',
  '.pk3': '#ffaf5f',
  '.vdf': '#ffaf5f',
  '.vpk': '#ffaf5f',
  '.bsp': '#ffaf5f',
  '.dmg': '#af0000',
  from: '#000000',
  '.r[0-9]{0,2}': '#4e4e4e',
  '.zx[0-9]{0,2}': '#4e4e4e',
  '.z[0-9]{0,2}': '#4e4e4e',
  '.part': '#4e4e4e',
  '.iso': '#af0000',
  '.bin': '#af0000',
  '.nrg': '#af0000',
  '.qcow': '#af0000',
  '.sparseimage': '#af0000',
  '.toast': '#af0000',
  '.vcd': '#af0000',
  '.vmdk': '#af0000',
  '.accdb': '#5f5f87',
  '.accde': '#5f5f87',
  '.accdr': '#5f5f87',
  '.accdt': '#5f5f87',
  '.db': '#5f5f87',
  '.fmp12': '#5f5f87',
  '.fp7': '#5f5f87',
  '.localstorage': '#5f5f87',
  '.mdb': '#5f5f87',
  '.mde': '#5f5f87',
  '.sqlite': '#5f5f87',
  '.typelib': '#5f5f87',
  '.nc': '#5f5f87',
  '.pacnew': '#0087ff',
  '.un~': '#606060',
  '.orig': '#606060',
  '.BUP': '#606060',
  '.bak': '#606060',
  '.o': '#606060',
  '.rlib': '#606060',
  '.swp': '#808080',
  '.swo': '#808080',
  '.tmp': '#808080',
  '.sassc': '#808080',
  '.pid': '#a8a8a8',
  '.state': '#a8a8a8',
  '*lockfile': '#a8a8a8',
  '.err': '#d70000',
  '.error': '#d70000',
  '.stderr': '#d70000',
  '.dump': '#606060',
  '.stackdump': '#606060',
  '.zcompdump': '#606060',
  '.zwc': '#606060',
  '.pcap': '#00875f',
  '.cap': '#00875f',
  '.dmp': '#00875f',
  '.DS_Store': '#4e4e4e',
  '.localized': '#4e4e4e',
  '.CFUserTextEncoding': '#4e4e4e',
  '.allow': '#87d700',
  '.deny': '#ff0000',
  '.service': '#00d7ff',
  '*@.service': '#00d7ff',
  '.socket': '#00d7ff',
  '.swap': '#00d7ff',
  '.device': '#00d7ff',
  '.mount': '#00d7ff',
  '.automount': '#00d7ff',
  '.target': '#00d7ff',
  '.path': '#00d7ff',
  '.timer': '#00d7ff',
  '.snapshot': '#00d7ff',
  '.application': '#87d7d7',
  '.cue': '#87d7d7',
  '.description': '#87d7d7',
  '.directory': '#87d7d7',
  '.m3u': '#87d7d7',
  '.m3u8': '#87d7d7',
  '.md5': '#87d7d7',
  '.properties': '#87d7d7',
  '.sfv': '#87d7d7',
  '.srt': '#87d7d7',
  '.theme': '#87d7d7',
  '.torrent': '#87d7d7',
  '.urlview': '#87d7d7',
  '.asc': '#d7ff87',
  '.bfe': '#d7ff87',
  '.enc': '#d7ff87',
  '.gpg': '#d7ff87',
  '.signature': '#d7ff87',
  '.sig': '#d7ff87',
  '.p12': '#d7ff87',
  '.pem': '#d7ff87',
  '.pgp': '#d7ff87',
  '.32x': '#ff87ff',
  '.cdi': '#ff87ff',
  '.fm2': '#ff87ff',
  '.rom': '#ff87ff',
  '.sav': '#ff87ff',
  '.st': '#ff87ff',
  '.a00': '#ff87ff',
  '.a52': '#ff87ff',
  '.A64': '#ff87ff',
  '.a64': '#ff87ff',
  '.a78': '#ff87ff',
  '.adf': '#ff87ff',
  '.atr': '#ff87ff',
  '.gb': '#ff87ff',
  '.gba': '#ff87ff',
  '.gbc': '#ff87ff',
  '.gel': '#ff87ff',
  '.gg': '#ff87ff',
  '.ggl': '#ff87ff',
  '.ipk': '#ff87ff',
  '.j64': '#ff87ff',
  '.nds': '#ff87ff',
  '.nes': '#ff87ff',
  '.sms': '#ff87ff',
  '.pot': '#c0c0c0',
  '.pcb': '#c0c0c0',
  '.mm': '#c0c0c0',
  '.gbr': '#c0c0c0',
  '.spl': '#c0c0c0',
  '.scm': '#c0c0c0',
  '.Rproj': '#ffff00',
  '.sis': '#c0c0c0',
  '.1p': '#c0c0c0',
  '.3p': '#c0c0c0',
  '.cnc': '#c0c0c0',
  '.def': '#c0c0c0',
  '.ex': '#c0c0c0',
  '.example': '#c0c0c0',
  '.feature': '#c0c0c0',
  '.ger': '#c0c0c0',
  '.map': '#c0c0c0',
  '.mf': '#c0c0c0',
  '.mfasl': '#c0c0c0',
  '.mi': '#c0c0c0',
  '.mtx': '#c0c0c0',
  '.pc': '#c0c0c0',
  '.pi': '#c0c0c0',
  '.plt': '#c0c0c0',
  '.pm': '#c0c0c0',
  '.rb': '#c0c0c0',
  '.rdf': '#c0c0c0',
  '.rst': '#c0c0c0',
  '.ru': '#c0c0c0',
  '.sch': '#c0c0c0',
  '.sty': '#c0c0c0',
  '.sug': '#c0c0c0',
  '.tdy': '#c0c0c0',
  '.tfm': '#c0c0c0',
  '.tfnt': '#c0c0c0',
  '.tg': '#c0c0c0',
  '.vcard': '#c0c0c0',
  '.vcf': '#c0c0c0',
  '.xln': '#c0c0c0',
  '.iml': '#d75f00',
  '.xcconfig': '#800000',
  '.entitlements': '#800000',
  '.strings': '#800000',
  '.storyboard': '#ff0000',
  '.xcsettings': '#800000',
  '.xib': '#ff8700'
}

// More color references
// https://github.com/d3/d3-scale-chromatic
// http://bl.ocks.org/emmasaunders/52fa83767df27f1fc8b3ee2c6d372c74
