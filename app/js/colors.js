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

let fill = colorByProp
// colorByProp // filetypes
// colorBySize // size
// colorByParentName colorful
// colorByParent // children
// byExtension

function colorByProp(d) {
  // using color prop
  return d.color
}

const ext_reg = /\.\w+$/

const tmpExtensions = new Set()
const randExt = {}

function byExtension(d, def) {
  const m = ext_reg.exec(d.name)
  const ext = m && m[0]
  if (ext) {
    /*
    // TODO use hashes for exploration!
    if (!randExt[ext]) {
      randExt[ext] = {
        r: Math.random() * 256 | 0,
        g: Math.random() * 256 | 0,
        b: Math.random() * 256 | 0
      }
    }
    const { r, g, b } = randExt[ext];
    return d3.lab(d3.rgb(r, g, b))
    */

    /*
    // 3786
    if (ext in extension_map_256_dark) { // 160
      // 92
      tmpExtensions.add(ext)
      const { r, g, b } = extension_map_256_dark[ext];
      return d3.lab(d3.rgb(r, g, b))
    }
    */

    if (ext in extension_map_ansi_dark) {
      // 160
      // 141
      tmpExtensions.add(ext)
      const { r, g, b } = extension_map_ansi_dark[ext]
      return d3.lab(d3.rgb(r, g, b))
    }
  }

  return def ? null : d3.rgb(0, 0, 0)
}

function colorBySize(d) {
  const c = d3.lab(size_scale_colors(d.value))
  c.l = size_luminance(d.value)
  return c
}

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

    const v = node.size
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
        ? child.size / v // weighted by size
        : 1 / len // weighted by count
      l += color.l * weight
      a += color.a * weight
      b += color.b * weight
    }

    // darker - saturated cores, lighter - whiter cores
    // l *= 1.03 // adjusts as it diffuses the directory
    // l = Math.max(Math.min(98, l), 2)

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

// More color references
// https://github.com/d3/d3-scale-chromatic
// http://bl.ocks.org/emmasaunders/52fa83767df27f1fc8b3ee2c6d372c74
