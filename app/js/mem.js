"use strict";
// memory usage

const child_process = require("child_process");
const isMac = process.platform === "darwin";
const isWindows = process.platform === "win32";

// Load systeminformation globally (used by radar.js for disk space info)
let si;
try {
  si = require("systeminformation");
} catch (e) {
  console.error("Failed to load systeminformation:", e);
  si = null;
}

// macOS native commands (more accurate than systeminformation for memory)
const MAC_PS_CMD = "ps -cx -opid,ppid,rss,comm";
const MAC_VM_STAT = "vm_stat";

// ============== macOS Native Implementation ==============

function stat_macos(out) {
  var r = /page size of (\d+)/.exec(out);
  var page_size = +r[1];

  var m;
  var page_reg = /Pages\s+([^:]+)[^\d]+(\d+)/g;
  var vm_stat = {};

  while ((m = page_reg.exec(out))) {
    vm_stat[m[1]] = m[2] * page_size;
  }

  return vm_stat;
}

function process_out_macos(stdout) {
  var regex = /^\s*(\d+)\s+(\d+)\s+(\d+)\s+(.*)$/gm;
  var m;

  var c = 0,
    rss_sum = 0;
  var pid, ppid, rss, comm, process;
  var all = {};

  while ((m = regex.exec(stdout))) {
    pid = +m[1];
    ppid = +m[2];
    rss = +m[3] * 1024;
    comm = m[4];

    c++;
    rss_sum += rss;

    process = {
      pid: pid,
      ppid: ppid,
      rss: rss,
      comm: comm,
    };

    all[pid] = process;
  }

  var app = {
    name: "App Memory",
    children: [],
  };

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

function mem_macos(callback) {
  let vm_stat;

  child_process.exec(MAC_VM_STAT, (error, stdout, stderr) => {
    if (error) {
      callback(error);
      return console.error(error);
    }

    vm_stat = stat_macos(stdout);

    child_process.exec(MAC_PS_CMD, (error, stdout, stderr) => {
      if (error) {
        callback(error);
        return console.error(error);
      }

      let app = process_out_macos(stdout);
      let top = combine(app, vm_stat);
      callback(null, top);
    });
  });
}

// ============== Cross-platform Implementation (systeminformation) ==============

function buildProcessTree(processList) {
  const all = {};
  let c = 0;
  let rss_sum = 0;

  processList.forEach((proc) => {
    const pid = proc.pid;
    const ppid = proc.parentPid;
    // memRss is in KB, convert to bytes
    const rss = (proc.memRss || 0) * 1024;
    const comm = proc.name || "Unknown";

    if (pid === 0) return;

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

function mem_systeminformation(callback) {
  if (!si) {
    return callback(new Error("systeminformation module not available"));
  }

  Promise.all([si.mem(), si.processes()])
    .then(([memData, processData]) => {
      const memInfo = {
        free: memData.free || 0,
        active: memData.active || memData.used || 0,
        inactive: memData.inactive || 0,
        speculative: memData.speculative || 0,
        "wired down": memData.wired || 0,
        "occupied by compressor": memData.compressed || 0,
      };

      const processInfo = buildProcessTree(processData.list || []);
      const top = combine(processInfo, memInfo);
      callback(null, top);
    })
    .catch((error) => {
      console.error("Memory scan error:", error);
      callback(error);
    });
}

// ============== Common ==============

function combine(app, vm_stat) {
  const top = {
    name: "Memory",
    children: [],
  };

  const diff = vm_stat.active - app.sum;
  const active = {
    name: "Active Memory",
    children: [app.app],
  };

  top.children.push(active);

  // Only add "Kernel / others" if the difference is positive
  if (diff > 0) {
    active.children.push({
      name: "Kernel / others",
      size: diff,
    });
  }

  [
    "free",
    "inactive",
    "speculative",
    "wired down",
    "occupied by compressor",
  ].forEach(function (n) {
    if (vm_stat[n] > 0) {
      top.children.push({
        name: n,
        size: vm_stat[n],
      });
    }
  });

  return top;
}

// ============== Main Entry Point ==============

function mem(callback) {
  if (isMac) {
    // Use native vm_stat and ps commands on macOS for accurate data
    mem_macos(callback);
  } else {
    // Use systeminformation library on Windows/Linux
    mem_systeminformation(callback);
  }
}

if (typeof module !== "undefined") {
  module.exports = mem;
}
