/* globals: handleIPC */
const DEBUG = process.env.DEBUG //
const { remote } = require('electron')

const ipc_name = 'viz'
const fs = require('fs')
const zlib = require('zlib')

let win

setupLocalStorageIPC()
// setupWebViewIPC()
// setupChildIPC()
setupRemoteIPC()
// setupIPC()
// ready() // run this

function setupLocalStorageIPC() {
  window.addEventListener('storage', function(e) {
    if (e.key == 'lsipc') {
      var args = JSON.parse(e.newValue)
      var cmd = args.shift()
      handleIPC(cmd, args)
    }
  })
}

function sendIpcMsg(cmd, msg) {
  // webview.send('scan', msg)
  // child.send({cmd: cmd, msg: msg})
  win.webContents.send('scan', msg)
}

// ----------------------- //
// Remote IPC //
// -------------------------//

var main_ipc = remote.ipcMain

main_ipc.on('call', function(event, cmd) {
  var args = Array.prototype.slice.call(arguments, 2)
  handleIPC(cmd, args)
})

function setupRemoteIPC() {
  win = new remote.BrowserWindow(DEBUG ? { width: 800, height: 600 } : { show: false })
  win.loadURL('file://' + __dirname + '/headless.html')
  if (DEBUG) win.openDevTools()

  win.webContents.on('did-finish-load', function() {
    // win.webContents.send('ready')
    ready()
  })
}

window.onbeforeunload = function(e) {
  console.log('Closing time!!!!')
  if (win) win.close()
  // the better method would be to track client from
  // browser.on('closed')
}

// ---------------------- //
// Child Process IPC
// -----------------------//
// const child_process = require('child_process')

var child
function setupChildIPC() {
  console.log(path.join(__dirname, 'js/scanner.js'))
  log('process.execArgv', process.execArgv, 'execPath', process.execPath)
  child = child_process.fork('./js/scanner.js', {
    env: process.ENV,
    silent: true
  })

  // child = child_process.spawn(process.execPath, ['./js/scanner.js'], {
  //   env: process.ENV,
  //   stdio: ['pipe', 'pipe', 'pipe', 'ipc']
  // })

  child.on('message', function(args) {
    var cmd = args.shift()
    handleIPC(cmd, args)
  })

  // child.on('error', console.log.bind(console))

  child.stdout.on('data', function(data) {
    console.log('stdout: ' + data)
  })

  child.stderr.setEncoding('utf8')

  child.stderr.on('data', function(data) {
    console.log('stdout: ' + data)
  })

  child.on('close', function(code) {
    console.log('child process exited with code ' + code)
  })
}

// -------------------- //
// Web View IPC
// -------------------- //
function setupWebViewIPC() {
  webview.addEventListener('dom-ready', function() {
    if (DEBUG) {
      webview.openDevTools()
    }
    webview.style.display = 'none'
  })

  webview.addEventListener('ipc-message', function(event) {
    var args = event.args
    // var cmd = event.channel
    var cmd = args.shift()
    handleIPC(cmd, args)
  })

  // this triggers ready
  webview.addEventListener('did-finish-load', ready)
}

// ------------ //
// Electron IPC //
// ------------ //
function setupIPC() {
  var ipc = require('ipc')

  ipc.send('register', ipc_name)

  ipc.on('message', function(arg) {
    log('[' + ipc_name + '] message', arg)
  })

  ipc.on('ready', function(arg) {
    log('lets go')
  })

  // ipc listeners
  ipc.on('progress', progress)
  ipc.on('refresh', refresh)
  ipc.on('complete', complete)
}

module.export = {
  sendIpcMsg: sendIpcMsg
}
