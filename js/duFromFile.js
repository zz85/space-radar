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

  class iNode {
    constructor(name, size) {
      this.name = name;
      this.children = [];
      this.size = size || 0;
      this.index = new Map();
    }

    addChild(node) {
      this.index.set(node.name, node);
      this.children.push(node);
    }

    findChild() {

    }

    toJSON() {
      return {
        name: this.name,
        children: this.children,
        size: this.size
      };
    }
  }

  resetCounters();

  // finds children node based on directory name,
  // then returns the node
  function findChild(node, dirname) {
    if (!dirname) return node;

    return node.index.get(dirname);

    // console.log('children, dirname', children, dirname);
    // Try to find the directory within the current children
    // Since the file is usually sorted and we push, the last element is likely the directory we seek
    if (!children) {
      // console.log('warning failed');
      return -1;
    }

    return
    let clen = children.length;
    if (clen > 1 && children[clen-1].name === dirname) {
      return clen - 1
    } else {
      // a potential O(n)
      // return children.findIndex(function(element) {
      //   return element.name === dirname;
      // })

      for (let i = 0; i < clen; i++) { // 20% faster than above
        if (children[i].name === dirname) return i;
      }

      return -1;
    }

  }

  function addFileToNode(node, path, size) {
    let dirname = path.shift();
    // console.log('node', node, 'dirname', path, dirname);
    // let index = findChild(node.children, dirname);
    const child = findChild(node, dirname);

    if (!node.children) node.children = [];

    if (path.length === 0) {
      // Last element is either a new file which we just push (index -1), or
      // a directory which already exists (index != -1) because of du's sorting
      // so we just add the size to it
      if (!child) {
        // node.children.push({ name: dirname, size: size });
        // node.children.push(new iNode(dirname, size));
        node.addChild(new iNode(dirname, size))
      } else {
        // node.children[index].size = size;
        child.size = size;
      }
    } else {
      if (!child) {
        // not found, so we push a new one
        // node.children.push(
        //   // addFileToNode({ name: dirname, children: [] }, path, size)
        //   addFileToNode(new iNode(dirname), path, size)
        // );
        node.addChild(addFileToNode(new iNode(dirname), path, size));
      } else {
        // node.children[index] =
        addFileToNode(child, path, size);
      }
    }
    return node;
  }

  function readFSFromFile(options, done) {
    let instream
    const node = options.node
    node.name = options.parent

    const target_file = options.parent;

    let currentSize = 0
    // Format is "<size><whitespaces><path>"
    let lineRegex = /^(\d+)\s+([\s\S]*)$/

    if (target_file.endsWith('.gz')) {
      instream = fs.createReadStream(target_file).pipe(zlib.createGunzip());
    } else {
      instream = fs.createReadStream(target_file);
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

      // console.log(line, 'path', path, 'size', size);

      counter++;
      currentSize += size;
      if ( counter % 5000 === 0 ) { // update progress every Xth file
        // options.onprogress(result[2], '', currentSize)
        console.log('counter', counter);
      }

      addFileToNode(node, path, size);
    });

    rl.on('close', function() {
      console.log('counter', counter);
      done()
    });
  }

  readFSFromFile.resetCounters = resetCounters
  readFSFromFile.iNode = iNode;
  module.exports = readFSFromFile

  const parent = new iNode('test')
  readFSFromFile({
    parent: './sizes_hashed.txt.gz',
    node: parent,
    onprogress: (...a) => { console.log('progress', a); },
    // onrefresh: refresh
  }, (e) => { console.log('done', 1 || JSON.stringify(parent, 0, 1)) })

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