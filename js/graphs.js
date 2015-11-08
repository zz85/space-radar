'use strict'

var PATH_DELIMITER = '/'

function keys(d) {
  var k = [], p = d;
  while (p) k.push(p.name), p = p.parent;
  return k.reverse();
}

function key(d) {
  return keys(d).join(PATH_DELIMITER)
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

function getNodeFromPath(keys, root) {
  log('navigateToPath', keys)
  let name, n = root

  if (!keys.length) {
    log('warning no keys to navigate to')
    return n
  }

  name = keys.shift()

  if (!keys.length) {
    if (name !== n.name) log('warning, root name dont match!')
    return n
  }

  while (name = keys.shift()) {
    log(n.name)
    let children = n.children.filter(n => {
      return n.name == name
    })

    if (!children[0]) return n
    n = children[0]
  }

  log('found n', n, root)

  return n
}