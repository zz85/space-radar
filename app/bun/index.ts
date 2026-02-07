import { ApplicationMenu, BrowserView, BrowserWindow, ContextMenu, Utils } from "electrobun/bun";
import { spawn } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import si from "systeminformation";
import createScanner from "../js/scanner";
import mem from "../js/mem";

const windows = new Set<BrowserWindow>();
let activeWindow: BrowserWindow | null = null;
let darkModeEnabled = false;
let mode3dEnabled = false;

const getAppDataPath = () => {
  const appName = "SpaceRadar";
  if (process.platform === "darwin") {
    return path.join(os.homedir(), "Library", "Application Support", appName);
  }
  if (process.platform === "win32") {
    return path.join(process.env.APPDATA || os.homedir(), appName);
  }
  return path.join(os.homedir(), ".config", appName);
};

const appDataPath = getAppDataPath();
try {
  fs.mkdirSync(appDataPath, { recursive: true });
} catch (error) {
  console.warn("[bun] Failed to ensure app data directory:", error);
}

const openWithSystem = (target: string) => {
  if (!target) return;
  if (process.platform === "darwin") {
    spawn("open", [target], { stdio: "ignore", detached: true }).unref();
    return;
  }
  if (process.platform === "win32") {
    spawn("cmd", ["/c", "start", "", target], {
      stdio: "ignore",
      detached: true,
    }).unref();
    return;
  }
  spawn("xdg-open", [target], { stdio: "ignore", detached: true }).unref();
};

const sendColorChange = (
  window: BrowserWindow | null,
  type: string,
  value: string | boolean,
) => {
  if (!window) return;
  window.webview?.rpc?.send.colorChange({ type, value });
};

const buildMenuTemplate = () => {
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
        { role: "selectAll" },
      ],
    },
    {
      label: "View",
      submenu: [{ role: "toggleFullScreen" }],
    },
    {
      label: "Window",
      submenu: [{ role: "minimize" }, { role: "close" }],
    },
    {
      label: "Help",
      submenu: [
        {
          label: "Learn More",
          action: "open-help",
          data: { url: "https://github.com/nicedoc/space-radar" },
        },
      ],
    },
    {
      label: "Color Options",
      submenu: [
        {
          label: "Seaborn Palettes",
          submenu: [
            {
              label: "Deep",
              action: "color-change",
              data: { type: "scheme", value: "seabornDeep" },
            },
            {
              label: "Muted",
              action: "color-change",
              data: { type: "scheme", value: "seabornMuted" },
            },
            {
              label: "Pastel (Default)",
              action: "color-change",
              data: { type: "scheme", value: "seabornPastel" },
            },
            {
              label: "Bright",
              action: "color-change",
              data: { type: "scheme", value: "seabornBright" },
            },
            {
              label: "Dark",
              action: "color-change",
              data: { type: "scheme", value: "seabornDark" },
            },
            {
              label: "Colorblind-friendly",
              action: "color-change",
              data: { type: "scheme", value: "seabornColorblind" },
            },
          ],
        },
        { type: "separator" },
        {
          label: "Legacy Schemes",
          submenu: [
            {
              label: "Classic - 11 Categories",
              action: "color-change",
              data: { type: "scheme", value: "schemeCat11" },
            },
            {
              label: "Classic - 6 Categories",
              action: "color-change",
              data: { type: "scheme", value: "schemeCat6" },
            },
            {
              label: "Rainbow (Hash-based)",
              action: "color-change",
              data: { type: "scheme", value: "schemeHue" },
            },
          ],
        },
        { type: "separator" },
        {
          label: "Color Modes",
          submenu: [
            {
              label: "By File Type",
              action: "color-change",
              data: { type: "mode", value: "colorByProp" },
            },
            {
              label: "By Size (Color Gradient)",
              action: "color-change",
              data: { type: "mode", value: "colorBySize" },
            },
            {
              label: "By Size (Greyscale)",
              action: "color-change",
              data: { type: "mode", value: "colorBySizeBw" },
            },
            {
              label: "By Root Directory (Default)",
              action: "color-change",
              data: { type: "mode", value: "colorByParent" },
            },
            {
              label: "By Parent Name",
              action: "color-change",
              data: { type: "mode", value: "colorByParentName" },
            },
            { type: "separator" },
            {
              label: "Random / Confetti",
              action: "color-change",
              data: { type: "mode", value: "colorByRandom" },
            },
          ],
        },
        { type: "separator" },
        {
          label: "Dark Mode",
          action: "color-change",
          data: { type: "darkMode" },
        },
        {
          label: "3D Mode (Experimental)",
          action: "color-change",
          data: { type: "3dMode" },
        },
      ],
    },
  ];

  if (process.platform === "darwin") {
    template.unshift({
      label: "SpaceRadar",
      submenu: [
        { role: "about" },
        { type: "separator" },
        { role: "hide" },
        { role: "hideOthers" },
        { role: "showAll" },
        { type: "separator" },
        { role: "quit" },
      ],
    });
  }

  return template;
};

