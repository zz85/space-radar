// IPC handling
var current_size = 0, start_time

function start(path) {
  cleanup()
  hidePrompt()
  legend.style('display', 'block')
  log('start', path)
  start_time = performance.now()
  console.time('scan_job')
  webview.send('scan', path)
}

function progress(dir, name, size) {
  // log('[' + ipc_name + '] progress', name)
  legend.html("<h2>Scanning... <i>please be patient</i></h2><p>"+dir+"</p><br/>Scanned: " + format(size) )
  current_size = size
  // TODO collect number of files too
}

function lightbox(show) {
  loading.style.display = show ? 'block' : 'none'
  shades.style.display = show ? 'flex' : 'none'
  promptbox.style.display  = show ? 'none': ''
  shades.style.opacity = show ? 0.8 : 1
}

function refresh(json) {
  log('[' + ipc_name + '] refresh..')


  // should disable all inputs here because redraw would probably be intensive
  lightbox(true)

  setTimeout( () => {
    onJson(null, json)
    lightbox(false)
  }, 1000 )
}

function cleanup() {
  // we have a possibility of running out of memory here, we could force a garbage collection to compact memory a little if neede!

  lightbox(true)

  if (path) {
    // do some GC()!!!
    path.remove()
    center.remove()

    d3
    .select("#sequence")
    .select('div')
      .selectAll("a")
      .remove()

    partition = null
    realroot = current_p = null
    path = center = null

    jsoned = false
  }

  // memory()
}

function complete(json) {
  // loading.style.display = 'none'
  log('[' + ipc_name + '] complete..', json)
  console.timeEnd('scan_job')

  onJson(null, json)
  legend.style('display', 'none')
  lightbox(false)

  var time_took = performance.now() - start_time
  log('Time took', (time_took / 60 / 1000).toFixed(2), 'mins' )
  lightbox(false)

  // webview.remove()
  // TODO add growl notification here
}

const DEBUG = 0
const ipc_name = 'viz'
const fs = require('fs')

function spawnRenderer() {
  var remote = require('remote')
  var BrowserWindow = remote.require('browser-window')
  var win = new BrowserWindow(
    DEBUG ? { width: 800, height: 600 } : { show: false }
  )
  win.loadUrl('file://' + __dirname + '/headless.html');
  if (DEBUG) win.openDevTools()

  win.webContents.on('did-finish-load', function() {
    win.webContents.send('ready')
  })
}

function setupWebViewIPC() {

  //
  webview.addEventListener("dom-ready", function() {
    if (DEBUG) {
      webview.openDevTools()
    }
    webview.style.display = 'none'
  })

  webview.addEventListener('ipc-message', function(event) {
    var args = event.args
    var cmd = event.channel
    handleIPC(cmd, args)
  });

  // this triggers ready
  webview.addEventListener('did-finish-load', ready)
}

function handleIPC(cmd, args) {
  switch (cmd) {
    case 'progress':
      return progress.apply(null, args)
    case 'refresh':
      return refresh.apply(null, args)
    case 'complete':
      return complete(args[0])
    case 'fs-ipc':
      return fsipc(args[0])
  }
}

function runNext(f) {
  setTimeout( f, 1000 )
}

function fsipc(filename) {
  console.time('fsipc');
  cleanup()
  log(filename)

  runNext( () => {
    try {
      var args = fs.readFileSync(filename, {encoding: 'utf-8'})
      args = JSON.parse(args)
      var cmd = args.shift()
      handleIPC(cmd, args)
    } catch (e) {
      console.error(e.stack)
    }
    console.timeEnd('fsipc');

  })
}

function setupIPC() {
  var ipc = require('ipc')

  ipc.send('register', ipc_name)

  ipc.on('message', function(arg) {
    log('[' + ipc_name + '] message', arg)
  })

  ipc.on('ready', function(arg) {
    log('lets go');
    loading.style.display = 'inline-block'
  })

  // ipc listeners
  ipc.on('progress', progress)
  ipc.on('refresh', refresh)
  ipc.on('complete', complete)
}

function setupLocalStorageIPC() {
  window.addEventListener('storage', function (e) {
    if (e.key == 'lsipc') {
      var args = JSON.parse(e.newValue)
      var cmd = args.shift()
      handleIPC(cmd, args)
    }
  });
}

setupLocalStorageIPC()
setupWebViewIPC()

function ready() {
  // start here
  showPrompt()
  // fsipc('fs-ipc.json')
}

function rerunPage() {
  var remote = require('remote');
  remote.getCurrentWindow().reload();
}

function showPrompt() {
  shades.style.display = 'flex'
  dir_opener.style.display = 'none'

  mempoller.cancel()
}

function scanMemory() {
  mempoller.run()
}

function hidePrompt() {
  shades.style.display = 'none'
  dir_opener.style.display = 'inline-block'
}

function scanroot() {
  var ok = confirm('This may take some time, continue?')
  if (ok) {
    start('/')
  }
}

document.ondragover = document.ondrop = function(e) {
  e.preventDefault();
  // prevent anyhow drag
  return false
};

function browseDialog() {
  var dialog = require('remote').require('dialog')
  var selection = dialog.showOpenDialog({ properties: [  'openDirectory']})

  if (selection && selection[0]) {
    selectPath(selection[0])
  }

  console.log(selection);
  // 'openFile', 'multiSelections'
}

function selectPath(path) {
  var stat = fs.lstatSync(path)
  log('file', stat.isFile(), 'dir', stat.isDirectory())

  if (stat.isFile()) {
    alert('please select a directory!')
    return
  }

  if (stat.isDirectory()) {
    // var ok = confirm('Scan ' + path + '?')
    // if (ok) {
    start(path);
    // }
    return
  }
}

var promptbox = document.getElementById('promptbox');
promptbox.ondragover = function () {
  this.className = 'hover';
  return false;
};
promptbox.ondragleave = promptbox.ondragend = function () {
  this.className = '';
  return false;
};
promptbox.ondrop = function (e) {
  this.className = '';
  e.preventDefault();
  var file = e.dataTransfer.files[0];

  console.log('file', file)
  // return
  if (file)
    return selectPath(file.path);
};

function openDirectory() {
  if (current_p)
  require('shell')
    .showItemInFolder(key(current_p))
    // .openExternal(file.path)

  // shell.openItem(fullPath)

  // delete file, woah....
  // shell.moveItemToTrash(fullPath)

}

// // testing test.json experiments/root.json experiments/mem
// d3.json("test.json", function(x, y) {
//   log(x, y)
//   window.j = y
//   setTimeout(() => complete(y))
// });
