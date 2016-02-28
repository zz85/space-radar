(() => {
  'use strict'

  const fs = require('fs')
  const path = require('path')
  const readline = require('readline');
  var zlib = require("zlib");

  let counter, current_size

  function resetCounters() {
    counter = 0
    current_size = 0
  }

  resetCounters()

  function addFileToNode(node, path, size) {
    var dirname = path.shift();
    var index = -1;
    if ( path.length === 0 ) {
      // Last element is the file, so we push it
      node.children.push({name: dirname, size: size});
    } else {
      // Try to find the directory within the current children
      // Since the file is usually sorted and we push the last element is likely to the the one
      var clen = node.children.length;
      if ( clen> 1 && node.children[clen-1].name === dirname ) {
        index = clen-1;
      } else {
        index = node.children.findIndex(function(element) {
          return element.name === dirname;
        });
      }

      if ( index === -1 ) {
        // not found, so we push a new one
        node.children.push(
          addFileToNode({name: dirname, children: []}, path, size)
        );
      } else {
        node.children[index] = addFileToNode(node.children[index], path, size);
      }
    }
    return node;
  }

  function readFSFromFile(options, done) {
    let node, instream;
    node = options.node;
    node.name = options.parent;
    node.children = [];

    var currentSize = 0;
    var currentLine = 0;
    // Format is "<size><whitespaces><path>"
    var lineRegex = /^(\d+)\s+(.*)$/

    if ( options.parent.endsWith(".gz") ) {
      instream = fs.createReadStream(options.parent).pipe(zlib.createGunzip());
    } else {
      instream = fs.createReadStream(options.parent);
    }

    var rl = readline.createInterface({
        input: instream,
        terminal: false
    })
    rl.on('line', function(line) {
       var result = line.match(lineRegex);
       var size = parseInt(result[1]);
       var path = result[2].split('/');
       // Depending on how find is used the first element may be empty
       // if the path started with / or a . which we also don't want
       if ( path[0] === "." || path[0] === "" ) {
         path.shift();
       }

       currentLine++;
       currentSize += size;
       if ( currentLine % 5000 === 0 ) { // update progress every Xth file
         options.onprogress(result[2], '', currentSize)
       }

       addFileToNode(node, path, size);
    });
    rl.on('close', function() {
      done();
    });
  }

  readFSFromFile.resetCounters = resetCounters
  module.exports = readFSFromFile
})()
