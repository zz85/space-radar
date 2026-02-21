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
  Screen,
} from "electrobun/bun";
import { homedir } from "node:os";
import { join } from "node:path";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { deflateSync, inflateSync } from "node:zlib";
import { exec } from "node:child_process";
import { promisify } from "node:util";

import type { SpaceRadarRPC } from "../shared/types";
import { SqliteScanner } from "./scanner-sqlite";
import { Scanner } from "./scanner";
import type { TreeNode } from "./scanner";

const execAsync = promisify(exec);

// ---------------------------------------------------------------------------
// Scanner toggle — set SCANNER=memory to use the old in-memory tree scanner
//   bun run start              → SQLite (default)
//   SCANNER=memory bun run start → in-memory tree
// ---------------------------------------------------------------------------

const USE_SQLITE_SCANNER = process.env.SCANNER !== "memory";

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
const SCAN_DB_FILE = "scan.db";

/** Depth limits for subtree queries. */
const SUBTREE_DEPTH_REFRESH = 3;
const SUBTREE_DEPTH_FULL = 5;

// ---------------------------------------------------------------------------
// SQLite Scanner (single persistent instance, runs in-process)
// ---------------------------------------------------------------------------

let scanDb: SqliteScanner | null = null;

/** Get or create the persistent SqliteScanner instance. */
function getScanDb(): SqliteScanner {
  if (!scanDb) {
    const dbPath = join(ensureAppDataDir(), SCAN_DB_FILE);
    scanDb = new SqliteScanner(dbPath);
  }
  return scanDb;
}

// ---------------------------------------------------------------------------
// In-memory Scanner state (used when USE_SQLITE_SCANNER = false)
// ---------------------------------------------------------------------------

