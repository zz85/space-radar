/**
 * Space Radar - Electrobun Main Process Entry Point
 *
 * Creates the main BrowserWindow, sets up the application menu with color
 * options, and wires all RPC handlers for scanning, file operations, memory
 * profiling, and persistence.
 */

import Electrobun, {
  BrowserWindow,
  BrowserView,
  ApplicationMenu,
  ContextMenu,
  Utils,
} from "electrobun/bun";
import { homedir } from "node:os";
import { join } from "node:path";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { deflateSync, inflateSync } from "node:zlib";
import { exec } from "node:child_process";
import { promisify } from "node:util";

import type { SpaceRadarRPC } from "../shared/types";

const execAsync = promisify(exec);

// ---------------------------------------------------------------------------
// Platform helpers
// ---------------------------------------------------------------------------

const isMac = process.platform === "darwin";
const isWindows = process.platform === "win32";

function getAppDataDir(): string {
  const home = homedir();
  if (isMac) return join(home, "Library", "Application Support", "SpaceRadar");
  if (isWindows)
    return join(
      process.env.APPDATA || join(home, "AppData", "Roaming"),
      "SpaceRadar",
    );
  return join(home, ".config", "SpaceRadar");
}

function ensureAppDataDir(): string {
  const dir = getAppDataDir();
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  return dir;
}

const LAST_SCAN_FILE = "lastload.json.z";

// ---------------------------------------------------------------------------
// Scanner worker (one per app for now)
// ---------------------------------------------------------------------------

let scannerWorker: Worker | null = null;

// ---------------------------------------------------------------------------
// Memory scanning (port of app/js/mem.js)
// ---------------------------------------------------------------------------

const MAC_PS_CMD = "ps -cx -opid,ppid,rss,comm";
const MAC_VM_STAT = "vm_stat";

interface ProcessInfo {
  pid: number;
  ppid: number;
  rss: number;
  comm: string;
  name?: string;
  size?: number;
  children?: any[];
  parent?: number;
}

function parseVmStat(out: string): Record<string, number> {
  const pageSizeMatch = /page size of (\d+)/.exec(out);
  const pageSize = pageSizeMatch ? +pageSizeMatch[1] : 4096;

  const vmStat: Record<string, number> = {};
  const pageReg = /Pages\s+([^:]+)[^\d]+(\d+)/g;
  let m: RegExpExecArray | null;

  while ((m = pageReg.exec(out))) {
    vmStat[m[1]] = +m[2] * pageSize;
  }

  return vmStat;
}

function parseProcesses(stdout: string): {
  app: any;
  sum: number;
  count: number;
} {
  const regex = /^\s*(\d+)\s+(\d+)\s+(\d+)\s+(.*)$/gm;
  let m: RegExpExecArray | null;

  let count = 0;
  let rssSum = 0;
  const all: Record<number, ProcessInfo> = {};

  while ((m = regex.exec(stdout))) {
    const pid = +m[1];
    const ppid = +m[2];
    const rss = +m[3] * 1024;
    const comm = m[4];

    count++;
    rssSum += rss;
    all[pid] = { pid, ppid, rss, comm };
  }

  const app: any = { name: "App Memory", children: [] };

  Object.keys(all)
    .map((k) => all[+k])
    .sort((a, b) => a.pid - b.pid)
    .forEach((a) => {
      let parent: any;
      if (a.ppid in all) {
        parent = all[a.ppid];
      } else {
        parent = app;
      }

      if (!parent.children) {
        parent.children = [];
        parent.children.push({
          name: parent.name,
          size: parent.rss,
          parent: 1,
        });
        delete parent.size;
      }
      parent.children.push(a);

      a.name = `${a.comm} (${a.pid})`;
      a.size = a.rss;
      delete (a as any).comm;
      delete (a as any).pid;
      delete (a as any).rss;
      delete (a as any).ppid;
    });

  return { app, sum: rssSum, count };
}

function combineMemory(
  processInfo: { app: any; sum: number; count: number },
  vmStat: Record<string, number>,
): any {
  const top: any = { name: "Memory", children: [] };

  const diff = (vmStat.active || 0) - processInfo.sum;
  const active: any = { name: "Active Memory", children: [processInfo.app] };
  top.children.push(active);

  if (diff > 0) {
    active.children.push({ name: "Kernel / others", size: diff });
  }

  for (const n of [
    "free",
    "inactive",
    "speculative",
    "wired down",
    "occupied by compressor",
  ]) {
    if (vmStat[n] > 0) {
      top.children.push({ name: n, size: vmStat[n] });
    }
  }

  return top;
}

