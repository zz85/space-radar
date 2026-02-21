# Feature Parity: Electron vs Electrobun

Audit of all features comparing the original Electron version with the Electrobun port.

## Summary

| Category          | Done   | Partial | Missing | Total  |
| ----------------- | ------ | ------- | ------- | ------ |
| Scanning          | 10     | 0       | 1       | 11     |
| Visualization     | 7      | 0       | 1       | 8      |
| Navigation        | 6      | 0       | 0       | 6      |
| File Operations   | 2      | 2       | 1       | 5      |
| Color Schemes     | 17     | 0       | 0       | 17     |
| Window Management | 2      | 1       | 0       | 3      |
| Persistence       | 4      | 0       | 0       | 4      |
| Menu              | 5      | 3       | 1       | 9      |
| Platform Features | 2      | 2       | 3       | 7      |
| UI Elements       | 14     | 1       | 1       | 16     |
| **Total**         | **69** | **9**   | **8**   | **86** |

## 1. Scanning

| Feature              | Electron                                                  | Electrobun                               | Status      | Notes                                                               |
| -------------------- | --------------------------------------------------------- | ---------------------------------------- | ----------- | ------------------------------------------------------------------- |
| Directory scan       | Yes (`du.js` via hidden BrowserWindow)                    | Yes (`Scanner` class, in-process)        | Done        |                                                                     |
| Drive scan (`/`)     | Yes                                                       | Yes                                      | Done        | Both show confirmation first                                        |
| Memory scan          | Yes (`mem.js` — macOS `ps`/`vm_stat` + systeminformation) | Yes (identical logic ported inline)      | Done        |                                                                     |
| `.du` file loading   | Yes (`duFromFile.js` — reads `du` output, supports `.gz`) | No                                       | **Missing** | Scanner says "Only directory scanning supported". Button is a stub. |
| Cancel scan          | Yes                                                       | Yes                                      | Done        |                                                                     |
| Pause scan           | Yes                                                       | Yes                                      | Done        | Both use promise-based gate                                         |
| Resume scan          | Yes                                                       | Yes                                      | Done        |                                                                     |
| Progress reporting   | Yes (every 10k items)                                     | Yes (every 10k items)                    | Done        |                                                                     |
| Live preview refresh | Yes (`TaskChecker` — 5s start, 3x backoff)                | Yes (`RefreshScheduler` — same schedule) | Done        |                                                                     |
| Exclude paths        | Yes (cloud storage + macOS system)                        | Yes (identical list)                     | Done        |                                                                     |
| Hardlink dedup       | Yes (`dev:ino` key)                                       | Yes (identical)                          | Done        |                                                                     |

## 2. Visualization

| Feature                   | Electron                  | Electrobun             | Status      | Notes                                                          |
| ------------------------- | ------------------------- | ---------------------- | ----------- | -------------------------------------------------------------- |
| Sunburst chart            | Yes (Canvas)              | Yes (Canvas)           | Done        | Full port with animation, hit-testing, center display          |
| Treemap                   | Yes (Canvas, FakeSVG)     | Yes (identical)        | Done        |                                                                |
| Flamegraph                | Yes (`d3-flame-graph`)    | Yes (`d3-flame-graph`) | Done        |                                                                |
| List/sidebar view         | Yes (top 10, sorted)      | Yes (identical)        | Done        |                                                                |
| Breadcrumb navigation     | Yes (D3 data-join)        | Yes (identical)        | Done        |                                                                |
| 3D mode (Three.js)        | Yes (`sunburst3d.js`)     | No                     | **Missing** | Canvas element exists, menu item exists, but no Three.js code. |
| "Other files" aggregation | Yes (0.1% threshold)      | Yes (identical)        | Done        |                                                                |
| Free space visualization  | Yes (`_isFreeSpace` node) | Yes (identical)        | Done        |                                                                |

## 3. Navigation

| Feature                      | Electron                     | Electrobun      | Status | Notes                    |
| ---------------------------- | ---------------------------- | --------------- | ------ | ------------------------ |
| Drill-down (click)           | Yes                          | Yes             | Done   | All chart types          |
| Navigate up                  | Yes                          | Yes             | Done   | Center-click in sunburst |
| Back/forward history         | Yes (`NavigationController`) | Yes (identical) | Done   |                          |
| Zoom in (show more levels)   | Yes                          | Yes             | Done   |                          |
| Zoom out (show fewer levels) | Yes                          | Yes             | Done   |                          |
| Breadcrumb path click        | Yes                          | Yes             | Done   |                          |

## 4. File Operations

| Feature            | Electron                             | Electrobun                     | Status      | Notes                                  |
| ------------------ | ------------------------------------ | ------------------------------ | ----------- | -------------------------------------- |
| Show in Finder     | Yes (`shell.showItemInFolder`)       | Yes (`Utils.showItemInFolder`) | Done        |                                        |
| Move to trash      | Yes (`shell.moveItemToTrash` + beep) | Yes (`Utils.moveToTrash`)      | Partial     | Missing `shell.beep()` on success      |
| Open file directly | Yes (`shell.openItem`)               | No — uses `showItemInFolder`   | Partial     | `openSelection()` falls back to Finder |
| Context menu       | Yes (`remote.Menu`)                  | Yes (`ContextMenu`)            | Done        | Same 3 items                           |
| External open      | Yes (`shell.openExternal`)           | No                             | **Missing** | Low priority — not in context menu     |

