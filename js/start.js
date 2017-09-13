'use strict'

module.exports = opener

function opener() {
  var remote

  let DEBUG = 0

  let electron = require('electron')

  try {
    remote = electron.remote
  } catch (e) {
    console.log('cannot require', e)
  }

  electron = remote || electron
  var atomScreen = electron.screen
  var size = atomScreen.getPrimaryDisplay().workAreaSize
  console.log(size)

  var BrowserWindow = electron.BrowserWindow

  var minw = 794,
    minh = 480,
    height = Math.max(size.height * 0.8, 600) | 0, // 1300, 600
    width = Math.max(height * 6 / 8, 880) | 0 //1600,880

  var mainWindow = new BrowserWindow({
    width: width,
    height: height,
    minWidth: minw,
    minHeight: minh,
    acceptFirstMouse: true,
    // frame: false, // new api to hide
    // transparent: true,
    titleBarStyle: 'hidden', // hidden hiddenInset customButtonsOnHover
    icon: require('path').join(__dirname, 'Icon.png')
  })

  mainWindow.loadURL('file://' + __dirname + '/../index.html')

  if (DEBUG) {
    mainWindow.openDevTools()
  }

  // mainWindow.on('closed', function() {
  //   // console.log('window is closed');
  //   mainWindow = null
  // })
}
