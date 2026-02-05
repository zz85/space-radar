"use strict";
// memory usage

let si;
try {
  si = require("systeminformation");
} catch (e) {
  console.error("Failed to load systeminformation:", e);
  si = null;
}

// Build process tree from flat list of processes
function buildProcessTree(processList) {
  const all = {};
  let c = 0;
  let rss_sum = 0;

  // Build lookup table
  processList.forEach((proc) => {
    const pid = proc.pid;
    const ppid = proc.parentPid;
    // memRss is in KB, convert to bytes
    const rss = (proc.memRss || 0) * 1024;
    const comm = proc.name || "Unknown";

    if (pid === 0) return; // Skip invalid entries

    c++;
    rss_sum += rss;

    all[pid] = {
      pid: pid,
      ppid: ppid,
      rss: rss,
      comm: comm,
    };
  });

  const app = {
    name: "App Memory",
    children: [],
  };

  // Build tree structure
  Object.keys(all)
    .map((k) => all[k])
    .sort((a, b) => a.pid - b.pid)
    .forEach((a) => {
      let parent;
      if (a.ppid in all) {
        parent = all[a.ppid];
      } else {
        parent = app;
      }

      if (!parent.children) {
        parent.children = [];
        parent.children.push({
          name: parent.name,
          size: parent.rss,
          parent: 1,
        });
        delete parent.size;
      }
      parent.children.push(a);

      // cleanup
      a.name = a.comm + " (" + a.pid + ")";
      a.size = a.rss;
      delete a.comm;
      delete a.pid;
      delete a.rss;
      delete a.ppid;
    });

  return {
    app: app,
    sum: rss_sum,
    count: c,
  };
}

function mem(callback) {
  // Use systeminformation library for cross-platform memory and process info
  // Works on Windows (including Windows 11), macOS, and Linux

  if (!si) {
    return callback(new Error("systeminformation module not available"));
  }

  // Get memory and process information in parallel
  Promise.all([si.mem(), si.processes()])
    .then(([memData, processData]) => {
      // Convert systeminformation format to our expected format
      // systeminformation returns: total, free, used, active, available, etc.
      const memInfo = {
        free: memData.free || 0,
        active: memData.active || memData.used || 0,
        inactive: memData.inactive || 0,
        speculative: memData.speculative || 0,
        "wired down": memData.wired || 0,
        "occupied by compressor": memData.compressed || 0,
      };

      // systeminformation returns: all, running, blocked, sleeping, unknown, list
      // list contains array of processes with: pid, parentPid, name, pcpu, pmem, memRss, etc.
      const processInfo = buildProcessTree(processData.list || []);

      // Combine memory and process info
      const top = combine(processInfo, memInfo);
      callback(null, top);
    })
    .catch((error) => {
      console.error("Memory scan error:", error);
      callback(error);
    });
}
/*
free 1782.23046875
active 3630.9453125
inactive 969.33984375
speculative 181.41015625
throttled 0
wired down 1127.02734375
purgeable 655.8984375
copy-on-write 77013.4921875
zero filled 2738058.21484375
reactivated 449955.0703125
purged 607598.33203125
stored in compressor 2739.4296875
occupied by compressor 499.375
*/

function combine(app, vm_stat) {
  const top = {
    name: "Memory",
    children: [],
  };

  // Calculate difference between system-reported active memory and process RSS sum
  // This can be negative if process RSS exceeds active memory (due to shared memory, etc.)
  const diff = vm_stat.active - app.sum;
  const active = {
    name: "Active Memory",
    children: [app.app],
  };

  top.children.push(active);

  // Only add "Kernel / others" if the difference is positive
  // Negative values indicate measurement discrepancy, not actual memory
  if (diff > 0) {
    active.children.push({
      name: "Kernel / others",
      size: diff,
    });
  }

  ["free", "inactive", "speculative", "wired down", "occupied by compressor"]
    //, 'purgeable', 'stored in compressor', 'active',
    .forEach(function (n) {
      if (vm_stat[n] > 0) {
        top.children.push({
          name: n,
          size: vm_stat[n],
        });
      }
    });

  return top;
}
