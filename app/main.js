"use strict";

let DEBUG = process.env.DEBUG;
const {
  app,
  ipcMain,
  dialog,
  BrowserWindow,
  Menu,
  shell,
} = require("electron");
const { autoUpdater } = require("electron-updater");

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

app.on("window-all-closed", function () {
  app.quit();
});

let scannerWin;
let mainWindow;

// Auto-updater event logging
autoUpdater.on("checking-for-update", () => {
  console.log("[updater] Checking for updates...");
});

autoUpdater.on("update-available", (info) => {
  console.log("[updater] Update available:", info.version);
});

autoUpdater.on("update-not-available", () => {
  console.log("[updater] App is up to date");
});

autoUpdater.on("error", (err) => {
  console.error("[updater] Error:", err);
});

autoUpdater.on("download-progress", (progress) => {
  console.log(
    "[updater] Download progress:",
    Math.round(progress.percent) + "%",
  );
});

autoUpdater.on("update-downloaded", (info) => {
  console.log("[updater] Update downloaded:", info.version);
});

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
        { role: "selectall" },
      ],
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
        { role: "togglefullscreen" },
      ],
    },
    {
      role: "window",
      submenu: [{ role: "minimize" }, { role: "close" }],
    },
    {
      role: "help",
      submenu: [
        {
          label: "Learn More",
          click() {
            shell.openExternal("https://github.com/nicedoc/space-radar");
          },
        },
      ],
    },
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
        { role: "quit" },
      ],
    });

    // Edit menu - add Speech submenu
    template[1].submenu.push(
      { type: "separator" },
      {
        label: "Speech",
        submenu: [{ role: "startspeaking" }, { role: "stopspeaking" }],
      },
    );

    // Window menu
    template[3].submenu = [
      { role: "close" },
      { role: "minimize" },
      { role: "zoom" },
      { type: "separator" },
      { role: "front" },
    ];
  }

  // Color Options menu
  template.push({
    label: "Color Options",
    submenu: [
      {
        label: "Seaborn Palettes",
        submenu: [
          {
            type: "radio",
            label: "Deep",
            click: () => sendColorChange("scheme", "seabornDeep"),
          },
          {
            type: "radio",
            label: "Muted",
            click: () => sendColorChange("scheme", "seabornMuted"),
          },
          {
            type: "radio",
            label: "Pastel (Default)",
            checked: true,
            click: () => sendColorChange("scheme", "seabornPastel"),
          },
          {
            type: "radio",
            label: "Bright",
            click: () => sendColorChange("scheme", "seabornBright"),
          },
          {
            type: "radio",
            label: "Dark",
            click: () => sendColorChange("scheme", "seabornDark"),
          },
          {
            type: "radio",
            label: "Colorblind-friendly",
            click: () => sendColorChange("scheme", "seabornColorblind"),
          },
        ],
      },
      { type: "separator" },
      {
        label: "Legacy Schemes",
        submenu: [
          {
            type: "radio",
            label: "Classic - 11 Categories",
            click: () => sendColorChange("scheme", "schemeCat11"),
          },
          {
            type: "radio",
            label: "Classic - 6 Categories",
            click: () => sendColorChange("scheme", "schemeCat6"),
          },
          {
            type: "radio",
            label: "Rainbow (Hash-based)",
            click: () => sendColorChange("scheme", "schemeHue"),
          },
        ],
      },
      { type: "separator" },
      {
        label: "Color Modes",
        submenu: [
          {
            type: "radio",
            label: "By File Type",
            click: () => sendColorChange("mode", "colorByProp"),
          },
          {
            type: "radio",
            label: "By Size (Color Gradient)",
            click: () => sendColorChange("mode", "colorBySize"),
          },
          {
            type: "radio",
            label: "By Size (Greyscale)",
            click: () => sendColorChange("mode", "colorBySizeBw"),
          },
          {
            type: "radio",
            label: "By Root Directory (Default)",
            checked: true,
            click: () => sendColorChange("mode", "colorByParent"),
          },
          {
            type: "radio",
            label: "By Parent Name",
            click: () => sendColorChange("mode", "colorByParentName"),
          },
          { type: "separator" },
          {
            type: "radio",
            label: "Random / Confetti",
            click: () => sendColorChange("mode", "colorByRandom"),
          },
        ],
      },
      { type: "separator" },
      {
        type: "checkbox",
        label: "Dark Mode",
        click: (menuItem) => sendColorChange("darkMode", menuItem.checked),
      },
      {
        type: "checkbox",
        label: "3D Mode (Experimental)",
        click: (menuItem) => sendColorChange("3dMode", menuItem.checked),
      },
    ],
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

app.on("ready", function () {
  mainWindow = require("./js/start")();

  // Check for updates and notify user
  autoUpdater.checkForUpdatesAndNotify();

  // Quit app when main window is closed
  mainWindow.on("closed", function () {
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
    process.arch,
  );

  // Create hidden scanner window for background scanning
  scannerWin = new BrowserWindow({
    show: false,
    webPreferences: { nodeIntegration: true, contextIsolation: false },
  });
  scannerWin.loadURL("file://" + __dirname + "/headless.html");

  // IPC handler to open folder selection dialog
  ipcMain.handle("select-folder", async (event) => {
    try {
      const win = BrowserWindow.getFocusedWindow();
      const result = await dialog.showOpenDialog(win, {
        properties: ["openDirectory"],
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

  // Handle cancel scan request from renderer
  ipcMain.on("cancel-scan", (event) => {
    try {
      console.log("[main] cancel-scan requested");
      if (scannerWin && !scannerWin.isDestroyed()) {
        scannerWin.webContents.send("cancel-scan");
      } else {
        console.error("[main] scanner window unavailable for cancel");
      }
    } catch (err) {
      console.error("[main] cancel-scan error", err);
    }
  });

  // Handle pause scan request from renderer
  ipcMain.on("pause-scan", (event) => {
    try {
      console.log("[main] pause-scan requested");
      if (scannerWin && !scannerWin.isDestroyed()) {
        scannerWin.webContents.send("pause-scan");
      } else {
        console.error("[main] scanner window unavailable for pause");
      }
    } catch (err) {
      console.error("[main] pause-scan error", err);
    }
  });

  // Handle resume scan request from renderer
  ipcMain.on("resume-scan", (event) => {
    try {
      console.log("[main] resume-scan requested");
      if (scannerWin && !scannerWin.isDestroyed()) {
        scannerWin.webContents.send("resume-scan");
      } else {
        console.error("[main] scanner window unavailable for resume");
      }
    } catch (err) {
      console.error("[main] resume-scan error", err);
    }
  });
});