async function scanMemoryMac(): Promise<any> {
  const { stdout: vmStatOut } = await execAsync(MAC_VM_STAT);
  const vmStat = parseVmStat(vmStatOut);
  const { stdout: psOut } = await execAsync(MAC_PS_CMD);
  const processInfo = parseProcesses(psOut);
  return combineMemory(processInfo, vmStat);
}

async function scanMemorySysteminfo(): Promise<any> {
  try {
    const si = await import("systeminformation");
    const [memData, processData] = await Promise.all([
      si.mem(),
      si.processes(),
    ]);

    const memInfo: Record<string, number> = {
      free: memData.free || 0,
      active: memData.active || memData.used || 0,
      inactive: (memData as any).inactive || 0,
      speculative: (memData as any).speculative || 0,
      "wired down": (memData as any).wired || 0,
      "occupied by compressor": (memData as any).compressed || 0,
    };

    const all: Record<number, ProcessInfo> = {};
    let count = 0;
    let rssSum = 0;

    for (const proc of processData.list) {
      const pid = proc.pid;
      const ppid = proc.parentPid;
      const rss = (proc.memRss || 0) * 1024;
      const comm = proc.name || "Unknown";

      if (pid === 0) continue;

      count++;
      rssSum += rss;
      all[pid] = { pid, ppid, rss, comm };
    }

    const app: any = { name: "App Memory", children: [] };

    Object.keys(all)
      .map((k) => all[+k])
      .sort((a, b) => a.pid - b.pid)
      .forEach((a) => {
        let parent: any;
        if (a.ppid in all) {
          parent = all[a.ppid];
        } else {
          parent = app;
        }

        if (!parent.children) {
          parent.children = [];
          parent.children.push({
            name: parent.name,
            size: parent.rss,
            parent: 1,
          });
          delete parent.size;
        }
        parent.children.push(a);

        a.name = `${a.comm} (${a.pid})`;
        a.size = a.rss;
        delete (a as any).comm;
        delete (a as any).pid;
        delete (a as any).rss;
        delete (a as any).ppid;
      });

    const processInfo = { app, sum: rssSum, count };
    return combineMemory(processInfo, memInfo);
  } catch (err) {
    console.error("[scanMemory] systeminformation error:", err);
    return null;
  }
}

async function scanMemory(): Promise<any> {
  if (isMac) {
    return scanMemoryMac();
  }
  return scanMemorySysteminfo();
}

// ---------------------------------------------------------------------------
// Track the most recently created window for menu routing
// ---------------------------------------------------------------------------

let latestWindow: BrowserWindow<any> | null = null;

// ---------------------------------------------------------------------------
// Window creation helper
// ---------------------------------------------------------------------------

/**
 * Creates a new BrowserWindow with its own RPC instance.
 *
 * The RPC handlers capture `windowRef` via closure so that scanner callbacks
 * and menu events route to the correct window. We use a mutable ref object
 * so the RPC definition can be created before the window exists, then the
 * window is immediately assigned into the ref.
 */
