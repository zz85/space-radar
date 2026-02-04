'use strict'
// memory usage

const si = require('systeminformation')

// Build process tree from flat list of processes
function buildProcessTree(processList) {
  var all = {}
  var c = 0
  var rss_sum = 0

  // Build lookup table
  processList.forEach(proc => {
    var pid = proc.pid
    var ppid = proc.parentPid
    // memRss is in KB, convert to bytes
    var rss = (proc.memRss || 0) * 1024
    var comm = proc.name || 'Unknown'

    if (pid === 0) return // Skip invalid entries

    c++
    rss_sum += rss

    all[pid] = {
      pid: pid,
      ppid: ppid,
      rss: rss,
      comm: comm
    }
  })

  var app = {
    name: 'App Memory',
    children: []
  }

  // Build tree structure
  Object.keys(all)
    .map(k => all[k])
    .sort((a, b) => a.pid - b.pid)
    .forEach(a => {
      var parent
      if (a.ppid in all) {
        parent = all[a.ppid]
      } else {
        parent = app
      }

      if (!parent.children) {
        parent.children = []
        parent.children.push({
          name: parent.name,
          size: parent.rss,
          parent: 1
        })
        delete parent.size
      }
      parent.children.push(a)

      // cleanup
      a.name = a.comm + ' (' + a.pid + ')'
      a.size = a.rss
      delete a.comm
      delete a.pid
      delete a.rss
      delete a.ppid
    })

  return {
    app: app,
    sum: rss_sum,
    count: c
  }
}

function mem(callback) {
  // Use systeminformation library for cross-platform memory and process info
  // Works on Windows (including Windows 11), macOS, and Linux
  
  let memInfo
  let processInfo

  // Get memory information
  si.mem()
    .then(data => {
      // Convert systeminformation format to our expected format
      // systeminformation returns: total, free, used, active, available, etc.
      memInfo = {
        free: data.free || 0,
        active: data.active || data.used || 0,
        inactive: data.inactive || 0,
        speculative: data.speculative || 0,
        'wired down': data.wired || 0,
        'occupied by compressor': data.compressed || 0
      }

      // Get process list with memory info
      return si.processes()
    })
    .then(data => {
      // systeminformation returns: all, running, blocked, sleeping, unknown, list
      // list contains array of processes with: pid, parentPid, name, pcpu, pmem, mem, etc.
      processInfo = buildProcessTree(data.list || [])

      // Combine memory and process info
      const top = combine(processInfo, memInfo)
      callback(null, top)
    })
    .catch(error => {
      console.error('Memory scan error:', error)
      callback(error)
    })
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
  var top = {
    name: 'Memory',
    children: []
  }

  var diff = vm_stat.active - app.sum
  var active = {
    name: 'Active Memory',
    children: [app.app]
  }

  top.children.push(active)

  // app.app
  active.children.push({
    name: 'Kernel / others?',
    size: diff
  })
  ;['free', 'inactive', 'speculative', 'wired down', 'occupied by compressor']
    //, 'purgeable', 'stored in compressor', 'active',
    .forEach(function(n) {
      top.children.push({
        name: n,
        size: vm_stat[n]
      })
    })

  return top
}
