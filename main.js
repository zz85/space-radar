var app = require('app')
var BrowserWindow = require('browser-window')

var ipc = require('ipc')

require('crash-reporter').start()

var mainWindow = null
var DEBUG = process.env.DEBUG

app.commandLine.appendSwitch('js-flags', '--expose_gc');

app.on('window-all-closed', function() {
  console.log('window all closed');
  // if (process.platform != 'darwin') {
    app.quit()
  // }
})

var ipc_senders = {};

// from viz / du
ipc.on('register', function(event, whoami) {
  console.log('ipc registered', whoami)
  ipc_senders[whoami] = event.sender;

  if ('viz' in ipc_senders && 'du' in ipc_senders) {
    ipc_senders.viz.send('ready')
    ipc_senders.du.send('ready')
  }
})

// simple router
ipc.on('call', function(event, target, channel, a, b, c, d, e) {
  // if (channel != 'progress') console.log('call', target, channel, a, b, c, d, e)
  ipc_senders[target].send(channel, a, b, c, d, e);
})

app.on('ready', function() {
  console.log('app is ready');

  require('./js/start')()

})