function createAppWindow(): BrowserWindow<any> {
  // Mutable ref so RPC handlers can reach the window they belong to
  const windowRef: { current: BrowserWindow<any> | null } = { current: null };

  const rpc = BrowserView.defineRPC<SpaceRadarRPC>({
    maxRequestTime: 300_000, // 5 minutes for long scans
    handlers: {
      requests: {
        selectFolder: async ({ startingFolder }) => {
          try {
            const result = await Utils.openFileDialog({
              startingFolder: startingFolder || homedir(),
              canChooseFiles: false,
              canChooseDirectory: true,
              allowsMultipleSelection: false,
            });
            const filtered = result.filter((p: string) => p.trim() !== "");
            return filtered.length > 0 ? filtered[0] : null;
          } catch (err) {
            console.error("[selectFolder] error:", err);
            return null;
          }
        },

        scanDirectory: async ({ path: targetPath }) => {
          try {
            // Terminate any existing scanner worker
            if (scannerWorker) {
              scannerWorker.terminate();
              scannerWorker = null;
            }

            const targetWin = windowRef.current;

            scannerWorker = new Worker(
              new URL("./scanner-worker.ts", import.meta.url).href,
            );

            scannerWorker.onmessage = (event: MessageEvent) => {
              const msg = event.data;
              switch (msg.type) {
                case "progress":
                  targetWin?.webview.rpc?.send.scanProgress({
                    dir: msg.dir,
                    name: msg.name,
                    size: msg.size,
                    fileCount: msg.fileCount,
                    dirCount: msg.dirCount,
                    errorCount: msg.errorCount,
                  });
                  break;
                case "refresh":
                  targetWin?.webview.rpc?.send.scanRefresh({
                    data: msg.data,
                  });
                  break;
                case "complete":
                  targetWin?.webview.rpc?.send.scanComplete({
                    data: msg.data,
                    stats: msg.stats,
                  });
                  break;
                case "error":
                  targetWin?.webview.rpc?.send.scanError({
                    error: msg.error,
                  });
                  break;
              }
            };

            scannerWorker.onerror = (event) => {
              console.error("[scannerWorker] error:", event);
              targetWin?.webview.rpc?.send.scanError({
                error: event.message || "Scanner worker error",
              });
            };

            scannerWorker.postMessage({ type: "scan", path: targetPath });

            return { started: true };
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            console.error("[scanDirectory] error:", msg);
            return { started: false, error: msg };
          }
        },

        cancelScan: async () => {
          if (scannerWorker) {
            scannerWorker.postMessage({ type: "cancel" });
          }
        },

        pauseScan: async () => {
          if (scannerWorker) {
            scannerWorker.postMessage({ type: "pause" });
          }
        },

        resumeScan: async () => {
          if (scannerWorker) {
            scannerWorker.postMessage({ type: "resume" });
          }
        },

        showItemInFolder: async ({ path: itemPath }) => {
          try {
            await Utils.showItemInFolder(itemPath);
          } catch (err) {
            console.error("[showItemInFolder] error:", err);
          }
        },

        moveToTrash: async ({ path: itemPath }) => {
          try {
            await Utils.moveToTrash(itemPath);
            return true;
          } catch (err) {
            console.error("[moveToTrash] error:", err);
            return false;
          }
        },

        openNewWindow: async () => {
          createAppWindow();
        },

        getDiskInfo: async ({ path: diskPath }) => {
          try {
            const si = await import("systeminformation");
            const fsData = await si.fsSize();

            // Find the filesystem that contains this path
            // Sort by mount point length (longest first) to find most specific match
            const sorted = [...fsData].sort(
              (a, b) => b.mount.length - a.mount.length,
            );

            for (const entry of sorted) {
              if (diskPath.startsWith(entry.mount)) {
                return {
                  total: entry.size,
                  used: entry.used,
                  available: entry.available,
                  usePercent: entry.use,
                };
              }
            }

            // Fallback to root mount
            const root = fsData.find((entry) => entry.mount === "/");
            if (root) {
              return {
                total: root.size,
                used: root.used,
                available: root.available,
                usePercent: root.use,
              };
            }

            return null;
          } catch (err) {
            console.error("[getDiskInfo] error:", err);
            return null;
          }
        },

        loadLastScan: async () => {
          try {
            const dataDir = ensureAppDataDir();
            const filePath = join(dataDir, LAST_SCAN_FILE);

            if (!existsSync(filePath)) {
              return null;
            }

            const compressed = readFileSync(filePath);
            const decompressed = inflateSync(compressed);
            return decompressed.toString("utf-8");
          } catch (err) {
            console.error("[loadLastScan] error:", err);
            return null;
          }
        },

        saveScanData: async ({ data }) => {
          try {
            const dataDir = ensureAppDataDir();
            const filePath = join(dataDir, LAST_SCAN_FILE);
            const compressed = deflateSync(Buffer.from(data, "utf-8"));
            writeFileSync(filePath, compressed);
            console.log(
              `[saveScanData] Saved ${data.length} bytes -> ${compressed.length} bytes compressed`,
            );
          } catch (err) {
            console.error("[saveScanData] error:", err);
          }
        },

        showContextMenu: async ({ items }) => {
          ContextMenu.showContextMenu(
            items.map((item) => ({
              label: item.label,
              action: item.action,
              enabled: item.enabled !== false,
            })),
          );
        },

        scanMemory: async () => {
          try {
            const tree = await scanMemory();
            return tree ? JSON.stringify(tree) : null;
          } catch (err) {
            console.error("[scanMemory] error:", err);
            return null;
          }
        },
      },
      messages: {
        logToBun: ({ msg }) => {
          console.log("[webview]", msg);
        },
      },
    },
  });

  const newWin = new BrowserWindow({
    title: "Space Radar",
    url: "views://mainview/index.html",
    frame: {
      width: 1200,
      height: 900,
      x: 100,
      y: 100,
    },
    titleBarStyle: "hiddenInset",
    rpc,
  });

  // Wire up the ref so RPC handlers can reach this window
  windowRef.current = newWin;

  // Track the latest window for menu events
  latestWindow = newWin;

  newWin.on("close", () => {
    process.exit(0);
  });

  return newWin;
}

