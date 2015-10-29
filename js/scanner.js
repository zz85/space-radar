'use strict';


const path = require('path')
const du = require('./du')
const utils = require('./utils'),
  log = utils.log,
  TimeoutTask = utils.TimeoutTask

// const ipc = require('ipc')
const ipc_name = 'du'
const fs = require('fs')

process.on('disconnect', function() {
  // exit when parent disconnects (killed / exit)
  console.log('parent exited')
  process.exit();
})

process.on('message', function(m) {
  console.log('got', m)
  if (m.scan) {
    log('scan')
    go(m.scan)
  }
})

function go(target) {
  let
    START_REFRESH_INTERVAL = 5000,
    REFRESH_INTERVAL = START_REFRESH_INTERVAL,
    MAX_REFRESH_INTERVAL = 15 * 60 * 1000

  let json = {}
  let refreshTask = new TimeoutTask(function(next) {
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

      // // cache
      // console.time('write')
      // fs.writeFileSync('test.json', JSON.stringify(json))
      // console.timeEnd('write')
  };

  function progress(path, name, size) {
    transfer('progress', path, name, size)
  }

  target = path.resolve(target)
  log('Scanning target', target)

  du({
      parent: target,
      node: json,
      onprogress: progress,
      // onrefresh: refresh
    }, complete)

  refreshTask.schedule()

  // // for testing purposes only
  // log('moew')
  // json = fs.readFileSync('experiments/root.json', { encoding: 'utf-8'})
  // log(json.length)
  // transfer('complete', JSON.parse(json))

}

function transfer(target) {
  var args = Array.prototype.slice.call(arguments)

  var jsonstr = JSON.stringify(args)
  var err;
  if (jsonstr.length > 10000000) {
    err = true
  } else {
    try {
      process.send(args)
    } catch (e) {
      console.error('fail: ')
      log('len', jsonstr.length)
      err = e;
   }
  }

  if (err) {
    err = null
    let p = path.join(__dirname, 'fs-ipc.json')
    fs.writeFileSync(p, jsonstr, { encoding: 'utf-8' })
    transfer('fs-ipc', p)
    return
  }



  if (err) {
    err = null
    try {
      // fallback to electron browser IPC
      args.unshift('call', 'viz')
      ipc.send.apply(ipc, args)
    } catch (e) {
      err = e
      console.error(e)
    }
  }
}
