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

  function addFileByPath(node, path, size) {
    if ( path.length == 1 ) {
      node[path[0]] = size;
      return node;
    }
    var dirname = path.shift();
    if ( !node[dirname] ) {
      node[dirname] = {};
    }
    node[dirname] = addFileByPath(node[dirname], path, size);
    return node;
  }

  function changeNodeFormat(json, root) {
    var newNode = {
      name: root,
      children: []
    };
    for (var elem in json ) {
      if (typeof json[elem] == "object") {
        newNode["children"].push(changeNodeFormat(json[elem], elem));
      } else if (typeof json[elem] == "number") {
        newNode["children"].push({
          name: elem,
          size: json[elem]
        })
      }
    }
    return newNode;
  }

  function readFSFromFile(options, done) {
    let node;
    node = options.node;

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

       currentLine++;
       currentSize += size;
       if ( currentLine % 1000 === 0 ) { // update progress every Xth file
         options.onprogress(result[2], '', currentSize)
       }

       addFileByPath(json, path, size);
    });
    rl.on('close', function() {
      node.name = options.parent;
      node.children = changeNodeFormat(json, '').children;

      done();
    });
  }

  readFSFromFile.resetCounters = resetCounters
  module.exports = readFSFromFile
})()
