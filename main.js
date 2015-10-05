var app = require('app')
var BrowserWindow = require('browser-window')

require('crash-reporter').start()

var fs = require('fs');
var main = fs.readFileSync('main.js')
console.log(main + '');


var mainWindow = null

app.on('window-all-closed', function() {
  console.log('window all closed');
  if (process.platform != 'darwin') {
    app.quit()
  }
})

app.on('ready', function() {

  console.log('app is ready');

  mainWindow = new BrowserWindow({
    width: 880,
    height: 600
  })

  mainWindow.loadUrl('file://' + __dirname + '/index.html');

  mainWindow.openDevTools()

  mainWindow.on('closed', function() {
    console.log('window is closed');
    mainWindow = null
  })
})
