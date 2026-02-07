// SpaceRadar - Electrobun Main Process
// Replaces the Electron main process (app/main.js)

import Electrobun, {
  BrowserWindow,
  BrowserView,
  ApplicationMenu,
  Utils,
} from "electrobun/bun";
import type { SpaceRadarRPC } from "../mainview/rpc.ts";

import { resolve, join, sep } from "node:path";
import { lstatSync, readdirSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { homedir, tmpdir, platform } from "node:os";
import { deflateSync, inflateSync } from "node:zlib";

// ============================================================================
// App Data Path
// ============================================================================
function getAppDataPath(): string {
  const appName = "SpaceRadar";
  const p = platform();
  if (p === "darwin") {
    return join(homedir(), "Library", "Application Support", appName);
  } else if (p === "win32") {
    return join(process.env.APPDATA || homedir(), appName);
  } else {
    return join(homedir(), ".config", appName);
  }
}

const APP_DATA_DIR = getAppDataPath();
try { mkdirSync(APP_DATA_DIR, { recursive: true }); } catch {}
const LASTLOAD_FILE = join(APP_DATA_DIR, "lastload.json");

// ============================================================================
// Scanner (du.js logic adapted for Bun)
// ============================================================================
let scanCancelled = false;
let scanPaused = false;
let fileCount = 0;
let dirCount = 0;
let errorCount = 0;
let currentSize = 0;

function resetScanState() {
  scanCancelled = false;
  scanPaused = false;
  fileCount = 0;
  dirCount = 0;
  errorCount = 0;
  currentSize = 0;
}

interface ScanNode {
  name: string;
  size?: number;
  children?: ScanNode[];
  _isFreeSpace?: boolean;
}

function getExcludePaths(): string[] {
  const home = homedir();
  const pjoin = join;
  return [
    pjoin(home, "Library/CloudStorage"),
    pjoin(home, "Library/Containers/com.microsoft.OneDrive"),
    pjoin(home, "Library/Containers/com.microsoft.OneDrive-mac"),
    pjoin(home, "Library/Containers/com.microsoft.OneDriveStandaloneUpdater"),
    pjoin(home, "Library/Containers/com.microsoft.OneDrive-mac.FinderSync"),
    "/System/Volumes/Data/.Spotlight-V100",
    "/private/var/db",
    "/private/var/folders",
    "/.Spotlight-V100",
    "/.fseventsd",
    "/dev",
    "/System/Volumes/VM",
    "/System/Volumes/Preboot",
    "/System/Volumes/Update",
    pjoin(home, "Library/Caches"),
    pjoin(home, "Library/Saved Application State"),
    "/Volumes/.timemachine",
    "/.MobileBackups",
    "/.MobileBackups.trash",
  ];
}

function scanDirectory(
  dirPath: string,
  node: ScanNode,
  excludePaths: string[],
  onProgress: (path: string, name: string, size: number) => void
): void {
  if (scanCancelled) return;

  // Wait if paused
  // Note: In Bun's synchronous context, pause isn't truly async
  // but we check the flag to allow cancellation during pause

  try {
    const entries = readdirSync(dirPath);
    dirCount++;

    for (const entry of entries) {
      if (scanCancelled) return;

      const fullPath = join(dirPath, entry);

      // Check exclude paths
      if (excludePaths.some(ep => fullPath.startsWith(ep))) continue;

      // Skip hidden files starting with .
      if (entry.startsWith('.') && entry !== '.') continue;

      try {
        const stat = lstatSync(fullPath);

        if (stat.isSymbolicLink()) continue;

        if (stat.isDirectory()) {
          const child: ScanNode = { name: entry, children: [] };
          if (!node.children) node.children = [];
          node.children.push(child);
          scanDirectory(fullPath, child, excludePaths, onProgress);

          // Calculate directory size from children
          let dirSize = 0;
          if (child.children) {
            for (const c of child.children) {
              dirSize += c.size || 0;
            }
          }
          child.size = dirSize;
        } else if (stat.isFile()) {
          fileCount++;
          currentSize += stat.size;
          if (!node.children) node.children = [];
          node.children.push({ name: entry, size: stat.size });

          // Report progress periodically
          if (fileCount % 500 === 0) {
            onProgress(dirPath, entry, currentSize);
          }
        }
      } catch (e) {
        errorCount++;
      }
    }
  } catch (e) {
    errorCount++;
  }
}

// ============================================================================
// RPC Setup
// ============================================================================
const mainViewRPC = BrowserView.defineRPC<SpaceRadarRPC>({
  maxRequestTime: 600000, // 10 minutes for long scans
  handlers: {
    requests: {
      selectFolder: async () => {
        try {
          const result = await Utils.openFileDialog({
            startingFolder: "~/",
            allowedFileTypes: "*",
            canChooseFiles: false,
            canChooseDirectory: true,
            allowsMultipleSelection: false,
          });
          if (result && result.length > 0 && result[0] !== "") {
            return { path: result[0] };
          }
          return { path: null };
        } catch (err) {
          console.error("[bun] selectFolder error", err);
          return { path: null };
        }
      },

      selectFile: async () => {
        try {
          const result = await Utils.openFileDialog({
            startingFolder: "~/",
            allowedFileTypes: "*",
            canChooseFiles: true,
            canChooseDirectory: false,
            allowsMultipleSelection: false,
          });
          if (result && result.length > 0 && result[0] !== "") {
            return { path: result[0] };
          }
          return { path: null };
        } catch (err) {
          console.error("[bun] selectFile error", err);
          return { path: null };
        }
      },

      startScan: async ({ targetPath }) => {
        console.log("[bun] startScan", targetPath);
        resetScanState();

        const resolvedPath = resolve(targetPath);
        const node: ScanNode = { name: resolvedPath, children: [] };

        const excludePaths = getExcludePaths();
        const startTime = Date.now();

        // Run scan in background
        setTimeout(() => {
          try {
            scanDirectory(resolvedPath, node, excludePaths, (path, name, size) => {
              // Send progress to view
              mainWindow?.webview.rpc?.send.scanProgress({
                path,
                name,
                size,
                fileCount,
                dirCount,
                errorCount,
              });
            });

            // Calculate root size
            let rootSize = 0;
            if (node.children) {
              for (const c of node.children) {
                rootSize += c.size || 0;
              }
            }
            node.size = rootSize;

            const elapsed = (Date.now() - startTime) / 1000;
            console.log(`[bun] Scan complete: ${fileCount} files, ${dirCount} dirs in ${elapsed.toFixed(1)}s`);

            // Save last load
            try {
              const jsonStr = JSON.stringify(node);
              const compressed = deflateSync(Buffer.from(jsonStr));
              writeFileSync(LASTLOAD_FILE, compressed);
            } catch (e) {
              console.error("[bun] Failed to save lastload", e);
            }

            // Send complete to view
            mainWindow?.webview.rpc?.send.scanComplete({
              data: node,
              stats: {
                fileCount,
                dirCount,
                errorCount,
                currentSize,
                cancelled: scanCancelled,
              },
            });
          } catch (err) {
            console.error("[bun] Scan error", err);
            mainWindow?.webview.rpc?.send.scanComplete({
              data: node,
              stats: {
                fileCount,
                dirCount,
                errorCount,
                currentSize,
                cancelled: true,
              },
            });
          }
        }, 10);

        return { started: true };
      },

      cancelScan: () => {
        console.log("[bun] cancelScan");
        scanCancelled = true;
        return { cancelled: true };
      },

      pauseScan: () => {
        console.log("[bun] pauseScan");
        scanPaused = true;
        return { paused: true };
      },

      resumeScan: () => {
        console.log("[bun] resumeScan");
        scanPaused = false;
        return { resumed: true };
      },

      openDirectory: ({ dirPath }) => {
        try {
          Utils.showItemInFolder(dirPath);
          return { success: true };
        } catch {
          return { success: false };
        }
      },

      openExternal: ({ url }) => {
        try {
          Utils.openExternal(url);
          return { success: true };
        } catch {
          return { success: false };
        }
      },

      trashItem: async ({ filePath }) => {
        try {
          Utils.moveToTrash(filePath);
          return { success: true };
        } catch {
          return { success: false };
        }
      },

      loadLast: () => {
        try {
          const compressed = readFileSync(LASTLOAD_FILE);
          const jsonStr = inflateSync(compressed).toString();
          const data = JSON.parse(jsonStr);
          return { data };
        } catch {
          return { data: null };
        }
      },

      confirmAction: async ({ message }) => {
        try {
          const result = await Utils.showMessageBox({
            type: "question",
            title: "Confirm",
            message,
            buttons: ["OK", "Cancel"],
            defaultId: 0,
            cancelId: 1,
          });
          return { confirmed: result.response === 0 };
        } catch {
          return { confirmed: false };
        }
      },
    },
    messages: {
      logFromView: ({ msg }) => {
        console.log("[view]", msg);
      },
    },
  },
});

// ============================================================================
// Application Menu
// ============================================================================
function buildMenu() {
  ApplicationMenu.setApplicationMenu([
    {
      submenu: [
        { label: "About SpaceRadar", role: "about" },
        { type: "separator" },
        { role: "hide" },
        { role: "hideOthers" },
        { role: "unhide" },
        { type: "separator" },
        { role: "quit" },
      ],
    },
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
      submenu: [
        { label: "Reload", action: "reload", accelerator: "CommandOrControl+R" },
        { type: "separator" },
        { label: "Zoom In", action: "zoom-in", accelerator: "CommandOrControl+=" },
        { label: "Zoom Out", action: "zoom-out", accelerator: "CommandOrControl+-" },
        { label: "Reset Zoom", action: "zoom-reset", accelerator: "CommandOrControl+0" },
      ],
    },
    {
      label: "Color Options",
      submenu: [
        { label: "Seaborn Pastel (Default)", action: "color-scheme-seabornPastel" },
        { label: "Seaborn Deep", action: "color-scheme-seabornDeep" },
        { label: "Seaborn Muted", action: "color-scheme-seabornMuted" },
        { label: "Seaborn Bright", action: "color-scheme-seabornBright" },
        { label: "Seaborn Dark", action: "color-scheme-seabornDark" },
        { label: "Seaborn Colorblind", action: "color-scheme-seabornColorblind" },
        { type: "separator" },
        { label: "Classic 11 Categories", action: "color-scheme-schemeCat11" },
        { label: "Classic 6 Categories", action: "color-scheme-schemeCat6" },
        { label: "Rainbow (Hash-based)", action: "color-scheme-schemeHue" },
        { type: "separator" },
        { label: "By File Type", action: "color-mode-colorByProp" },
        { label: "By Size (Color Gradient)", action: "color-mode-colorBySize" },
        { label: "By Size (Greyscale)", action: "color-mode-colorBySizeBw" },
        { label: "By Root Directory", action: "color-mode-colorByParent" },
        { label: "By Parent Name", action: "color-mode-colorByParentName" },
        { label: "Random / Confetti", action: "color-mode-colorByRandom" },
        { type: "separator" },
        { label: "Dark Mode", action: "toggle-dark-mode" },
        { label: "3D Mode (Experimental)", action: "toggle-3d-mode" },
      ],
    },
    {
      label: "Window",
      submenu: [
        { role: "minimize" },
        { role: "close" },
      ],
    },
    {
      label: "Help",
      submenu: [
        { label: "Learn More", action: "help-learn-more" },
      ],
    },
  ]);
}

