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
  colorByParent

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

var _color_cache = new Map()
function color_cache(x) {
  if (!_color_cache.has(x)) {
    _color_cache.set(x, colorScale(x))
  }

  return _color_cache.get(x)
}
