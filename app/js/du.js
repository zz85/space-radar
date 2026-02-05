(() => {
  "use strict";

  const fs = require("fs");
  const path = require("path");

  let counter, current_size, fileCount, dirCount;

  function resetCounters() {
    counter = 0;
    current_size = 0;
    fileCount = 0;
    dirCount = 0;
  }

  function getStats() {
    return { counter, current_size, fileCount, dirCount };
  }

  resetCounters();

  /* Asynchronous File System descender */
  function descendFS(options, done) {
    let dir, name, node;

    node = options.node;

    if (!options.name) {
      dir = options.parent;
      name = options.parent;
    } else {
      dir = path.join(options.parent, options.name);
      name = options.name;
    }

    counter++;
    if (counter % 10000 === 0) {
      if (options.onprogress)
        options.onprogress(dir, name, current_size, fileCount, dirCount);
      if (counter % 100000 === 0)
        if (options.onrefresh) options.onrefresh(dir, name);
    }

    // Respect exclusion paths (absolute)
    try {
      const excludePaths = options.excludePaths || [];
      for (let i = 0; i < excludePaths.length; i++) {
        const ex = excludePaths[i];
        if (
          dir === ex ||
          (dir.length > ex.length && dir.indexOf(ex + path.sep) === 0)
        ) {
          return done(dir);
        }
      }
      // Special-case: Exclude OneDrive data inside Group Containers
      if (
        dir.indexOf(
          path.sep + "Library" + path.sep + "Group Containers" + path.sep
        ) !== -1 &&
        dir.indexOf("OneDrive") !== -1
      ) {
        return done(dir);
      }
    } catch (e) {}

    fs.lstat(dir, (err, stat) => {
      if (err) {
        console.log(err.stack);
        return done(dir);
      }

      let size = stat.size;
      if (stat.blocks) {
        current_size += stat.blocks * 512;
      }

      if (stat.isSymbolicLink()) return done(dir);

      // Prepare inode dedupe set
      if (!options.seenInodes) options.seenInodes = new Set();
      const inodeKey =
        stat.ino != null && stat.dev != null ? stat.dev + ":" + stat.ino : null;

      if (stat.isFile()) {
        fileCount++;
        if (inodeKey) {
          if (options.seenInodes.has(inodeKey)) {
            size = 0;
          } else {
            options.seenInodes.add(inodeKey);
          }
        }
        node.name = name;
        node.size = size;
        return done(dir);
      }

      if (stat.isDirectory()) {
        dirCount++;
        if (inodeKey) {
          if (options.seenInodes.has(inodeKey)) {
            return done(dir);
          } else {
            options.seenInodes.add(inodeKey);
          }
        }
        node.name = name;
        // node.size = size;
        node.children = [];

        fs.readdir(dir, (err, list) => {
          if (err) {
            console.error(err.stack);
            return done(dir);
          }

          var left = list.length;

          function ok(bla) {
            left--;
            if (left === 0) done(name);
          }

          list.forEach(file => {
            let childNode = {};
            node.children.push(childNode);
            descendFS(
              {
                parent: dir,
                name: file,
                node: childNode,
                onprogress: options.onprogress,
                onrefresh: options.onrefresh,
                excludePaths: options.excludePaths,
                seenInodes: options.seenInodes
              },
              ok
            );
          });

          if (!left) done(name);
        });

        return;
      }

      return done(dir);
    });
  }

  descendFS.resetCounters = resetCounters;
  descendFS.getStats = getStats;
  module.exports = descendFS;
})();