// Handle menu actions
Electrobun.events.on("application-menu-clicked", (e: { data: { action: string } }) => {
  const { action } = e.data;

  if (action === "help-learn-more") {
    Utils.openExternal("https://github.com/zz85/space-radar");
    return;
  }

  if (action === "reload") {
    // Reload not directly supported, but we can notify the view
    return;
  }

  // Color scheme changes
  if (action.startsWith("color-scheme-")) {
    const scheme = action.replace("color-scheme-", "");
    mainWindow?.webview.rpc?.send.colorChange({ type: "scheme", value: scheme });
    return;
  }

  // Color mode changes
  if (action.startsWith("color-mode-")) {
    const mode = action.replace("color-mode-", "");
    mainWindow?.webview.rpc?.send.colorChange({ type: "mode", value: mode });
    return;
  }

  if (action === "toggle-dark-mode") {
    mainWindow?.webview.rpc?.send.colorChange({ type: "darkMode", value: "toggle" });
    return;
  }

  if (action === "toggle-3d-mode") {
    mainWindow?.webview.rpc?.send.colorChange({ type: "3dMode", value: "toggle" });
    return;
  }
});

// ============================================================================
// Create Main Window
// ============================================================================
const mainWindow = new BrowserWindow({
  title: "Space Radar",
  url: "views://mainview/index.html",
  frame: {
    width: 1200,
    height: 800,
    x: 100,
    y: 100,
  },
  titleBarStyle: "hiddenInset",
  rpc: mainViewRPC,
});

mainWindow.on("close", () => {
  Utils.quit();
});

buildMenu();

console.log("[bun] SpaceRadar started with Electrobun!");
