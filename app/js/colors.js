var size_luminance = d3.scale
  .sqrt()
  .domain([0, 1e9])
  .clamp(true)
  .range([90, 20])

const depth_luminance = d3.scale
  .linear() // .sqrt()
  .domain([0, 11])
  .clamp(true)
  .range([75, 96])

const colorScale = d3.scale
// .linear()
// .range(['purple', 'orange']) // "steelblue", "brown pink orange green", "blue"
// .domain([1e2, 1e9])
// .interpolate(d3.interpolateLab) // interpolateHcl

const greyScale = d3.scale
  .linear()
  // .range(['white', 'black'])
  .range(['black', 'white'])
  .domain([0, 12])
  .interpolate(d3.interpolateLab)

const fill =
  // size
  // fillByParentName
  // colorByParent
  // byExtension
  byProp

function byProp(d) {
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

    // 3786
    if (ext in extension_map_256_dark) { // 160
      // 92
      tmpExtensions.add(ext)
      const { r, g, b } = extension_map_256_dark[ext];
      return d3.lab(d3.rgb(r, g, b))
    }
  }

  return def ? null : d3.rgb(0, 0, 0)
}

function size(d) {
  // const c = d3.lab(hue(d.name))
  const c = greyScale(d.depth)
  c.l = size_luminance(d.value)
  return c
}

function colorByParent(d) {
  let p = d
  while (p.depth > 1) p = p.parent
  // var c = d3.lab(hue(p.sum)); // size
  // var c = d3.lab(hue(p.count));
  // var c = d3.lab(hue(p.name))
  const c = d3.lab(hue(p.children ? p.children.length : 0))
  // c.l = luminance(d.value)
  c.l = depth_luminance(d.depth)

  return c
}

function fillByParentName(d) {
  let p = d
  while (p.depth > 1) p = p.parent
  c.l = size_luminance(d.sum || d.value)
  return c
}

const _color_cache = new Map()
function color_cache(x) {
  if (!_color_cache.has(x)) {
    _color_cache.set(x, colorScale(x))
  }

  return _color_cache.get(x)
}

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

    l *= 1.05 // adjusts as it diffuses the directory
    // darker - saturated cores, lighter - whiter cores
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

