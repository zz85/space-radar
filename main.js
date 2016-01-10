'use strict'

let DEBUG = process.env.DEBUG
let app = require('app')
app.commandLine.appendSwitch('js-flags', '--expose_gc');

/*
const crashReporter = require('electron').crashReporter

crashReporter.start({
  productName: 'YourName',
  companyName: 'YourCompany',
  submitURL: 'https://your-domain.com/url-to-submit',
  autoSubmit: true
})
*/

app.on('window-all-closed', function() {
  if (process.platform != 'darwin') {
    app.quit()
  }
})

app.on('ready', function() {
  require('./js/start')()
})