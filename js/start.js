module.exports = opener

DEBUG = 1
function opener() {
  var remote;

  try {
    remote = require('remote')
  } catch (e) {

  }
  console.log('moo', remote)
  var r = remote ? remote.require : require
  var BrowserWindow = r('browser-window')

  var mainWindow = new BrowserWindow({
    width: 1600,
    height: 1300,
    // width: 880,
    // height: 600,
    'min-width': 794,
    'min-height': 480,
    'accept-first-mouse': true,
    'title-bar-style': 'hidden',
    icon: require('path').join(__dirname, 'Icon.png'),
  })

  mainWindow.loadUrl('file://' + __dirname + '/../index.html');
  // mainWindow.loadUrl('file://' + __dirname + '/photon.html');

  if (DEBUG) {
    mainWindow.openDevTools()
  }

  // mainWindow.on('closed', function() {
  //   // console.log('window is closed');
  //   mainWindow = null
  // })
}