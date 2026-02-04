'use strict'

let DEBUG = process.env.DEBUG
const { app, ipcMain, dialog, BrowserWindow } = require('electron')
app.commandLine.appendSwitch('js-flags', '--expose_gc')

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

let scannerWin

app.on('ready', function() {
  require('./js/start')()

  // Debug: log Electron and platform
  console.log('[main] Electron', process.versions.electron, 'Platform', process.platform, process.arch)

  // Create hidden scanner window for background scanning
  scannerWin = new BrowserWindow({ show: false, webPreferences: { nodeIntegration: true, contextIsolation: false } })
  scannerWin.loadURL('file://' + __dirname + '/headless.html')

  // IPC handler to open folder selection dialog
  ipcMain.handle('select-folder', async (event) => {
    try {
      const win = BrowserWindow.getFocusedWindow()
      const result = await dialog.showOpenDialog(win, { properties: ['openDirectory'] })
      if (result.canceled) return null
      return (result.filePaths && result.filePaths[0]) || null
    } catch (err) {
      console.error('[main] select-folder error', err)
      return null
    }
  })

  // Forward scan commands from renderer to scanner window
  ipcMain.on('scan-go', (event, targetPath) => {
    try {
      console.log('[main] scan-go', targetPath)
      if (scannerWin && !scannerWin.isDestroyed()) {
        scannerWin.webContents.send('scan', targetPath)
      } else {
        console.error('[main] scanner window unavailable')
      }
    } catch (err) {
      console.error('[main] scan-go error', err)
    }
  })
})