## 5. Color Schemes

All 17 color features are fully ported: 6 Seaborn palettes, 3 legacy schemes, 6 color modes, dark mode, localStorage persistence. **All Done.**

## 6. Window Management

| Feature                     | Electron                  | Electrobun | Status  | Notes                                               |
| --------------------------- | ------------------------- | ---------- | ------- | --------------------------------------------------- |
| Multiple windows            | Yes                       | Yes        | Done    |                                                     |
| Window title updates        | Neither version does this | N/A        | Done    |                                                     |
| Drag to scan (drop folders) | Yes (`file.path`)         | Partial    | Partial | `file.path` may not be available in WebView sandbox |

## 7. Persistence

All 4 persistence features are fully ported: save scan data, load last scan, "Last loaded" button, auto-show prompt on startup. **All Done.**

## 8. Menu

| Feature            | Electron                     | Electrobun                         | Status      | Notes                          |
| ------------------ | ---------------------------- | ---------------------------------- | ----------- | ------------------------------ |
| macOS App menu     | Yes                          | Yes                                | Done        |                                |
| Edit menu          | Yes (+ Speech)               | Yes (no Speech submenu)            | Partial     | Minor                          |
| View menu          | Yes                          | Yes                                | Done        |                                |
| Window menu        | Yes (+ "Bring All to Front") | Yes (no "Front")                   | Partial     | Minor                          |
| Help menu          | Yes                          | Yes                                | Done        |                                |
| Color Options menu | Yes (radio/checkbox items)   | Yes (action items, no check state) | Partial     | No visual radio/check feedback |
| Auto-updater       | Yes (`electron-updater`)     | No                                 | **Missing** |                                |

## 9. Platform Features

| Feature               | Electron                | Electrobun                | Status      | Notes                       |
| --------------------- | ----------------------- | ------------------------- | ----------- | --------------------------- |
| macOS traffic lights  | Yes (`hidden`)          | Yes (`hiddenInset`)       | Done        |                             |
| Dynamic window sizing | Yes (80% screen height) | Fixed 1200x800 + centered | Partial     | Could compute from workArea |
| `acceptFirstMouse`    | Yes                     | Not set                   | **Missing** | Minor UX                    |
| Windows/Linux support | Yes                     | macOS only                | **Missing** | Electrobun limitation       |
| Expose GC             | Yes (`--expose_gc`)     | No                        | **Missing** | Minor                       |

## 10. UI Elements

| Feature                            | Electron                         | Electrobun                                | Status      | Notes                                             |
| ---------------------------------- | -------------------------------- | ----------------------------------------- | ----------- | ------------------------------------------------- |
| Toolbar buttons (all)              | Yes                              | Yes                                       | Done        | Open, Scan Drive/Folder, DU file, Memory, +/-, Up |
| Mode buttons (sunburst/flame/tree) | Yes                              | Yes                                       | Done        |                                                   |
| Footer: back/forward               | Yes                              | Yes                                       | Done        |                                                   |
| Footer: disk space info            | Yes                              | Yes                                       | Done        |                                                   |
| Footer: status bar                 | Yes                              | Yes                                       | Done        |                                                   |
| Footer: Locate Directory           | Yes                              | Yes                                       | Done        |                                                   |
| Footer: Cancel/Pause Scan          | Yes                              | Yes                                       | Done        |                                                   |
| Legend overlay                     | Yes                              | Yes                                       | Done        |                                                   |
| Loading overlay                    | Yes                              | Yes                                       | Done        |                                                   |
| Prompt box                         | Yes                              | Yes                                       | Done        |                                                   |
| Load DU file button                | Yes (functional)                 | Stub (calls scanFolder)                   | Partial     |                                                   |
| Memory poller                      | Yes (periodic re-scan)           | No (one-shot only)                        | **Missing** |                                                   |
| Toolbar drag to move window        | Yes (`-webkit-app-region: drag`) | Yes (`electrobun-webkit-app-region-drag`) | Done        |                                                   |

## Key Missing Features (by impact)

1. **`.du` file loading** — Backend not implemented. Button is a stub.
2. **3D mode (Three.js)** — No Three.js code ported. Menu item is a no-op.
3. **Windows/Linux support** — Electrobun is macOS-only.
4. **Auto-updater** — No equivalent to `electron-updater`.
5. **Memory polling** — One-shot works; periodic re-scan missing.

## Architecture Differences

| Aspect          | Electron                                                          | Electrobun                                 |
| --------------- | ----------------------------------------------------------------- | ------------------------------------------ |
| IPC             | 4 mechanisms (ipcMain, localStorage, temp file, webContents.send) | Unified typed RPC over encrypted WebSocket |
| Scanner process | Hidden BrowserWindow                                              | Bun main process (in-process async)        |
| Bundling        | 20+ separate `<script>` tags                                      | Single bundled `index.js` via Bun          |
| D3 version      | d3 v3 + modules via CommonJS                                      | d3 v3 + modules via ESM                    |
| UI framework    | PhotonKit CSS                                                     | Self-contained PhotonKit-compatible CSS    |
