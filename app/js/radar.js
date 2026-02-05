'use strict'

const { shell } = require('electron')
const path = require('path')
const si = require('systeminformation')

const LASTLOAD_FILE = path.join(__dirname, 'lastload.json')

// IPC handling
function sendIpcMsg(cmd, msg) {
  try {
    const { ipcRenderer } = require('electron')
    if (cmd === 'go') {
      console.log('[renderer] sending scan-go', msg)
      ipcRenderer.send('scan-go', msg)
    }
  } catch (err) {
    console.error('[renderer] sendIpcMsg error', err)
  }
}

var current_size = 0,
  start_time

var legend = d3.select('#legend')

// Function to get disk space info for a given path
function getDiskSpaceInfo(scanPath, callback) {
  si.fsSize()
    .then(drives => {
      // Find the drive that contains the scan path
      const drive = drives.find(d => {
        // Check if the scan path starts with the mount point
        return scanPath.startsWith(d.mount)
      }) || drives[0] // fallback to first drive if no match
      
      if (drive) {
        callback({
          total: drive.size,
          used: drive.used,
          available: drive.available,
          usePercent: drive.use
        })
      }
    })
    .catch(err => {
      console.error('Error getting disk space info:', err)
    })
}

function startScan(path) {
  cleanup()
  hidePrompt()
  State.clearNavigation()
  legend.style('display', 'block')
  log('start', path)
  start_time = performance.now()
  console.time('scan_job_time')

  var stat = fs.lstatSync(path)
  log('file', stat.isFile(), 'dir', stat.isDirectory())

  // Get and display disk space info
  getDiskSpaceInfo(path, diskInfo => {
    const diskInfoText = `Total: ${format(diskInfo.total)} | Free: ${format(diskInfo.available)} | Used: ${format(diskInfo.used)} (${diskInfo.usePercent.toFixed(2)}%) | `
    const diskSpaceElement = document.getElementById('disk_space_info')
    if (diskSpaceElement) {
      diskSpaceElement.textContent = diskInfoText
    }
  })

  // return sendIpcMsg('go', path);
  if (stat.isFile()) {
    const json = new duFromFile.iNode()
    duFromFile(
      {
        parent: path,
        node: json,
        onprogress: progress
        // onrefresh: refresh
      },
      () => {
        complete(json)
      }
    )
  } else {
    sendIpcMsg('go', path)
  }
}

function start_read() {
  console.log('start_read')

  const json = new duFromFile.iNode()
  duFromFile(
    {
      parent: './output.txt',
      node: json,
      onprogress: progress
      // onrefresh: refresh
    },
    () => {
      return complete(json)
    }
  )
}

function progress(dir, name, size) {
  // log('[' + ipc_name + '] progress', name)
  // may take a little while
  legend.html('<h2>Scanning... <i>(try grabbing a drink..)</i></h2><p>' + dir + '</p><br/>Scanned: ' + format(size))
  current_size = size
  // TODO collect number of files too
}

function lightbox(show) {
  loading.style.display = show ? 'block' : 'none'
  shades.style.display = show ? 'flex' : 'none'
  promptbox.style.display = show ? 'none' : ''
  shades.style.opacity = show ? 0.8 : 1
}

function refresh(json) {
  log('[' + ipc_name + '] refresh..')

  // should disable all inputs here because redraw would probably be intensive
  lightbox(true)
  legend.html('Generating preview...')

  setTimeout(() => {
    onJson(null, json)
    lightbox(false)
  }, 1000)
}

function cleanup() {
  // we have a possibility of running out of memory here, we could force a garbage collection to compact memory a little if neede!
  mempoller.cancel()
  lightbox(true)
  PluginManager.cleanup()

  // memory()
}

function complete(json) {
  log('[' + ipc_name + '] complete..', json)
  console.timeEnd('scan_job_time')

  console.time('a')
  onJson(null, json)
  legend.style('display', 'none')
  lightbox(false)
  requestAnimationFrame(function() {
    console.timeEnd('a')
  })

  var time_took = performance.now() - start_time
  log('Time took', (time_took / 60 / 1000).toFixed(2), 'mins')

  // webview.remove()
  // TODO add growl notification here
  // shell.beep() // disabling as this can be anonying for memory monitor
}

function handleIPC(cmd, args) {
  try { console.log('[renderer] handleIPC', cmd) } catch (e) {}
  switch (cmd) {
    case 'progress':
      return progress.apply(null, args)
    case 'refresh':
      return refresh.apply(null, args)
    case 'complete':
      try { console.log('[renderer] complete received') } catch (e) {}
      return complete(args[0])
    case 'fs-ipc':
      try { console.log('[renderer] fs-ipc received', args && args[0]) } catch (e) {}
      return fsipc(args[0])
    case 'du_pipe_start':
      return start_read()
  }
}

function runNext(f) {
  setTimeout(f, 10)
}

function fsipc(filename) {
  console.time('fsipc')
  cleanup()
  log(filename)

  runNext(() => {
    try {
      var args = fs.readFileSync(filename)
      args = zlib.inflateSync(args)
      args = JSON.parse(args)
      var cmd = args.shift()
      try { console.log('[renderer] fsipc dispatch', cmd) } catch (e) {}
      handleIPC(cmd, args)
    } catch (e) {
      console.error(e.stack)
    }
    console.timeEnd('fsipc')
  })
}

