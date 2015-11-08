'use strict'

module.exports = opener


function opener() {
  var remote;

  let DEBUG = 0

  try {
    remote = require('remote')
  } catch (e) {

  }
  console.log('moo', remote)
  var r = remote ? remote.require : require

  var atomScreen = r('screen');
  var size = atomScreen.getPrimaryDisplay().workAreaSize
  console.log(size)

  var BrowserWindow = r('browser-window')

  var
    minw = 794,
    minh = 480,
    height = Math.max(size.height * 0.8, 600) | 0, // 1300, 600
    width = Math.max(height * 6 / 8, 880) | 0 //1600,880

  var mainWindow = new BrowserWindow({
    width: width,
    height: height,
    'min-width': minw,
    'min-height': minh,
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