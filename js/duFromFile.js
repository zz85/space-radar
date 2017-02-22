(() => {
  'use strict'

  const fs = require('fs')
  const path = require('path')
  const readline = require('readline')
  const zlib = require('zlib')

  let counter, current_size

  function resetCounters() {
    counter = 0
    current_size = 0
  }

  resetCounters();

  function findChild(children, dirname) {
    // Try to find the directory within the current children
    // Since the file is usually sorted and we push, the last element is likely the directory we seek
    let clen = children.length;
    if (clen > 1 && children[clen-1].name === dirname) {
      return clen - 1
    } else {
      return children.findIndex(function(element) {
        return element.name === dirname;
      })
    }

  }

  function addFileToNode(node, path, size) {
    let dirname = path.shift();
    let index = findChild(node.children, dirname);

    if (path.length === 0) {
      // Last element is either a new file which we just push (index -1), or
      // a directory which already exists (index != -1) because of du's sorting
      // so we just add the size to it
      if (index === -1) {
        node.children.push({ name: dirname, size: size });
      } else {
        node.children[index].size = size;
      }
    } else {
      if (index === -1) {
        // not found, so we push a new one
        node.children.push(
          addFileToNode({ name: dirname, children: [] }, path, size)
        );
      } else {
        node.children[index] = addFileToNode(node.children[index], path, size);
      }
    }
    return node;
  }

  function readFSFromFile(options, done) {
    let node, instream
    node = options.node
    node.name = options.parent
    node.children = []

    let currentSize = 0
    // Format is "<size><whitespaces><path>"
    let lineRegex = /^(\d+)\s+([\s\S]*)$/

    if (options.parent.endsWith('.gz')) {
      instream = fs.createReadStream(options.parent).pipe(zlib.createGunzip());
    } else {
      instream = fs.createReadStream(options.parent);
    }

    instream.setEncoding('utf-8');

    let rl = readline.createInterface({
      input: instream,
      terminal: false
    })

    rl.on('line', function(line) {
      let result = line.match(lineRegex);
      let size = 0 | result[1] * 1024;
      let path = result[2].split('/');
      // Depending on how find is used the first element may be empty
      // if the path started with / or a . which we also don't want
      if ( path[0] === '.' || path[0] === '' ) {
        path.shift();
      }

      counter++;
      currentSize += size;
      if ( counter % 5000 === 0 ) { // update progress every Xth file
        options.onprogress(result[2], '', currentSize)
      }

      addFileToNode(node, path, size);
    });

    rl.on('close', function() {
      done()
    });
  }

  readFSFromFile.resetCounters = resetCounters
  module.exports = readFSFromFile
})()