function ready() {
  // start here
  showPrompt()
  try {
    console.log('[renderer] auto-opening folder picker on startup')
    scanFolder()
  } catch (e) {
    console.error('[renderer] auto-open picker failed', e)
  }
  // fsipc('fs-ipc.json')
}

// Ensure ready() runs when DOM is loaded regardless of IPC bootstrap
try {
  if (document && document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', ready)
  } else {
    // Document already ready
    ready()
  }
} catch (e) {
  console.error('[renderer] failed to register DOMContentLoaded', e)
}

function rerunPage() {
  remote.getCurrentWindow().reload()
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
}

function scanFolder() {
  try {
    console.log('[renderer] scanFolder invoked')
    const { ipcRenderer } = require('electron')
    Promise.resolve(ipcRenderer.invoke('select-folder')).then((selectedPath) => {
      console.log('[renderer] select-folder result', selectedPath)
      if (selectedPath) {
        selectPath(selectedPath)
      } else {
        console.log('[renderer] Folder selection canceled or failed')
      }
    }).catch((err) => {
      console.error('[renderer] select-folder IPC error', err)
    })
  } catch (err) {
    console.error('[renderer] scanFolder error', err)
  }
}

function readFile() {
  var dialog = remote.dialog
  var selection = dialog.showOpenDialog({ properties: ['openFile'] })

  if (selection && selection[0]) {
    const file = selection[0]
    selectPath(file)
  }
}

function scanMemory() {
  mempoller.run()
}

document.ondragover = document.ondrop = function(e) {
  e.preventDefault()
  // prevent anyhow drag
  return false
}

function welcomeDialog() {
  shades.style.display == 'none' ? showPrompt() : hidePrompt()
}

function selectPath(path) {
  startScan(path)
  return
}

var promptbox = document.getElementById('promptbox')
promptbox.ondragover = function() {
  this.className = 'hover'
  return false
}
promptbox.ondragleave = promptbox.ondragend = function() {
  this.className = ''
  return false
}
promptbox.ondrop = function(e) {
  this.className = ''
  e.preventDefault()
  var file = e.dataTransfer.files[0]

  console.log('file', file)
  // return
  if (file) return selectPath(file.path)
}

/*** Selection Handling ****/

function openDirectory() {
  let loc = Navigation.currentPath()
  if (loc) shell.showItemInFolder(loc.join(PATH_DELIMITER))
}

function openSelection() {
  if (selection && !selection.children) {
    let file = key(selection)
    log('open selection', file)
    shell.openItem(file)
  }
}

function externalSelection() {
  if (selection) {
    let file = key(selection)
    log('openExternal selection', file)
    shell.openExternal(file)
  }
}

function showSelection() {
  if (selection) {
    let file = key(selection)
    log('show selection', file)
    shell.showItemInFolder(file)
  }
}

function trashSelection() {
  if (selection) {
    let file = key(selection)
    var ok = confirm('Are you sure you wish to send ' + file + ' to the trash?')
    if (ok) {
      log('trash selection', file)
      if (shell.moveItemToTrash(file)) {
        alert(file + ' moved to trash!\n(currently needs rescan to update graphs)')
        shell.beep()
      }
    }
  }
}

/*** Data Loading ****/

function onJson(error, data) {
  if (error) throw error

  const jsonStr = JSON.stringify(data)
  const before = Buffer.byteLength(jsonStr)
  const zJsonStr = zlib.deflateSync(jsonStr)
  const after = Buffer.byteLength(zJsonStr)
  console.log('ONJSON', before, after, ((before - after) / after).toFixed(2))

  fs.writeFileSync(LASTLOAD_FILE, zJsonStr)
  PluginManager.generate(data)
  // PluginManager.loadLast()
}

function _loadLast() {
  return JSON.parse(zlib.inflateSync(fs.readFileSync(LASTLOAD_FILE)))
}

function hideAll() {
  // toggle button states
  ;[...document.querySelectorAll('.mode_buttons')].forEach(button => button.classList.remove('active'))
  ;[...document.querySelectorAll('.graph-container')].forEach(el => (el.style.display = 'none'))

  // // hide sunburst
  // d3.select('#sunburst-chart').style('display', 'none')

  // // hide treemap canvas
  // d3.select('canvas').style('display', 'none')

  // // hide flamegraph
  // document.getElementById('flame-chart').style.display = 'none'
}

function deactivateCharts() {
  ;[sunburstGraph, treemapGraph, flamegraphGraph].forEach(chart => PluginManager.deactivate(chart))
}

function showSunburst() {
  hideAll()
  sunburst_button.classList.add('active')
  d3.select('#sunburst-chart').style('display', 'inline-block')

  deactivateCharts()
  PluginManager.activate(sunburstGraph)
}

function showTreemap() {
  hideAll()
  treemap_button.classList.add('active')
  d3.select('canvas').style('display', 'inline-block')

  deactivateCharts()
  PluginManager.activate(treemapGraph)
}

function showFlamegraph() {
  hideAll()
  flamegraph_button.classList.add('active')
  document.getElementById('flame-chart').style.display = 'inline-block'

  deactivateCharts()
  PluginManager.activate(flamegraphGraph)
}

d3.select(window).on('resize', function() {
  PluginManager.resize()
})