const buildApplicationMenu = () => {
  ApplicationMenu.setApplicationMenu(buildMenuTemplate());
};

const handleMenuAction = (action: string, data?: any) => {
  if (!action) return;
  switch (action) {
    case "color-change":
      if (data?.type === "darkMode") {
        darkModeEnabled = !darkModeEnabled;
        sendColorChange(activeWindow, data.type, darkModeEnabled);
        return;
      }
      if (data?.type === "3dMode") {
        mode3dEnabled = !mode3dEnabled;
        sendColorChange(activeWindow, data.type, mode3dEnabled);
        return;
      }
      sendColorChange(activeWindow, data?.type, data?.value);
      break;
    case "open-help":
      openWithSystem(data?.url);
      break;
    default:
      break;
  }
};

ApplicationMenu.on("application-menu-clicked", (event) => {
  const { action, data } = event.data || {};
  handleMenuAction(action, data);
});

ContextMenu.on("context-menu-clicked", (event) => {
  activeWindow?.webview?.rpc?.send.contextMenuAction({
    action: event.data?.action,
  });
});

const createWindow = () => {
  let scanner: ReturnType<typeof createScanner> | null = null;

  const rpc = BrowserView.defineRPC({
    handlers: {
      requests: {
        selectFolder: async () => {
          const result = await Utils.openFileDialog({
            startingFolder: os.homedir(),
            canChooseFiles: false,
            canChooseDirectory: true,
            allowsMultipleSelection: false,
          });
          return result[0] || null;
        },
        selectFile: async () => {
          const result = await Utils.openFileDialog({
            startingFolder: os.homedir(),
            canChooseFiles: true,
            canChooseDirectory: false,
            allowsMultipleSelection: false,
          });
          return result[0] || null;
        },
        getDiskInfo: async () => {
          return si.fsSize();
        },
        getMemorySnapshot: async () => {
          return new Promise((resolve, reject) => {
            mem((error, data) => {
              if (error) {
                reject(error);
                return;
              }
              resolve(data);
            });
          });
        },
        showContextMenu: async ({ items }) => {
          ContextMenu.showContextMenu(items || []);
          return true;
        },
      },
      messages: {
        scanGo: ({ target }) => {
          scanner?.start(target);
        },
        scanCancel: () => {
          scanner?.cancel();
        },
        scanPause: () => {
          scanner?.pause();
        },
        scanResume: () => {
          scanner?.resume();
        },
        openNewWindow: () => {
          createWindow();
        },
        shellOpenExternal: ({ url }) => {
          openWithSystem(url);
        },
        shellOpenPath: ({ path: target }) => {
          openWithSystem(target);
        },
        shellShowItemInFolder: ({ path: target }) => {
          Utils.showItemInFolder(target);
        },
        shellMoveItemToTrash: ({ path: target }) => {
          Utils.moveToTrash(target);
        },
        shellBeep: () => {
          process.stdout.write("\x07");
        },
      },
    },
  });

  const window = new BrowserWindow({
    title: "SpaceRadar",
    url: "views://mainview/index.html",
    frame: {
      width: 1200,
      height: 800,
      x: 120,
      y: 120,
    },
    rpc,
  });

  scanner = createScanner({
    send: (args) => {
      window.webview?.rpc?.send.scanEvent({
        cmd: args[0],
        args: args.slice(1),
      });
    },
    listenForProcess: false,
  });

  window.on("focus", () => {
    activeWindow = window;
  });

  window.on("close", () => {
    windows.delete(window);
    if (windows.size === 0) {
      Utils.quit();
    }
  });

  windows.add(window);
  activeWindow = window;
  return window;
};

buildApplicationMenu();
createWindow();
