'use strict'

let DEBUG = process.env.DEBUG
let app = require('app')
app.commandLine.appendSwitch('js-flags', '--expose_gc');

require('crash-reporter').start()

app.on('window-all-closed', function() {
  if (process.platform != 'darwin') {
    app.quit()
  }
})

app.on('ready', function() {
  require('./js/start')()
})