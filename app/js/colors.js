var luminance = d3.scale
  .sqrt()
  .domain([0, 1e9])
  .clamp(true)
  .range([90, 20])

function fill(d) {
  var p = d
  while (p.depth > 1) p = p.parent
  // var c = d3.lab(hue(p.sum));
  // var c = d3.lab(hue(p.count));
  // var c = d3.lab(hue(p.key));
  var c = d3.lab(hue(p.name))
  // var c = d3.lab(hue(p._children));
  // var c = d3.lab(hue(p.children ? p.children.length : 0));

  c.l = luminance(d.sum)
  return c
}