let activeInMemoryScanner: Scanner | null = null;
/** JSON string of the latest tree preview (replaces temp file IPC). */
let scanPreviewJson: string | null = null;

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
  const [{ stdout: vmStatOut }, { stdout: psOut }] = await Promise.all([
    execAsync(MAC_VM_STAT),
    execAsync(MAC_PS_CMD),
  ]);
  const vmStat = parseVmStat(vmStatOut);
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
            const targetWin = windowRef.current;

            if (USE_SQLITE_SCANNER) {
              // ----- SQLite-backed scanner -----
              const db = getScanDb();
              db.cancel();

              console.log("[scanDirectory] starting SQLite scan:", targetPath);

              db.setHandlers({
                onProgress: (
                  dir,
                  name,
                  size,
                  fileCount,
                  dirCount,
                  errorCount,
                ) => {
                  targetWin?.webview.rpc?.send.scanProgress({
                    dir,
                    name,
                    size,
                    fileCount,
                    dirCount,
                    errorCount,
                  });
                },
                onRefresh: () => {
                  targetWin?.webview.rpc?.send.scanRefresh({});
                },
                onComplete: (stats) => {
                  console.log(
                    "[scanDirectory] complete:",
                    stats.fileCount,
                    "files,",
                    stats.dirCount,
                    "dirs",
                  );
                  targetWin?.webview.rpc?.send.scanComplete({
                    stats: {
                      fileCount: stats.fileCount,
                      dirCount: stats.dirCount,
                      currentSize: stats.totalSize,
                      errorCount: stats.errorCount,
                      cancelled: stats.cancelled,
                    },
                  });
                },
                onError: (error) => {
                  console.error("[scanDirectory] scanner error:", error);
                  targetWin?.webview.rpc?.send.scanError({ error });
                },
              });

              db.scan(targetPath).catch((err) => {
                console.error("[scanDirectory] unhandled scan error:", err);
                try {
                  targetWin?.webview.rpc?.send.scanError({
                    error: err instanceof Error ? err.message : String(err),
                  });
                } catch (_) {}
              });
            } else {
              // ----- In-memory tree scanner (original approach) -----
              if (activeInMemoryScanner) {
                activeInMemoryScanner.cancel();
                activeInMemoryScanner = null;
              }
              scanPreviewJson = null;

              console.log(
                "[scanDirectory] starting in-memory scan:",
                targetPath,
              );

              activeInMemoryScanner = new Scanner({
                onProgress: (
                  dir,
                  name,
                  size,
                  fileCount,
                  dirCount,
                  errorCount,
                ) => {
                  targetWin?.webview.rpc?.send.scanProgress({
                    dir,
                    name,
                    size,
                    fileCount,
                    dirCount,
                    errorCount,
                  });
                },
                onRefresh: (tree: TreeNode) => {
                  scanPreviewJson = JSON.stringify(tree);
                  targetWin?.webview.rpc?.send.scanRefresh({});
                },
                onComplete: (tree: TreeNode, stats) => {
                  scanPreviewJson = JSON.stringify(tree);
                  console.log(
                    "[scanDirectory] complete:",
                    stats.fileCount,
                    "files,",
                    stats.dirCount,
                    "dirs",
                  );
                  targetWin?.webview.rpc?.send.scanComplete({
                    stats: {
                      fileCount: stats.fileCount,
                      dirCount: stats.dirCount,
                      currentSize: stats.currentSize,
                      errorCount: stats.errorCount,
                      cancelled: stats.cancelled,
                    },
                  });
                  activeInMemoryScanner = null;
                },
                onError: (error: string) => {
                  console.error("[scanDirectory] scanner error:", error);
                  targetWin?.webview.rpc?.send.scanError({ error });
                  activeInMemoryScanner = null;
                },
              });

              activeInMemoryScanner.scan(targetPath).catch((err) => {
                console.error("[scanDirectory] unhandled scan error:", err);
                try {
                  targetWin?.webview.rpc?.send.scanError({
                    error: err instanceof Error ? err.message : String(err),
                  });
                } catch (_) {}
                activeInMemoryScanner = null;
              });
            }

            return { started: true };
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            console.error("[scanDirectory] error:", msg);
            return { started: false, error: msg };
          }
        },

        cancelScan: async () => {
          if (USE_SQLITE_SCANNER) {
            getScanDb().cancel();
          } else if (activeInMemoryScanner) {
            activeInMemoryScanner.cancel();
          }
        },

        pauseScan: async () => {
          if (USE_SQLITE_SCANNER) {
            getScanDb().pause();
          } else if (activeInMemoryScanner) {
            activeInMemoryScanner.pause();
          }
        },

        resumeScan: async () => {
          if (USE_SQLITE_SCANNER) {
            getScanDb().resume();
          } else if (activeInMemoryScanner) {
            activeInMemoryScanner.resume();
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
          // Try SQLite DB first (primary storage)
          try {
            const db = getScanDb();
            const rootId = db.getRootId();
            if (rootId) {
              const tree = db.getSubtree(rootId, SUBTREE_DEPTH_FULL);
              if (tree) return JSON.stringify(tree);
            }
          } catch (err) {
            console.error("[loadLastScan] SQLite error:", err);
          }

          // Fall back to compressed JSON file (legacy)
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

        loadScanPreview: async () => {
          if (USE_SQLITE_SCANNER) {
            try {
              const db = getScanDb();
              const rootId = db.getRootId();
              if (!rootId) return null;
              const tree = db.getSubtree(rootId, SUBTREE_DEPTH_REFRESH);
              return tree ? JSON.stringify(tree) : null;
            } catch (err) {
              console.error("[loadScanPreview] error:", err);
              return null;
            }
          }
          // In-memory scanner: return the cached preview JSON
          return scanPreviewJson;
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

        getSubtree: async ({ nodeId, depth }) => {
          try {
            const db = getScanDb();
            const tree = db.getSubtree(nodeId, depth);
            return tree ? JSON.stringify(tree) : null;
          } catch (err) {
            console.error("[getSubtree] error:", err);
            return null;
          }
        },

        getScanRootId: async () => {
          if (!USE_SQLITE_SCANNER) return null;
          try {
            return getScanDb().getRootId();
          } catch (err) {
            console.error("[getScanRootId] error:", err);
            return null;
          }
        },

        getNodePath: async ({ nodeId }) => {
          try {
            return getScanDb().getNodePath(nodeId) || null;
          } catch (err) {
            console.error("[getNodePath] error:", err);
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

  // Centre the window on the primary display's work area (excludes menu bar / dock)
  const winWidth = 1200;
  const winHeight = 800;
  let winX = 100;
  let winY = 100;
  try {
    const { workArea } = Screen.getPrimaryDisplay();
    winX = Math.round(workArea.x + (workArea.width - winWidth) / 2);
    winY = Math.round(workArea.y + (workArea.height - winHeight) / 2);
  } catch (_) {
    // Fall back to fixed position if Screen API unavailable
  }

  const newWin = new BrowserWindow({
    title: "Space Radar",
    url: "views://mainview/index.html",
    frame: {
      width: winWidth,
      height: winHeight,
      x: winX,
      y: winY,
    },
    titleBarStyle: "hiddenInset",
    rpc,
  });

  // Force a WKWebView layout recalculation so the footer is visible on
  // first paint (works around a viewport-height measurement race in WKWebView).
  setTimeout(() => {
    newWin.setSize(winWidth, winHeight);
  }, 100);

  // Wire up the ref so RPC handlers can reach this window
  windowRef.current = newWin;

  // Track the latest window for menu events
  latestWindow = newWin;

  newWin.on("close", () => {
    // Don't exit here — Electrobun's built-in exitOnLastWindowClosed
    // (default: true) will quit when the last BrowserWindow closes.
    // Calling process.exit(0) on every close kills the app even when
    // other windows are still open.
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
console.log(
  `[main] Scanner: ${USE_SQLITE_SCANNER ? "SQLite" : "in-memory tree"}`,
);
console.log(`[main] Platform: ${process.platform} ${process.arch}`);
console.log(`[main] App data: ${getAppDataDir()}`);
