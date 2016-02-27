(() => {
  'use strict'

  const fs = require('fs')
  const path = require('path')
  const readline = require('readline');

  let counter, current_size

  function resetCounters() {
    counter = 0
    current_size = 0
  }

  resetCounters()

  function addFileToNode(files, path, size) {
    var dirname = path.shift();
    var index = -1;
    if ( path.length === 0 ) {
      // Last element is the file, so we push it
      files.children.push({name: dirname, size: size});
    } else {
      if ( files.children ) {
        // Try to find the directory within the current children
        index = files.children.findIndex(function(element) {
          return element.name === dirname;
        });
      }

      if ( index === -1 ) {
        // not found, so we push a new one
        files.children.push(
          addFileToNode({name: dirname, children: []}, path, size)
        );
      } else {
        files.children[index] = addFileToNode(files.children[index], path, size);
      }
    }
    return files;
  }

  function readFSFromFile(options, done) {
    let node;
    node = options.node;
    node.name = options.parent;
    node.children = [];

    var json = {};
    var currentSize = 0;
    var currentLine = 0;
    var lineRegex = /^(\d+)\s+(.*)$/

    var rl = readline.createInterface({
        input: fs.createReadStream(options.parent),
        terminal: false
    })
    rl.on('line', function(line) {
       var result = line.match(lineRegex);
       var size = parseInt(result[1]);
       var path = result[2].split('/');
       // Depending on how find is used the first element may be:
       // empty if the path started with / or a .
       if ( path[0] === "." || path[0] === "" ) {
         path.shift();
       }

       currentLine++;
       currentSize += size;
       if ( currentLine % 1000 === 0 ) { // update progress every Xth file
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
