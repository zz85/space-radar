(() => {
  'use strict'

  const fs = require('fs')
  const path = require('path')
  const readline = require('readline')
  const zlib = require('zlib')
  const log = require('./utils').log

  let counter, current_size

  function resetCounters() {
    counter = 0
    current_size = 0
  }

  class iNode {
    constructor(name, size) {
      this.name = name;
      this.size = size || 0;
      this.children = new Map();
    }

    addChild(node) {
      this.children.set(node.name, node);
    }

    // finds child node based on path/file/dir name
    findChild(pathname) {
      if (!pathname) return this;

      // the index indexes all the children name
      return this.children.get(pathname);
    }

    toJSON() {
      return {
        name: this.name,
        // parent: this.parent,
        children: [...this.children.values()],
        size: this.size
      };
    }
  }

  resetCounters();

  function addFileToNode(node, path, size) {
    let pathname = path.shift();
    const child = node.findChild(pathname);

    if (path.length === 0) {
      // Last element is either a new file, or
      // a directory which already exists
      if (!child) {
        node.addChild(new iNode(pathname, size)) // { name: pathname, size: size }
      } else {
        child.size = size;
      }
    } else {
      if (!child) {
        // not found, so we push a new node (directory);
        const new_child = new iNode(pathname);
        node.addChild(new_child);
        addFileToNode(new_child, path, size);
      } else {
        addFileToNode(child, path, size);
      }
    }
    return node;
  }

  function readFSFromFile(options, done) {
    let instream
    const target_file = options.parent;
    const node = options.node
    node.name = target_file

    let currentSize = 0
    // Format is "<size><whitespaces><path>"
    const lineRegex = /^(\d+)\s+([\s\S]*)$/
    console.time('readfs');

    if (target_file.endsWith('.gz')) {
      instream = fs.createReadStream(target_file).pipe(zlib.createGunzip());
    } else {
      instream = fs.createReadStream(target_file);
    }

    instream.setEncoding('utf-8');

    const rl = readline.createInterface({
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
      log('entry counter', counter);
      console.timeEnd('readfs');
      done(counter)
    });
  }

  readFSFromFile.resetCounters = resetCounters
  readFSFromFile.iNode = iNode;
  module.exports = readFSFromFile

  /*
  const parent = new iNode('test')
  readFSFromFile({
    parent: './sizes_hashed.txt.gz',
    node: parent,
    onprogress: (...a) => { console.log('progress', a); },
    // onrefresh: refresh
  }, (e) => { console.log('done', 1 || JSON.stringify(parent, 0, 1)) })
  */

})()


/*
counter 322361
done
node js/duFromFile.js  56.85s user 0.81s system 95% cpu 1:00.23 total

322361
node js/duFromFile.js  52.85s user 0.65s system 98% cpu 54.549 total

after map speedup
node js/duFromFile.js  ~2.19s user 1.61s system 58% cpu 11.598 total
*/