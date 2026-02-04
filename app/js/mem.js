'use strict'
// memory usage

const child_process = require('child_process')
const isWindows = process.platform === 'win32'

// Platform-specific commands
let CMD, VM_STAT

if (isWindows) {
  // Windows: Use WMIC to get process information
  CMD = 'wmic process get ProcessId,ParentProcessId,WorkingSetSize,Name /format:csv'
  // Windows: Use WMIC to get memory information
  VM_STAT = 'wmic OS get FreePhysicalMemory,TotalVisibleMemorySize /format:csv'
} else {
  // macOS/Linux: Use ps command
  CMD = 'ps -cx -opid,ppid,rss,comm'
  // -m sort by memory
  // -c use short process name
  // -x extended (other users)
  // macOS: Use vm_stat
  VM_STAT = 'vm_stat'
}

function stat(out) {
  if (isWindows) {
    return stat_windows(out)
  } else {
    return stat_macos(out)
  }
}

function stat_macos(out) {
  var r = /page size of (\d+)/.exec(out)
  var page_size = +r[1]

  var m

  var page_reg = /Pages\s+([^:]+)[^\d]+(\d+)/g

  var vm_stat = {}

  while ((m = page_reg.exec(out))) {
    // console.log(m[1], m[2] * page_size / 1024 / 1024)
    vm_stat[m[1]] = m[2] * page_size
  }

  return vm_stat
}

function stat_windows(out) {
  // Parse Windows WMIC CSV output
  // Expected format: Node,FreePhysicalMemory,TotalVisibleMemorySize
  var lines = out.trim().split('\n')
  var vm_stat = {}
  
  if (lines.length < 2) return vm_stat
  
  // Find the data line (skip header and empty lines)
  for (var i = 1; i < lines.length; i++) {
    var line = lines[i].trim()
    if (!line) continue
    
    var parts = line.split(',')
    if (parts.length >= 3) {
      // FreePhysicalMemory and TotalVisibleMemorySize are in KB
      var freeMemory = parseInt(parts[1]) * 1024 // Convert to bytes
      var totalMemory = parseInt(parts[2]) * 1024 // Convert to bytes
      
      // Map to macOS-style names for compatibility
      vm_stat['free'] = freeMemory
      vm_stat['active'] = totalMemory - freeMemory
      vm_stat['inactive'] = 0
      vm_stat['speculative'] = 0
      vm_stat['wired down'] = 0
      vm_stat['occupied by compressor'] = 0
      break
    }
  }
  
  return vm_stat
}

function process_out(stdout) {
  if (isWindows) {
    return process_out_windows(stdout)
  } else {
    return process_out_unix(stdout)
  }
}

function process_out_unix(stdout) {
  // log(stdout)
  // var lines = stdout.split("\n");
  var regex = /^\s*(\d+)\s+(\d+)\s+(\d+)\s+(.*)$/gm
  var m

  var c = 0,
    rss_sum = 0
  var pid, ppid, rss, comm, process
  var all = {}
  while ((m = regex.exec(stdout))) {
    pid = +m[1]
    ppid = +m[2]
    rss = +m[3] * 1024
    comm = m[4]

    c++
    rss_sum += rss

    process = {
      pid: pid,
      ppid: ppid,
      rss: rss,
      comm: comm
    }

    all[pid] = process

    // log(c, pid, ppid, rss, comm)
  }

  var app = {
    name: 'App Memory',
    children: []
  }

  let sorted = Object.keys(all)
    .map(k => {
      return all[k]
    })
    .sort((a, b) => {
      return a.pid - b.pid
    })
    .forEach(a => {
      let parent
      if (a.ppid in all) {
        parent = all[a.ppid]
      } else {
        // console.log('top level', a)
        parent = app
      }

      if (!parent.children) {
        parent.children = []
        parent.children.push({
          name: parent.name,
          size: parent.size,
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

  // console.log(app)
  // console.log('rss_sum', rss_sum)
  return {
    app: app,
    sum: rss_sum,
    count: c
  }
}

function process_out_windows(stdout) {
  // Parse Windows WMIC CSV output
  // Expected format: Node,Name,ParentProcessId,ProcessId,WorkingSetSize
  var lines = stdout.trim().split('\n')
  var all = {}
  var c = 0
  var rss_sum = 0
  
  // Skip first line (header)
  for (var i = 1; i < lines.length; i++) {
    var line = lines[i].trim()
    if (!line) continue
    
    var parts = line.split(',')
    if (parts.length >= 5) {
      // CSV format: Node,Name,ParentProcessId,ProcessId,WorkingSetSize
      var name = parts[1] ? parts[1].trim() : 'Unknown'
      var ppid = parseInt(parts[2]) || 0
      var pid = parseInt(parts[3]) || 0
      var rss = parseInt(parts[4]) || 0 // WorkingSetSize is already in bytes
      
      if (pid === 0) continue // Skip invalid entries
      
      c++
      rss_sum += rss
      
      all[pid] = {
        pid: pid,
        ppid: ppid,
        rss: rss,
        comm: name
      }
    }
  }
  
  var app = {
    name: 'App Memory',
    children: []
  }
  
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
          size: parent.size,
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
  let vm_stat

  child_process.exec(VM_STAT, (error, stdout, stderr) => {
    if (error) {
      callback(error)
      return console.error(error)
    }

    vm_stat = stat(stdout)

    child_process.exec(CMD, ps)
  })

  let ps = (error, stdout, stderr) => {
    if (error) {
      callback(error)
      return console.error(error)
    }
    let app = process_out(stdout)

    let top = combine(app, vm_stat)

    callback(null, top)
  }
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
