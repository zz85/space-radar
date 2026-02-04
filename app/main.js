"use strict";

let DEBUG = process.env.DEBUG;
const {
  app,
  ipcMain,
  dialog,
  BrowserWindow,
  Menu,
  shell
} = require("electron");
app.commandLine.appendSwitch("js-flags", "--expose_gc");

/*
const crashReporter = require('electron').crashReporter

crashReporter.start({
  productName: 'YourName',
  companyName: 'YourCompany',
  submitURL: 'https://your-domain.com/url-to-submit',
  autoSubmit: true
})
*/

app.on("window-all-closed", function() {
  app.quit();
});

let scannerWin;
let mainWindow;

// Build application menu with color options
function buildAppMenu() {
  const template = [
    {
      label: "Edit",
      submenu: [
        { role: "undo" },
        { role: "redo" },
        { type: "separator" },
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
        { role: "pasteandmatchstyle" },
        { role: "delete" },
        { role: "selectall" }
      ]
    },
    {
      label: "View",
      submenu: [
        { role: "reload" },
        { role: "forcereload" },
        { role: "toggledevtools" },
        { type: "separator" },
        { role: "resetzoom" },
        { role: "zoomin" },
        { role: "zoomout" },
        { type: "separator" },
        { role: "togglefullscreen" }
      ]
    },
    {
      role: "window",
      submenu: [{ role: "minimize" }, { role: "close" }]
    },
    {
      role: "help",
      submenu: [
        {
          label: "Learn More",
          click() {
            shell.openExternal("https://github.com/nicedoc/space-radar");
          }
        }
      ]
    }
  ];

  // macOS-specific menu items
  if (process.platform === "darwin") {
    template.unshift({
      label: app.getName(),
      submenu: [
        { role: "about" },
        { type: "separator" },
        { role: "services", submenu: [] },
        { type: "separator" },
        { role: "hide" },
        { role: "hideothers" },
        { role: "unhide" },
        { type: "separator" },
        { role: "quit" }
      ]
    });

    // Edit menu - add Speech submenu
    template[1].submenu.push(
      { type: "separator" },
      {
        label: "Speech",
        submenu: [{ role: "startspeaking" }, { role: "stopspeaking" }]
      }
    );

    // Window menu
    template[3].submenu = [
      { role: "close" },
      { role: "minimize" },
      { role: "zoom" },
      { type: "separator" },
      { role: "front" }
    ];
  }

  // Color Options menu
  template.push({
    label: "Color Options",
    submenu: [
      {
        type: "radio",
        label: "File extensions - 6 Categories",
        click: () => sendColorChange("scheme", "schemeCat6")
      },
      {
        type: "radio",
        label: "File extensions - 11 Categories",
        click: () => sendColorChange("scheme", "schemeCat11")
      },
      {
        type: "radio",
        label: "File extensions - Hashed",
        checked: true,
        click: () => sendColorChange("scheme", "schemeHue")
      },
      {
        type: "radio",
        label: "Root Colors (Original Scheme)",
        click: () => sendColorChange("mode", "colorByParent")
      },
      {
        type: "radio",
        label: "Root Colors (Numbers)",
        click: () => sendColorChange("mode", "colorByParentName")
      },
      {
        type: "radio",
        label: "Color By Size (Greyscale)",
        click: () => sendColorChange("mode", "colorBySizeBw")
      },
      {
        type: "radio",
        label: "Color By Size",
        click: () => sendColorChange("mode", "colorBySize")
      },
      { type: "separator" }
    ]
  });

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// Send color change to renderer process
function sendColorChange(type, value) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("color-change", { type, value });
  }
}

app.on("ready", function() {
  mainWindow = require("./js/start")();

  // Quit app when main window is closed
  mainWindow.on("closed", function() {
    app.quit();
  });

  // Build the application menu
  buildAppMenu();

  // Debug: log Electron and platform
  console.log(
    "[main] Electron",
    process.versions.electron,
    "Platform",
    process.platform,
    process.arch
  );

  // Create hidden scanner window for background scanning
  scannerWin = new BrowserWindow({
    show: false,
    webPreferences: { nodeIntegration: true, contextIsolation: false }
  });
  scannerWin.loadURL("file://" + __dirname + "/headless.html");

  // IPC handler to open folder selection dialog
  ipcMain.handle("select-folder", async event => {
    try {
      const win = BrowserWindow.getFocusedWindow();
      const result = await dialog.showOpenDialog(win, {
        properties: ["openDirectory"]
      });
      if (result.canceled) return null;
      return (result.filePaths && result.filePaths[0]) || null;
    } catch (err) {
      console.error("[main] select-folder error", err);
      return null;
    }
  });

  // Handle new window request from renderer
  ipcMain.on("new-window", () => {
    const newWin = require("./js/start")();
    // Note: new windows are independent, closing them won't quit the app
  });

  // Forward scan commands from renderer to scanner window
  ipcMain.on("scan-go", (event, targetPath) => {
    try {
      console.log("[main] scan-go", targetPath);
      if (scannerWin && !scannerWin.isDestroyed()) {
        scannerWin.webContents.send("scan", targetPath);
      } else {
        console.error("[main] scanner window unavailable");
      }
    } catch (err) {
      console.error("[main] scan-go error", err);
    }
  });
});
