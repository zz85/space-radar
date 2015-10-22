var app = require('app')
var BrowserWindow = require('browser-window')

var ipc = require('ipc')

require('crash-reporter').start()

var mainWindow = null
var duWindow = null


app.on('window-all-closed', function() {
  console.log('window all closed');
  // if (process.platform != 'darwin') {
    app.quit()
  // }
})


ipc.on('ducomms', function(event, arg) {
  console.log('MAIN argum', arg)
  var z = 'hi'
  z = {moo: 'pong', msg: arg}
  // JSON.stringify({moo: 'pong'})
  event.sender.send('ducomms', z);
})

// ipc.send('ducomms', 'hohoho')


app.on('ready', function() {
  console.log('app is ready');
  mainWindow = new BrowserWindow({
    width: 880,
    height: 600
  })

  // {show: false}
  duWindow = new BrowserWindow({
    width: 880,
    height: 600
  })

  // var window2 = new BrowserWindow({width: 800, height: 600});

  mainWindow.loadUrl('file://' + __dirname + '/index.html');
  duWindow.loadUrl('file://' + __dirname + '/headless.html');

  duWindow.openDevTools()
  mainWindow.openDevTools()

  // duWindow.webContents.on('did-finish-load', function() {
  //   duWindow.webContents.send('args', ['test', '1', '2', '3'])
  // })

  mainWindow.on('closed', function() {
    // console.log('window is closed');
    mainWindow = null
    duWindow = null
  })

})

