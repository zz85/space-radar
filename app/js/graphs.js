'use strict'

var PATH_DELIMITER = '/'

// returns an array of the full path of node
function keys(d) {
  return getPath(d).map(v => v.name)
}

// returns a name of the full path of node
function key(d) {
  return keys(d).join(PATH_DELIMITER)
}

// builds an array of node till root
function getPath(d) {
  var path = [d]
  d = d.parent
  while (d) {
    path.unshift(d)
    d = d.parent
  }
  return path
}

/*
 * keys - array of pathnames
 * root - hierarchical data
 */
function getNodeFromPath(keys, root) {
  if (!keys.length) {
    log('warning no keys to navigate to')
    return root
  }

  let name
  let n = root
  let i = 0
  name = keys[i++]

  if (i >= keys.length) {
    if (name !== n.name) {
      log('warning, root name dont match!')
    }
    return n
  }

  while (i < keys.length && (name = keys[i++])) {
    const children = n.children.filter(n => {
      return n.name == name
    })

    if (!children[0]) return n
    n = children[0]
  }

  return n
}

if (typeof globalThis !== 'undefined') {
  globalThis.PATH_DELIMITER = PATH_DELIMITER
  globalThis.keys = keys
  globalThis.key = key
  globalThis.getPath = getPath
  globalThis.getNodeFromPath = getNodeFromPath
}
