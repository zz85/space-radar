var app = require('app')
var BrowserWindow = require('browser-window')

var ipc = require('ipc')

require('crash-reporter').start()

var mainWindow = null
var DEBUG = process.env.DEBUG

app.commandLine.appendSwitch('js-flags', '--expose_gc');

app.on('window-all-closed', function() {
  console.log('window all closed');
  if (process.platform != 'darwin') {
    app.quit()
  }
})

app.on('ready', function() {
  console.log('app is ready');

  require('./js/start')()

})