# Space Radar Architecture

## Overview

Space Radar is an Electron-based disk usage visualization application that scans file systems and displays results using interactive visualizations (sunburst, treemap, flamegraph).

## Process Architecture

```
+=========================================================================+
|                           ELECTRON APP                                  |
+=========================================================================+
|                                                                         |
|  +-------------------------------------------------------------------+  |
|  |                        MAIN PROCESS                               |  |
|  |                        (app/main.js)                              |  |
|  |--------------------------------------------------------------------|  |
|  |  - App lifecycle (ready, window-all-closed)                       |  |
|  |  - Window management (BrowserWindow)                              |  |
|  |  - Application menu with color options                            |  |
|  |  - IPC handlers: select-folder, new-window, scan-go               |  |
|  +-------------------------------------------------------------------+  |
|                 |                                    |                  |
|                 | creates                            | creates          |
|                 v                                    v                  |
|  +-----------------------------+    +--------------------------------+  |
|  |     RENDERER PROCESS        |    |      SCANNER PROCESS           |  |
|  |     (app/index.html)        |    |      (app/headless.html)       |  |
|  |-----------------------------|    |--------------------------------|  |
|  |  Main UI Window             |    |  Hidden background window      |  |
|  |  - Visualizations           |    |  - File system traversal       |  |
|  |  - User interactions        |    |  - Async directory walking     |  |
|  |  - State management         |    |  - Progress reporting          |  |
|  +-----------------------------+    +--------------------------------+  |
|                                                                         |
+=========================================================================+
```

## IPC Communication Flow

```
+------------------+                              +------------------+
|    RENDERER      |                              |  MAIN PROCESS    |
|    (radar.js)    |                              |  (main.js)       |
+--------+---------+                              +--------+---------+
         |                                                 |
         |  'select-folder' (invoke)                       |
         |  ------------------------------------------>    |
         |                                                 |
         |  <-- returns selected path --                   |
         |                                                 |
         |  'scan-go' (send path)                          |
         |  ------------------------------------------>    |
         |                                                 |
         |                        'scan' (forward to scanner)
         |                                    +------------+--------+
         |                                    |                     |
         |                                    v                     |
         |                         +------------------+             |
         |                         | SCANNER WINDOW   |             |
         |                         | (scanner.js)     |             |
         |                         +--------+---------+             |
         |                                  |                       |
         |   localStorage IPC               |                       |
         |   <------------------------------+                       |
         |   - 'progress' [path, name, size]                        |
         |   - 'refresh' [partial json]                             |
         |   - 'complete' [full json]                               |
         |   - 'fs-ipc' [file path] (large payloads)                |
         |                                                          |
         |  'color-change' (from menu)                              |
         |  <---------------------------------------------------    |
         |                                                          |
+--------+---------+                              +-----------------+
```

## Data Flow

```
[User Action]          [Scan Start]           [File Traversal]
     |                      |                       |
     v                      v                       v
+----------+          +-----------+           +-----------+
| Click    |  ----->  | startScan |  -------> | du.js     |
| "Scan    |          | (radar.js)|           | descendFS |
| Folder"  |          +-----------+           +-----------+
+----------+                                        |
                                                    | async recursion
                                                    v
                                              +-----------+
                                              | Build     |
                                              | JSON tree |
                                              +-----------+
                                                    |
                                                    v
[Visualization]        [Data Processing]      [IPC Transfer]
     |                      |                       |
     v                      v                       v
+-----------+          +-----------+           +-----------+
| Sunburst  |  <-----  | onJson()  |  <------  | complete  |
| Treemap   |          | colorize  |           | localStorage
| Flamegraph|          | compute   |           | IPC       |
+-----------+          | sizes     |           +-----------+
                       +-----------+
```

## Module Dependencies

