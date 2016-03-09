'use strict';

let browser = typeof(window) !== 'undefined'

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
  const duFromFile = require('./duFromFile')
  const fs = require('fs')
  const utils = require('./utils')
  const log = utils.log
  const TimeoutTask = utils.TimeoutTask
  const TaskChecker = utils.TaskChecker

  let ipc

  if (browser) {
    ipc = require("electron").ipcRenderer
    const ipc_name = 'du'

    ipc.on('scan', function(_, target) {
      log('got scan')
      go(target)
    })
  } else {
    process.on('disconnect', function() {
      // exit when parent disconnects (killed / exit)
      console.log('parent exited')
      process.exit();
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
    let
      START_REFRESH_INTERVAL = 5000,
      REFRESH_INTERVAL = START_REFRESH_INTERVAL,
      MAX_REFRESH_INTERVAL = 15 * 60 * 1000

    let json = {}
    let refreshTask = new TaskChecker(function(next) {
      log('refresh...')
      transfer('refresh', json)
      REFRESH_INTERVAL *= 3
      next(Math.min(REFRESH_INTERVAL, MAX_REFRESH_INTERVAL))
    }, REFRESH_INTERVAL)

    console.time('async2')

    function complete(counter) {
        // log("Scan completed", counter, "files");
        console.timeEnd('async2')
        refreshTask.cancel()

        log(json);
        transfer('complete', json)
        log('ok')

        // cleanup
        json = {}
        du.resetCounters()
    };

    function progress(path, name, size) {
      refreshTask.check()
      transfer('progress', path, name, size)
    }

    target = path.resolve(target)

    var stat = fs.lstatSync(target)
    if (stat.isDirectory()) {
      log('Scanning target', target)

      du({
        parent: target,
        node: json,
        onprogress: progress,
        // onrefresh: refresh
      }, complete)
    } else if (stat.isFile()) {
      log('Reading file', target)

      duFromFile({
        parent: target,
        node: json,
        onprogress: progress,
        // onrefresh: refresh
      }, complete)
    }

    refreshTask.schedule()
  }

  function webviewTransfer() {
    try {
      // webview IPC
      args.unshift('call')
      ipc.sendToHost.apply(ipc, args)
    } catch (e) {
      err = e
      console.error(e)
    }
  }

  function lsipc(jsonstr) {
    let err
    try {
      // localStorage IPC
      localStorage.lsipc = localStorage.lsipc === jsonstr ? jsonstr + ' ' : jsonstr
    } catch (e) {
      console.error('fail: ')
      log('len', jsonstr.length)
      err = e;
    }

    return err
  }

  function transfer(target) {
    var args = Array.prototype.slice.call(arguments)

    var jsonstr = JSON.stringify(args)
    var err;

    err = null

    if (browser) {
      // jsonstr.length > 8192 &&
      if (jsonstr.length < 10000000) {
        err = lsipc(jsonstr)
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
    //   if (jsonstr.length > 20000000) {
    //     err = true
    //   } else {
    //     try {
    //       process.send(args)
    //     } catch (e) {
    //       console.error('fail: ')
    //       log('len', jsonstr.length)
    //       err = e;
    //    }
    //   }

    //   if (!err) return
    // }

    err = null
    // fs ipc
    let p = path.join(__dirname, 'fs-ipc.json')
    fs.writeFileSync(p, jsonstr, { encoding: 'utf-8' })
    transfer('fs-ipc', p)
    return
  }
}
