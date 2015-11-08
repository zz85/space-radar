var remote = require('remote')
// var child_process = require('child_process')

// IPC handling
var current_size = 0, start_time

var path

var legend = d3.select("#legend")
var explanation = d3.select("#explanation")
var core_top = d3.select("#core_top")
var core_center = d3.select("#core_center")
var core_tag = d3.select("#core_tag")

var hue = d3.scale.category10(); // colour hash

function startScan(path) {
  cleanup()
  hidePrompt()
  legend.style('display', 'block')
  log('start', path)
  start_time = performance.now()
  console.time('scan_job')

  sendIpcMsg('go', path)
}

function progress(dir, name, size) {
  // log('[' + ipc_name + '] progress', name)
  // may take a little while
  legend.html("<h2>Scanning... <i>(try grabbing a drink..)</i></h2><p>"+dir+"</p><br/>Scanned: " + format(size) )
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
  legend.html('Generating preview...')

  setTimeout( () => {
    onJson(null, json)
    lightbox(false)
  }, 1000 )
}

function cleanup() {
  // we have a possibility of running out of memory here, we could force a garbage collection to compact memory a little if neede!
  mempoller.cancel()
  lightbox(true)
  graphPlugin.cleanup()

  // memory()
}

function complete(json) {
  log('[' + ipc_name + '] complete..', json)
  console.timeEnd('scan_job')

  console.time('a')
  onJson(null, json)
  legend.style('display', 'none')
  lightbox(false)
  requestAnimationFrame(function() {
    console.timeEnd('a')
  })

  var time_took = performance.now() - start_time
  log('Time took', (time_took / 60 / 1000).toFixed(2), 'mins' )

  // webview.remove()
  // TODO add growl notification here
}

const DEBUG = 0 // process.ENV.DEBUG
const ipc_name = 'viz'
const fs = require('fs')
  var win

  var main_ipc = remote.require('ipc')

  main_ipc.on('call', function(event, cmd) {
    var args = Array.prototype.slice.call(arguments, 2)
    handleIPC(cmd, args)
  })

function setupRemoteIPC() {
  var BrowserWindow = remote.require('browser-window')
  win = new BrowserWindow(
    DEBUG ? { width: 800, height: 600 } : { show: false }
  )
  win.loadUrl('file://' + __dirname + '/headless.html');
  if (DEBUG) win.openDevTools()

  win.webContents.on('did-finish-load', function() {
    // win.webContents.send('ready')
    ready()
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
    // var cmd = event.channel
    var cmd = args.shift()
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
    log('lets go')
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

window.onbeforeunload = function(e) {
  console.log('Closing time!!!!')
  if (win) win.close()
  // the better method would be to track client from
  // browser.on('closed')
};

var child
function setupChildIPC() {
  console.log(require('path').join(__dirname, 'js/scanner.js'))
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


  child.stdout.on('data', function (data) {
    console.log('stdout: ' + data);
  });

  child.stderr.setEncoding('utf8')

  child.stderr.on('data', function (data) {
    console.log('stdout: ' + data);
  });

  child.on('close', function (code) {
    console.log('child process exited with code ' + code);
  });

}

setupLocalStorageIPC()
// setupWebViewIPC()
// setupChildIPC()
setupRemoteIPC()
// setupIPC()
// ready() // run this

function sendIpcMsg(cmd, msg) {
  // webview.send('scan', msg)
  // child.send({cmd: cmd, msg: msg})
  win.webContents.send('scan', msg)
}

function ready() {
  // start here
  showPrompt()
  // fsipc('fs-ipc.json')
}

function rerunPage() {
  remote.getCurrentWindow().reload();
}

function showPrompt() {
  shades.style.display = 'flex'
  dir_opener.style.display = 'none'
}

function hidePrompt() {
  shades.style.display = 'none'
  dir_opener.style.display = 'inline-block'
}

function scanRoot() {
  var ok = confirm('This may take some time, continue?')
  if (ok) {
    startScan('/')
  }
}

function newWindow() {
  log('new window')
  var start = require('./js/start')
  start()

  // var BrowserWindow = remote.require('browser-window')
  // var win = new BrowserWindow(
  //   { width: 800, height: 600 }
  // )
  // win.loadUrl('file://' + __dirname + '/index.html');

}

function scanFolder() {
  var dialog = require('remote').require('dialog')
  var selection = dialog.showOpenDialog({ properties: ['openDirectory']})

  if (selection && selection[0]) {
    selectPath(selection[0])
  }

  console.log(selection);
  // 'openFile', 'multiSelections'
}

function scanMemory() {
  mempoller.run()
}


document.ondragover = document.ondrop = function(e) {
  e.preventDefault();
  // prevent anyhow drag
  return false
};

function welcomeDialog() {
  shades.style.display == 'none' ? showPrompt() : hidePrompt()
}

function selectPath(path) {
  var stat = fs.lstatSync(path)
  log('file', stat.isFile(), 'dir', stat.isDirectory())

  if (stat.isFile()) {
    alert('please select a directory!')
    return
  }

  if (stat.isDirectory()) {
    startScan(path);
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
  if (currentNode)
  require('shell')
    .showItemInFolder(key(currentNode))
    // .openExternal(file.path)

  // shell.openItem(fullPath)

  // delete file, woah....
  // shell.moveItemToTrash(fullPath)

}

function onJson(error, data) {
  if (error) throw error;
  fs.writeFileSync('lastload.json', JSON.stringify(data));
  graphPlugin.generate(data);
}

function loadLast() {
  var json = JSON.parse(fs.readFileSync('lastload.json'));
  complete(json);
}

function showSunburst() {
  treemap_button.classList.remove('active')
  sunburst_button.classList.add('active')
  graphPlugin = sunburstGraph
  loadLast()
  d3.select('.svg-container').style('display', 'inline-block')
  d3.select('canvas').style('display', 'none')
}

function showTreemap() {
  sunburst_button.classList.remove('active')
  treemap_button.classList.add('active')
  graphPlugin = treemapGraph
  loadLast()
  d3.select('.svg-container').style('display', 'none')
  d3.select('canvas').style('display', 'inline-block')
}

var graphPlugin

/*****************
 * Graph Plugins
 * .resize()
 * .generate(json)
 * .showMore()
 * .showLess()
 * .navigateUp()
 *  TODO
 * .cleanup()
 */

var treemapGraph = TreeMap()
var sunburstGraph = SunBurst()

graphPlugin = sunburstGraph

showSunburst()
// showTreemap()

d3.select(window).on('resize', function() {
  graphPlugin.resize()
})