// ---------------------------------------------------------------------------
// Application Menu
// ---------------------------------------------------------------------------

ApplicationMenu.setApplicationMenu([
  // macOS app menu (first slot is the app name menu on macOS)
  {
    submenu: [
      { label: "About Space Radar", role: "about" },
      { type: "separator" },
      { label: "Hide Space Radar", role: "hide", accelerator: "Command+H" },
      {
        label: "Hide Others",
        role: "hideOthers",
        accelerator: "Command+Shift+H",
      },
      { label: "Show All", role: "unhide" },
      { type: "separator" },
      { label: "Quit Space Radar", role: "quit", accelerator: "Command+Q" },
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
      { role: "reload" },
      { role: "forceReload" },
      { role: "toggleDevTools" },
      { type: "separator" },
      { role: "resetZoom" },
      { role: "zoomIn" },
      { role: "zoomOut" },
      { type: "separator" },
      { role: "togglefullscreen" },
    ],
  },
  {
    label: "Window",
    submenu: [
      { role: "close" },
      { role: "minimize" },
      { label: "Zoom", role: "zoom" },
    ],
  },
  {
    label: "Help",
    submenu: [
      {
        label: "Learn More",
        action: "help-learn-more",
      },
    ],
  },
  {
    label: "Color Options",
    submenu: [
      // Seaborn Palettes
      {
        label: "Seaborn Palettes",
        submenu: [
          { label: "Deep", action: "scheme:seabornDeep" },
          { label: "Muted", action: "scheme:seabornMuted" },
          { label: "Pastel (Default)", action: "scheme:seabornPastel" },
          { label: "Bright", action: "scheme:seabornBright" },
          { label: "Dark", action: "scheme:seabornDark" },
          { label: "Colorblind-friendly", action: "scheme:seabornColorblind" },
        ],
      },
      { type: "separator" },
      // Legacy Schemes
      {
        label: "Legacy Schemes",
        submenu: [
          { label: "Classic - 11 Categories", action: "scheme:schemeCat11" },
          { label: "Classic - 6 Categories", action: "scheme:schemeCat6" },
          { label: "Rainbow (Hash-based)", action: "scheme:schemeHue" },
        ],
      },
      { type: "separator" },
      // Color Modes
      {
        label: "Color Modes",
        submenu: [
          { label: "By File Type", action: "mode:colorByProp" },
          { label: "By Size (Color Gradient)", action: "mode:colorBySize" },
          { label: "By Size (Greyscale)", action: "mode:colorBySizeBw" },
          {
            label: "By Root Directory (Default)",
            action: "mode:colorByParent",
          },
          { label: "By Parent Name", action: "mode:colorByParentName" },
          { label: "Random / Confetti", action: "mode:colorByRandom" },
        ],
      },
      { type: "separator" },
      { label: "Dark Mode", action: "toggle:darkMode" },
      { label: "3D Mode (Experimental)", action: "toggle:3dMode" },
    ],
  },
]);

// ---------------------------------------------------------------------------
// Handle application menu events
// ---------------------------------------------------------------------------

Electrobun.events.on("application-menu-clicked", (e) => {
  const action = e.data.action;

  // Help menu
  if (action === "help-learn-more") {
    exec(`open "https://github.com/zz85/space-radar"`);
    return;
  }

  // Color scheme changes: action format is "scheme:<value>"
  if (action.startsWith("scheme:")) {
    const value = action.slice("scheme:".length);
    latestWindow?.webview.rpc?.send.colorChange({ type: "scheme", value });
    return;
  }

  // Color mode changes: action format is "mode:<value>"
  if (action.startsWith("mode:")) {
    const value = action.slice("mode:".length);
    latestWindow?.webview.rpc?.send.colorChange({ type: "mode", value });
    return;
  }

  // Toggle actions: action format is "toggle:<property>"
  if (action.startsWith("toggle:")) {
    const property = action.slice("toggle:".length);
    latestWindow?.webview.rpc?.send.colorChange({
      type: property,
      value: "toggle",
    });
    return;
  }
});

// ---------------------------------------------------------------------------
// Handle context menu events
// ---------------------------------------------------------------------------

Electrobun.events.on("context-menu-clicked", (e) => {
  latestWindow?.webview.rpc?.send.contextMenuClicked({
    action: e.data.action,
  });
});

// ---------------------------------------------------------------------------
// Create the main window
// ---------------------------------------------------------------------------

const win = createAppWindow();

console.log("[main] Space Radar started");
console.log(`[main] Platform: ${process.platform} ${process.arch}`);
console.log(`[main] App data: ${getAppDataDir()}`);
