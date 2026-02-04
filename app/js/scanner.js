'use strict'

let browser = typeof window !== 'undefined'

if (browser) {
  // it's electron, so typeof(module) !== 'undefined' is true :)
  module.exports = scanner
} else {
  // pure node (when forked inside electron)
  scanner()
}

function scanner() {
  const path = require('path')
  const du = require('./du')
  const duPipe = require('./duPipe')
  const duFromFile = require('./duFromFile')
  const fs = require('fs')
  const utils = require('./utils')
  const log = utils.log
  const TimeoutTask = utils.TimeoutTask
  const TaskChecker = utils.TaskChecker
  const zlib = require('zlib')

  let ipc

  if (browser) {
    ipc = require('electron').ipcRenderer
    const ipc_name = 'du'

    ipc.on('scan', function(_, target) {
      log('got scan')
      go(target)
    })
  } else {
    process.on('disconnect', function() {
      // exit when parent disconnects (killed / exit)
      console.log('parent exited')
      process.exit()
    })

    process.on('message', function(m) {
      console.log('got', m)
      if (m.cmd == 'go') {
        log('scan')
        go(m.msg)
      }
    })
  }

  function go(target) {
    log('go', target)
    const START_REFRESH_INTERVAL = 5000,
      MAX_REFRESH_INTERVAL = 15 * 60 * 1000

    let REFRESH_INTERVAL = START_REFRESH_INTERVAL

    target = path.resolve(target)
    var stat = fs.lstatSync(target)

    let json

    if (stat.isDirectory()) {
      log('Scanning target', target)
      json = {}

      // duPipe.pipe({
      //   parent: target,
      //   node: json,
      //   // onprogress: progress,
      //   // onrefresh: refresh
      //   onstart: () => {
      //     ipc_transfer('du_pipe_start')
      //   }
      // }, complete)

      du(
        {
          parent: target,
          node: json,
          onprogress: progress
          // onrefresh: refresh
        },
        complete
      )
    } else if (stat.isFile()) {
      log('Reading file', target)
      json = new duFromFile.iNode()

      duFromFile(
        {
          parent: target,
          node: json,
          onprogress: progress
          // onrefresh: refresh
        },
        complete
      )
    }

    const refreshTask = new TaskChecker(function(next) {
      log('refresh...')
      ipc_transfer('refresh', json)
      REFRESH_INTERVAL *= 3
      next(Math.min(REFRESH_INTERVAL, MAX_REFRESH_INTERVAL))
    }, REFRESH_INTERVAL)
    refreshTask.schedule()

    console.time('async2')

    function complete(counter) {
      // log("Scan completed", counter, "files");
      console.timeEnd('async2')
      refreshTask.cancel()

      log('complete task, ipc_transferring json', json)
      ipc_transfer('complete', json)
      log('ipc_transfer done')

      // cleanup
      json = null
      du.resetCounters()
    }

    function progress(path, name, size) {
      refreshTask.check()
      ipc_transfer('progress', path, name, size)
    }
  }

  function webviewipc_Transfer() {
    try {
      // webview IPC
      args.unshift('call')
      ipc.sendToHost.apply(ipc, args)
    } catch (e) {
      err = e
      console.error(e)
    }
  }

  /* Local storage IPC */
  function lsipc(json_str) {
    let err
    try {
      // localStorage IPC
      localStorage.lsipc = localStorage.lsipc === json_str ? json_str + ' ' : json_str
    } catch (e) {
      console.error('fail: ')
      log('len', json_str.length)
      err = e
    }

    return err
  }

  function ipc_transfer(...args) {
    const json_str = JSON.stringify(args)
    var err

    err = null

    if (browser) {
      // log('browser ipc');
      // json_str.length > 8192 &&
      if (json_str.length < 10000000) {
        // roughly 10MB payload
        err = lsipc(json_str)
        if (!err) return
      }

      // try {
      //   // electron browser IPC
      //   args.unshift('call')
      //   ipc.send.apply(ipc, args)
      // } catch (e) {
      //   err = e
      //   console.error(e)
      // }

      // if (!err) return
    }

    /* process */

    // if (!browser) {
    //   if (json_str.length > 20000000) {
    //     err = true
    //   } else {
    //     try {
    //       process.send(args)
    //     } catch (e) {
    //       console.error('fail: ')
    //       log('len', json_str.length)
    //       err = e;
    //    }
    //   }

    //   if (!err) return
    // }

    log('process fs ipc')
    err = null
    // fs ipc
    const p = path.join(__dirname, 'fs-ipc.json')
    const before_size = json_str.length
    const zlib_json_str = zlib.deflateSync(json_str)
    log('compression', ((zlib_json_str.length / before_size) * 100).toFixed(2), '% original size')
    fs.writeFileSync(p, zlib_json_str)
    ipc_transfer('fs-ipc', p)
    return
  }
}