```
                            +================+
                            |    main.js     |
                            |  (Electron     |
                            |   Main Process)|
                            +========+=======+
                                     |
                    +----------------+----------------+
                    |                                 |
                    v                                 v
            +-------+-------+                +-------+-------+
            |   start.js    |                |  scanner.js   |
            | (Window       |                | (Background   |
            |  Factory)     |                |  Scanner)     |
            +---------------+                +-------+-------+
                                                     |
                                            +--------+--------+
                                            |                 |
                                            v                 v
                                     +------+------+   +------+------+
                                     |    du.js    |   | duFromFile  |
                                     | (FS Walker) |   | (DU Parser) |
                                     +-------------+   +-------------+


    RENDERER PROCESS (index.html)
    +====================================================================+
    |                                                                    |
    |  +------------------------+  +-----------+  +-------------------+  |
    |  |      router.js         |  |  radar.js |  |     ipc.js        |  |
    |  |  - NavigationCtrl      |  |  - Main   |  |  - localStorage   |  |
    |  |  - State               |  |    App    |  |    listener       |  |
    |  |  - PluginManager       |  |  - Scan   |  |  - handleIPC      |  |
    |  +------------------------+  +-----------+  +-------------------+  |
    |              |                                                     |
    |              v                                                     |
    |  +------------------------------------------------------------+   |
    |  |                    PLUGIN SYSTEM                           |   |
    |  |  +-------------+  +-------------+  +-------------------+   |   |
    |  |  | sunburst.js |  | treemap.js  |  |   flamegraph.js   |   |   |
    |  |  | (D3 SVG)    |  | (Canvas 2D) |  |   (d3-flame-graph)|   |   |
    |  |  +-------------+  +-------------+  +-------------------+   |   |
    |  |        |                |                    |             |   |
    |  |        +----------------+--------------------+             |   |
    |  |                         |                                  |   |
    |  |                         v                                  |   |
    |  |              +--------------------+                        |   |
    |  |              |     chart.js       |                        |   |
    |  |              | (Base Interface)   |                        |   |
    |  |              | - resize()         |                        |   |
    |  |              | - generate()       |                        |   |
    |  |              | - navigateTo()     |                        |   |
    |  |              | - cleanup()        |                        |   |
    |  |              +--------------------+                        |   |
    |  +------------------------------------------------------------+   |
    |                                                                    |
    |  +------------------------+  +----------------------------------+  |
    |  |   UI COMPONENTS        |  |        DATA PROCESSING           |  |
    |  |  +------------------+  |  |  +------------+  +-------------+ |  |
    |  |  | listview.js      |  |  |  | data.js    |  | colors.js   | |  |
    |  |  | (Sidebar List)   |  |  |  | (Partition)|  | (Coloring)  | |  |
    |  |  +------------------+  |  |  +------------+  +-------------+ |  |
    |  |  | breadcrumbs.js   |  |  |  | graphs.js  |  | utils.js    | |  |
    |  |  | (Nav Trail)      |  |  |  | (Path Util)|  | (Helpers)   | |  |
    |  |  +------------------+  |  |  +------------+  +-------------+ |  |
    |  +------------------------+  +----------------------------------+  |
    |                                                                    |
    +====================================================================+
```

## Data Structure

```
Scanned Node (JSON tree):
+----------------------------------+
| {                                |
|   name: "directory/file.ext",    |
|   size: 12345,        // bytes   |
|   children: [...],    // dirs    |
|                                  |
|   // Added by processing:        |
|   sum: 98765,         // total   |
|   count: 42,          // files   |
|   value: 98765,       // d3      |
|   color: d3.lab(...), // color   |
|   depth: 3,           // level   |
|   parent: {...},      // ref     |
|   _children: [...]    // saved   |
| }                                |
+----------------------------------+
```

## File Organization

```
space-radar/
+-- app/
|   +-- main.js              # Electron main process
|   +-- index.html           # Main renderer HTML
|   +-- headless.html        # Scanner window HTML
|   +-- js/
|   |   +-- start.js         # Window factory
|   |   +-- radar.js         # Main app controller
|   |   +-- router.js        # Navigation & state
|   |   +-- ipc.js           # IPC communication
|   |   +-- scanner.js       # Scan orchestrator
|   |   +-- du.js            # File system walker
|   |   +-- duFromFile.js    # DU file parser
|   |   +-- duPipe.js        # Pipe-based scanner
|   |   +-- chart.js         # Base chart interface
|   |   +-- sunburst.js      # Sunburst visualization
|   |   +-- treemap.js       # Treemap visualization
|   |   +-- flamegraph.js    # Flamegraph visualization
|   |   +-- listview.js      # Sidebar list
|   |   +-- breadcrumbs.js   # Navigation breadcrumbs
|   |   +-- data.js          # Data processing
|   |   +-- colors.js        # Color schemes
|   |   +-- graphs.js        # Path utilities
|   |   +-- utils.js         # Helper functions
|   |   +-- mem.js           # Memory scanning
|   |   +-- menu.js          # Menu (legacy)
|   |   +-- file_extensions.js # Extension categories
|   +-- css/                 # Stylesheets
|   +-- node_modules/        # Dependencies
+-- docs/                    # Documentation
+-- package.json             # Root package
```

## Key Technologies

- **Electron** - Cross-platform desktop framework
- **D3.js v3** - Data visualization library
- **d3-flame-graph** - Flamegraph component
- **Canvas 2D** - Treemap rendering
- **systeminformation** - Cross-platform system info
- **PhotonKit** - Electron UI toolkit

## Design Decisions

1. **Multi-process scanning**: Heavy file system traversal runs in a hidden background window to keep the UI responsive.

2. **localStorage IPC**: Large JSON payloads are transferred via localStorage to avoid Electron IPC serialization limits.

3. **Plugin architecture**: Visualizations implement a common Chart interface for easy swapping and extension.

4. **Shared global scope**: Renderer modules share window scope via `<script>` tags (legacy pattern).

5. **Computed properties**: `sum`, `value`, and `color` are computed post-scan to enable different visualization modes.
