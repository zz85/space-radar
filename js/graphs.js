var PATH_DELIMITER = '/'

function keys(d) {
  var k = [], p = d;
  while (p) k.push(p.name), p = p.parent;
  return k.reverse();
}

function key(d) {
  return keys(d).join(PATH_DELIMITER)
}

function breadcrumbs(d) {
  return keys(d).join(' > ')
}

function getPath(d) {
  var path = [d]
  d = d.parent
  while (d) {
    path.unshift(d)
    d = d.parent
  }
  return path
}