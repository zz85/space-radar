(() => {
  "use strict";

  const fs = require("fs");
  const path = require("path");

  let counter, current_size, fileCount, dirCount, errorCount;
  let currentPath = ""; // Track current path being scanned
  let lastProgressTime = Date.now();
  let stuckThreshold = 30000; // 30 seconds without progress = potentially stuck
  let cancelled = false; // Flag to cancel scanning
  let paused = false; // Flag to pause scanning
  let pauseResolvers = []; // Callbacks waiting for resume

  function resetCounters() {
    counter = 0;
    current_size = 0;
    fileCount = 0;
    dirCount = 0;
    errorCount = 0;
    currentPath = "";
    lastProgressTime = Date.now();
    cancelled = false;
    paused = false;
    pauseResolvers = [];
  }

  function cancel() {
    cancelled = true;
    // Also resume if paused so pending operations can complete
    if (paused) {
      resume();
    }
    console.log("[du] Scan cancelled by user");
  }

  function isCancelled() {
    return cancelled;
  }

  function pause() {
    if (!paused) {
      paused = true;
      console.log("[du] Scan paused by user");
    }
  }

  function resume() {
    if (paused) {
      paused = false;
      console.log("[du] Scan resumed by user");
      // Resolve all waiting operations
      const resolvers = pauseResolvers;
      pauseResolvers = [];
      resolvers.forEach((resolve) => resolve());
    }
  }

  function isPaused() {
    return paused;
  }

  // Returns a promise that resolves when not paused
  function waitIfPaused() {
    if (!paused) {
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      pauseResolvers.push(resolve);
    });
  }

  function getStats() {
    return {
      counter,
      current_size,
      fileCount,
      dirCount,
      errorCount,
      currentPath,
      lastProgressTime,
      possiblyStuck: Date.now() - lastProgressTime > stuckThreshold,
      cancelled,
      paused,
    };
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

    // Track current path for visibility
    currentPath = dir;
    lastProgressTime = Date.now();

    counter++;
    if (counter % 10000 === 0) {
      if (options.onprogress)
        options.onprogress(
          dir,
          name,
          current_size,
          fileCount,
          dirCount,
          errorCount,
        );
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
          path.sep + "Library" + path.sep + "Group Containers" + path.sep,
        ) !== -1 &&
        dir.indexOf("OneDrive") !== -1
      ) {
        return done(dir);
      }
    } catch (e) {}

    // Check if scan was cancelled before lstat
    if (cancelled) {
      return done(dir);
    }

    fs.lstat(dir, (err, stat) => {
      if (err) {
        // Log error but continue scanning
        console.warn("[du] lstat error:", dir, err.code || err.message);
        errorCount++;
        return done(dir);
      }

      // Check if scan was cancelled after lstat
      if (cancelled) {
        return done(dir);
      }

      let size = stat.size;
      if (stat.blocks) {
        current_size += stat.blocks * 512;
      }

      // Skip symbolic links
      if (stat.isSymbolicLink()) return done(dir);

      // Skip special files that could cause hangs (sockets, FIFOs, devices)
      if (stat.isSocket()) {
        console.log("[du] Skipping socket:", dir);
        return done(dir);
      }
      if (stat.isFIFO()) {
        console.log("[du] Skipping FIFO:", dir);
        return done(dir);
      }
      if (stat.isBlockDevice()) {
        console.log("[du] Skipping block device:", dir);
        return done(dir);
      }
      if (stat.isCharacterDevice()) {
        console.log("[du] Skipping character device:", dir);
        return done(dir);
      }

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
        node.children = [];

        fs.readdir(dir, (err, list) => {
          if (err) {
            console.warn("[du] readdir error:", dir, err.code || err.message);
            errorCount++;
            return done(dir);
          }

          var left = list.length;

          function ok(bla) {
            left--;
            if (left === 0) done(name);
          }

          // Process files with pause support
          function processFile(index) {
            if (index >= list.length) {
              if (!left) done(name);
              return;
            }

            // Check for cancellation
            if (cancelled) {
              ok(dir);
              processFile(index + 1);
              return;
            }

            // Check for pause - wait if paused
            if (paused) {
              waitIfPaused().then(() => processFile(index));
              return;
            }

            const file = list[index];
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
                seenInodes: options.seenInodes,
              },
              ok,
            );

            // Process next file (non-blocking to allow pause checks)
            setImmediate(() => processFile(index + 1));
          }

          // Start processing files
          if (list.length > 0) {
            processFile(0);
          } else {
            done(name);
          }
        });

        return;
      }

      // Unknown file type - skip it
      console.log("[du] Skipping unknown file type:", dir);
      return done(dir);
    });
  }

  descendFS.resetCounters = resetCounters;
  descendFS.getStats = getStats;
  descendFS.cancel = cancel;
  descendFS.isCancelled = isCancelled;
  descendFS.pause = pause;
  descendFS.resume = resume;
  descendFS.isPaused = isPaused;
  module.exports = descendFS;
})();
