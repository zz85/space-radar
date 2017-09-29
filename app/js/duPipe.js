;(() => {
  'use strict'

  const fs = require('fs')
  const path = require('path')

  let counter, current_size

  function resetCounters() {
    counter = 0
    current_size = 0
  }

  resetCounters()

  /* Asynchronous File System descender */
  function descendFS(options, done) {
    let dir, name, node

    // node = options.node

    if (!options.name) {
      dir = options.parent
      name = options.parent
    } else {
      dir = path.join(options.parent, options.name)
      name = options.name
    }

    counter++
    if (counter % 10000 === 0) {
      if (options.onprogress) options.onprogress(dir, name, current_size)
      if (counter % 100000 === 0) if (options.onrefresh) options.onrefresh(dir, name)
    }

    fs.lstat(dir, (err, stat) => {
      if (err) {
        console.log(err.stack)
        return done(dir)
      }

      let size = stat.size
      if (stat.blocks) {
        current_size += stat.blocks * 512
      }

      if (stat.isSymbolicLink()) return done(dir)

      // console.log(`${Math.ceil(size / 1024)}\t${dir}`);
      writeStream.write(`${Math.ceil(size / 1024)}\t${dir}\n`)

      if (stat.isFile()) {
        // node.name = name
        // node.size = size
        return done(dir)
      }

      if (stat.isDirectory()) {
        // node.name = name;
        // // node.size = size;
        // node.children = []

        fs.readdir(dir, (err, list) => {
          if (err) {
            console.error(err.stack)
            return done(dir)
          }

          var left = list.length

          function ok(bla) {
            left--
            if (left === 0) done(name)
          }

          list.forEach(file => {
            // let childNode = {};
            // node.children.push(childNode)
            descendFS(
              {
                parent: dir,
                name: file,
                // node: childNode,
                onprogress: options.onprogress,
                onrefresh: options.onrefresh
              },
              ok
            )
          })

          if (!left) done(name)
        })

        return
      }

      return done(dir)
    })
  }

  descendFS.resetCounters = resetCounters
  module.exports = descendFS

  var writeStream
  module.exports.pipe = function(options, done) {
    const target_filename = './output.txt'
    fs.unlinkSync(target_filename)
    writeStream = fs.createWriteStream(target_filename)
    options.onstart()
    descendFS(
      {
        parent: options.parent,
        onprogress: (...a) => {
          // console.log('progress', a)
        },
        node: options.node || {}
      },
      () => {
        writeStream.write('\n')
        writeStream.end()
        console.log('done amt', counter, 'size', current_size)
        done(counter)
      }
    )
  }

  // module.exports.pipe({
  //     parent: './',
  //     node: {}
  // }, (a) => {
  //     console.log('done')
  // });
})()
