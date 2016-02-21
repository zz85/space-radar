(() => {
  'use strict'

  const fs = require('fs')
  const path = require('path')

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
    let node, json, tmp;
    node = options.node;

    json = readFile(options.parent, options.onprogress);
    tmp = changeNodeFormat(json, ""); // Maybe we can get rid of this, since the changed node format is not JSON like

    // simply node=tmp does not work and I am currently to lazy to find out why
    node.name = tmp.name;
    node.children = tmp.children;

    // console.log('node is: ' + JSON.stringify(node));

    done();
    return
  }

  function readFile(file, progress) {
    var json = {};
    var currentSize = 0;

    var lineRegex = /^(\d+)\s+(.*)$/

    var offlineFileSizes = fs.readFileSync(file).toString().split("\n");
    for (var line = 0; line < offlineFileSizes.length; line++ ) {
      if (!offlineFileSizes[line]) continue;
      var result = offlineFileSizes[line].match(lineRegex);
      var size = parseInt(result[1]);
      var path = result[2].split('/');

      currentSize += size;
      if ( line % 1000 === 0 ) { // update progress every Xth file
        progress(result[2], '', currentSize)
      }

      addFileByPath(json, path, size);
    }
    return json;
  }



  readFSFromFile.resetCounters = resetCounters
  module.exports = readFSFromFile
})()