const extension_map_256_dark =
{ '.tar': { l: '50', a: '15', b: '196', r: '108', g: '113' },
'.tgz': { l: '50', a: '15', b: '196', r: '108', g: '113' },
'.arj': { l: '50', a: '15', b: '196', r: '108', g: '113' },
'.taz': { l: '50', a: '15', b: '196', r: '108', g: '113' },
'.lzh': { l: '50', a: '15', b: '196', r: '108', g: '113' },
'.lzma': { l: '50', a: '15', b: '196', r: '108', g: '113' },
'.tlz': { l: '50', a: '15', b: '196', r: '108', g: '113' },
'.txz': { l: '50', a: '15', b: '196', r: '108', g: '113' },
'.zip': { l: '50', a: '15', b: '196', r: '108', g: '113' },
'.z': { l: '50', a: '15', b: '196', r: '108', g: '113' },
'.Z': { l: '50', a: '15', b: '196', r: '108', g: '113' },
'.dz': { l: '50', a: '15', b: '196', r: '108', g: '113' },
'.gz': { l: '50', a: '15', b: '196', r: '108', g: '113' },
'.lz': { l: '50', a: '15', b: '196', r: '108', g: '113' },
'.xz': { l: '50', a: '15', b: '196', r: '108', g: '113' },
'.bz2': { l: '50', a: '15', b: '196', r: '108', g: '113' },
'.bz': { l: '50', a: '15', b: '196', r: '108', g: '113' },
'.tbz': { l: '50', a: '15', b: '196', r: '108', g: '113' },
'.tbz2': { l: '50', a: '15', b: '196', r: '108', g: '113' },
'.tz': { l: '50', a: '15', b: '196', r: '108', g: '113' },
'.deb': { l: '50', a: '15', b: '196', r: '108', g: '113' },
'.rpm': { l: '50', a: '15', b: '196', r: '108', g: '113' },
'.jar': { l: '50', a: '15', b: '196', r: '108', g: '113' },
'.rar': { l: '50', a: '15', b: '196', r: '108', g: '113' },
'.ace': { l: '50', a: '15', b: '196', r: '108', g: '113' },
'.zoo': { l: '50', a: '15', b: '196', r: '108', g: '113' },
'.cpio': { l: '50', a: '15', b: '196', r: '108', g: '113' },
'.7z': { l: '50', a: '15', b: '196', r: '108', g: '113' },
'.rz': { l: '50', a: '15', b: '196', r: '108', g: '113' },
'.apk': { l: '50', a: '15', b: '196', r: '108', g: '113' },
'.gem': { l: '50', a: '15', b: '196', r: '108', g: '113' },
'.jpg': { l: '60', a: '10', b: '0', r: '181', g: '137' },
'.JPG': { l: '60', a: '10', b: '0', r: '181', g: '137' },
'.jpeg': { l: '60', a: '10', b: '0', r: '181', g: '137' },
'.gif': { l: '60', a: '10', b: '0', r: '181', g: '137' },
'.bmp': { l: '60', a: '10', b: '0', r: '181', g: '137' },
'.pbm': { l: '60', a: '10', b: '0', r: '181', g: '137' },
'.pgm': { l: '60', a: '10', b: '0', r: '181', g: '137' },
'.ppm': { l: '60', a: '10', b: '0', r: '181', g: '137' },
'.tga': { l: '60', a: '10', b: '0', r: '181', g: '137' },
'.xbm': { l: '60', a: '10', b: '0', r: '181', g: '137' },
'.xpm': { l: '60', a: '10', b: '0', r: '181', g: '137' },
'.tif': { l: '60', a: '10', b: '0', r: '181', g: '137' },
'.tiff': { l: '60', a: '10', b: '0', r: '181', g: '137' },
'.png': { l: '60', a: '10', b: '0', r: '181', g: '137' },
'.PNG': { l: '60', a: '10', b: '0', r: '181', g: '137' },
'.svg': { l: '60', a: '10', b: '0', r: '181', g: '137' },
'.svgz': { l: '60', a: '10', b: '0', r: '181', g: '137' },
'.mng': { l: '60', a: '10', b: '0', r: '181', g: '137' },
'.pcx': { l: '60', a: '10', b: '0', r: '181', g: '137' },
'.dl': { l: '60', a: '10', b: '0', r: '181', g: '137' },
'.xcf': { l: '60', a: '10', b: '0', r: '181', g: '137' },
'.xwd': { l: '60', a: '10', b: '0', r: '181', g: '137' },
'.yuv': { l: '60', a: '10', b: '0', r: '181', g: '137' },
'.cgm': { l: '60', a: '10', b: '0', r: '181', g: '137' },
'.emf': { l: '60', a: '10', b: '0', r: '181', g: '137' },
'.eps': { l: '60', a: '10', b: '0', r: '181', g: '137' },
'.CR2': { l: '60', a: '10', b: '0', r: '181', g: '137' },
'.ico': { l: '60', a: '10', b: '0', r: '181', g: '137' },
'.tex': { l: '65', a: '05', b: '161', r: '147', g: '161' },
'.rdf': { l: '65', a: '05', b: '161', r: '147', g: '161' },
'.owl': { l: '65', a: '05', b: '161', r: '147', g: '161' },
'.n3': { l: '65', a: '05', b: '161', r: '147', g: '161' },
'.ttl': { l: '65', a: '05', b: '161', r: '147', g: '161' },
'.nt': { l: '65', a: '05', b: '161', r: '147', g: '161' },
'.torrent': { l: '65', a: '05', b: '161', r: '147', g: '161' },
'.xml': { l: '65', a: '05', b: '161', r: '147', g: '161' },
'*Makefile': { l: '65', a: '05', b: '161', r: '147', g: '161' },
'*Rakefile': { l: '65', a: '05', b: '161', r: '147', g: '161' },
'*Dockerfile': { l: '65', a: '05', b: '161', r: '147', g: '161' },
'*build.xml': { l: '65', a: '05', b: '161', r: '147', g: '161' },
'*rc': { l: '65', a: '05', b: '161', r: '147', g: '161' },
'*1': { l: '65', a: '05', b: '161', r: '147', g: '161' },
'.nfo': { l: '65', a: '05', b: '161', r: '147', g: '161' },
'*README': { l: '65', a: '05', b: '161', r: '147', g: '161' },
'*README.txt': { l: '65', a: '05', b: '161', r: '147', g: '161' },
'*readme.txt': { l: '65', a: '05', b: '161', r: '147', g: '161' },
'.md': { l: '65', a: '05', b: '161', r: '147', g: '161' },
'*README.markdown': { l: '65', a: '05', b: '161', r: '147', g: '161' },
'.ini': { l: '65', a: '05', b: '161', r: '147', g: '161' },
'.yml': { l: '65', a: '05', b: '161', r: '147', g: '161' },
'.cfg': { l: '65', a: '05', b: '161', r: '147', g: '161' },
'.conf': { l: '65', a: '05', b: '161', r: '147', g: '161' },
'.h': { l: '65', a: '05', b: '161', r: '147', g: '161' },
'.hpp': { l: '65', a: '05', b: '161', r: '147', g: '161' },
'.c': { l: '65', a: '05', b: '161', r: '147', g: '161' },
'.cpp': { l: '65', a: '05', b: '161', r: '147', g: '161' },
'.cxx': { l: '65', a: '05', b: '161', r: '147', g: '161' },
'.cc': { l: '65', a: '05', b: '161', r: '147', g: '161' },
'.objc': { l: '65', a: '05', b: '161', r: '147', g: '161' },
'.sqlite': { l: '65', a: '05', b: '161', r: '147', g: '161' },
'.go': { l: '65', a: '05', b: '161', r: '147', g: '161' },
'.sql': { l: '65', a: '05', b: '161', r: '147', g: '161' },
'.csv': { l: '65', a: '05', b: '161', r: '147', g: '161' },
'.log': { l: '45', a: '07', b: '117', r: '88', g: '110' },
'.bak': { l: '45', a: '07', b: '117', r: '88', g: '110' },
'.aux': { l: '45', a: '07', b: '117', r: '88', g: '110' },
'.lof': { l: '45', a: '07', b: '117', r: '88', g: '110' },
'.lol': { l: '45', a: '07', b: '117', r: '88', g: '110' },
'.lot': { l: '45', a: '07', b: '117', r: '88', g: '110' },
'.out': { l: '45', a: '07', b: '117', r: '88', g: '110' },
'.toc': { l: '45', a: '07', b: '117', r: '88', g: '110' },
'.bbl': { l: '45', a: '07', b: '117', r: '88', g: '110' },
'.blg': { l: '45', a: '07', b: '117', r: '88', g: '110' },
'*': { l: '45', a: '07', b: '117', r: '88', g: '110' },
'.part': { l: '45', a: '07', b: '117', r: '88', g: '110' },
'.incomplete': { l: '45', a: '07', b: '117', r: '88', g: '110' },
'.swp': { l: '45', a: '07', b: '117', r: '88', g: '110' },
'.tmp': { l: '45', a: '07', b: '117', r: '88', g: '110' },
'.temp': { l: '45', a: '07', b: '117', r: '88', g: '110' },
'.o': { l: '45', a: '07', b: '117', r: '88', g: '110' },
'.pyc': { l: '45', a: '07', b: '117', r: '88', g: '110' },
'.class': { l: '45', a: '07', b: '117', r: '88', g: '110' },
'.cache': { l: '45', a: '07', b: '117', r: '88', g: '110' },
'.aac': { l: '50', a: '50', b: '22', r: '203', g: '75' },
'.au': { l: '50', a: '50', b: '22', r: '203', g: '75' },
'.flac': { l: '50', a: '50', b: '22', r: '203', g: '75' },
'.mid': { l: '50', a: '50', b: '22', r: '203', g: '75' },
'.midi': { l: '50', a: '50', b: '22', r: '203', g: '75' },
'.mka': { l: '50', a: '50', b: '22', r: '203', g: '75' },
'.mp3': { l: '50', a: '50', b: '22', r: '203', g: '75' },
'.mpc': { l: '50', a: '50', b: '22', r: '203', g: '75' },
'.ogg': { l: '50', a: '50', b: '22', r: '203', g: '75' },
'.opus': { l: '50', a: '50', b: '22', r: '203', g: '75' },
'.ra': { l: '50', a: '50', b: '22', r: '203', g: '75' },
'.wav': { l: '50', a: '50', b: '22', r: '203', g: '75' },
'.m4a': { l: '50', a: '50', b: '22', r: '203', g: '75' },
'.axa': { l: '50', a: '50', b: '22', r: '203', g: '75' },
'.oga': { l: '50', a: '50', b: '22', r: '203', g: '75' },
'.spx': { l: '50', a: '50', b: '22', r: '203', g: '75' },
'.xspf': { l: '50', a: '50', b: '22', r: '203', g: '75' },
'.mov': { l: '50', a: '50', b: '22', r: '203', g: '75' },
'.MOV': { l: '50', a: '50', b: '22', r: '203', g: '75' },
'.mpg': { l: '50', a: '50', b: '22', r: '203', g: '75' },
'.mpeg': { l: '50', a: '50', b: '22', r: '203', g: '75' },
'.m2v': { l: '50', a: '50', b: '22', r: '203', g: '75' },
'.mkv': { l: '50', a: '50', b: '22', r: '203', g: '75' },
'.ogm': { l: '50', a: '50', b: '22', r: '203', g: '75' },
'.mp4': { l: '50', a: '50', b: '22', r: '203', g: '75' },
'.m4v': { l: '50', a: '50', b: '22', r: '203', g: '75' },
'.mp4v': { l: '50', a: '50', b: '22', r: '203', g: '75' },
'.vob': { l: '50', a: '50', b: '22', r: '203', g: '75' },
'.qt': { l: '50', a: '50', b: '22', r: '203', g: '75' },
'.nuv': { l: '50', a: '50', b: '22', r: '203', g: '75' },
'.wmv': { l: '50', a: '50', b: '22', r: '203', g: '75' },
'.asf': { l: '50', a: '50', b: '22', r: '203', g: '75' },
'.rm': { l: '50', a: '50', b: '22', r: '203', g: '75' },
'.rmvb': { l: '50', a: '50', b: '22', r: '203', g: '75' },
'.flc': { l: '50', a: '50', b: '22', r: '203', g: '75' },
'.avi': { l: '50', a: '50', b: '22', r: '203', g: '75' },
'.fli': { l: '50', a: '50', b: '22', r: '203', g: '75' },
'.flv': { l: '50', a: '50', b: '22', r: '203', g: '75' },
'.gl': { l: '50', a: '50', b: '22', r: '203', g: '75' },
'.m2ts': { l: '50', a: '50', b: '22', r: '203', g: '75' },
'.divx': { l: '50', a: '50', b: '22', r: '203', g: '75' },
'.webm': { l: '50', a: '50', b: '22', r: '203', g: '75' },
'.axv': { l: '50', a: '50', b: '22', r: '203', g: '75' },
'.anx': { l: '50', a: '50', b: '22', r: '203', g: '75' },
'.ogv': { l: '50', a: '50', b: '22', r: '203', g: '75' },
'.ogx': { l: '50', a: '50', b: '22', r: '203', g: '75' } }