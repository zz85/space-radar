# Electron vs Electrobun - Code Comparison

This document shows side-by-side comparisons of how the same features are implemented in Electron vs Electrobun.

## 1. Creating a Window

### Electron (Current Space Radar)
```javascript
// main.js
const { BrowserWindow } = require('electron');

const mainWindow = new BrowserWindow({
  width: 800,
  height: 600,
  webPreferences: {
    nodeIntegration: true,
    contextIsolation: false
  }
});

mainWindow.loadURL('file://' + __dirname + '/index.html');
```

### Electrobun (This POC)
```typescript
// src/bun/index.ts
import { BrowserWindow } from "electrobun/bun";

const mainWindow = new BrowserWindow({
  title: "Space Radar",
  url: "views://mainview/index.html",
  frame: {
    width: 800,
    height: 600,
    x: 100,
    y: 100
  },
  rpc, // Typed RPC attached
});
```

**Differences:**
- ✅ TypeScript vs JavaScript
- ✅ ES modules vs CommonJS
- ✅ `views://` protocol vs file paths
- ✅ RPC built-in vs manual IPC setup

---

## 2. IPC / RPC Communication

### Electron (String-based IPC)
```javascript
// Main process
const { ipcMain } = require('electron');

ipcMain.on('scan-go', (event, targetPath) => {
  // No type checking
  console.log('Scanning:', targetPath);
  
  // Do scan...
  const result = { success: true, data: scanData };
  
  // Send back via event
  event.sender.send('scan-complete', result);
});

// Renderer process
const { ipcRenderer } = require('electron');

ipcRenderer.send('scan-go', '/tmp');

ipcRenderer.on('scan-complete', (event, result) => {
  console.log('Result:', result);
});
```

### Electrobun (Typed RPC)
```typescript
// Type definition (src/bun/types/rpc.ts)
interface SpaceRadarRPC {
  requests: {
    startScan: {
      params: string;
      response: { success: boolean; data: FileNode };
    };
  };
  messages: {
    scanProgress: { fileCount: number; dirCount: number };
  };
}

// Main process (src/bun/index.ts)
const rpc = BrowserView.defineRPC<SpaceRadarRPC>({
  handlers: {
    requests: {
      startScan: async (targetPath) => {
        // TypeScript knows targetPath is a string
        const result = await scanner.scan(targetPath);
        return { success: true, data: result };
        // TypeScript enforces return type
      }
    }
  }
});

// Renderer process (src/mainview/index.ts)
const rpc = BrowserView.getRPC<SpaceRadarRPC>();

const result = await rpc.request.startScan('/tmp');
// TypeScript knows result type: { success: boolean; data: FileNode }

rpc.listen.scanProgress((data) => {
  // TypeScript knows data: { fileCount: number; dirCount: number }
  updateUI(data);
});
```

**Differences:**
- ✅ Type-safe vs string-based
- ✅ Promise-based vs callback-based  
- ✅ Auto-completion in IDE
- ✅ Compile-time error checking
- ✅ Self-documenting API

---

## 3. Sending Progress Updates

### Electron
```javascript
// Main process - manual tracking and sending
let mainWindow;

function scanDirectory(path) {
  // ... scanning logic ...
  
  // Manually send progress
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('scan-progress', {
      fileCount: stats.fileCount,
      dirCount: stats.dirCount
    });
  }
}

// Renderer - listen for events
ipcRenderer.on('scan-progress', (event, data) => {
  document.getElementById('fileCount').textContent = data.fileCount;
});
```

### Electrobun
```typescript
// Main process - automatic with RPC
const rpc = BrowserView.defineRPC<SpaceRadarRPC>({...});

scanner.setProgressCallback((stats) => {
  // Send via RPC message - type-checked
  rpc.send.scanProgress({
    fileCount: stats.fileCount,
    dirCount: stats.dirCount,
    totalSize: stats.totalSize,
    errorCount: stats.errorCount,
  });
});

// Renderer - typed listener
rpc.listen.scanProgress((data) => {
  // TypeScript knows exact structure of data
  document.getElementById('fileCount').textContent = 
    data.fileCount.toLocaleString();
});
```

**Differences:**
- ✅ No window null checks needed
- ✅ Type-checked messages
- ✅ Cleaner, more declarative

---

## 4. File Structure

### Electron (Current)
```
app/
├── main.js                    # Main process (CommonJS)
├── index.html                 # Renderer with node integration
├── headless.html              # Hidden scanner window
├── package.json
└── js/
    ├── scanner.js             # Runs in hidden window
    ├── ipc.js                 # Custom IPC setup
    ├── radar.js               # UI logic
    ├── sunburst.js            # Visualization
    └── ... (20+ files)
```

### Electrobun (POC)
```
electrobun-poc/
├── electrobun.config.ts       # App configuration
├── package.json
├── tsconfig.json              # TypeScript config
└── src/
    ├── bun/                   # Main process
    │   ├── index.ts           # Entry point
    │   ├── scanner.ts         # Scanner
    │   └── types/
    │       └── rpc.ts         # RPC types
    └── mainview/              # Renderer
        ├── index.ts           # UI logic
        ├── index.html         # UI markup
        └── index.css          # Styles
```

**Differences:**
- ✅ Clearer separation (bun vs mainview)
- ✅ No hidden windows needed
- ✅ TypeScript throughout
- ✅ Modern ES modules

---

## 5. Build Configuration

### Electron (electron-builder)
```json
{
  "build": {
    "appId": "com.zz85.spaceradar",
    "directories": {
      "app": "app",
      "output": "dist"
    },
    "files": [
      "**/*",
      "!node_modules/*/{CHANGELOG.md,README.md,...}"
    ],
    "mac": {
      "category": "public.app-category.utilities",
      "icon": "Icon.icns",
      "target": ["dmg", "zip"]
    }
    // ... 100+ lines of config
  }
}
```

### Electrobun
```typescript
export default {
  app: {
    name: "Space Radar",
    identifier: "com.zz85.space-radar.electrobun",
    version: "0.1.0",
  },
  build: {
    views: {
      mainview: {
        entrypoint: "src/mainview/index.ts",
      },
    },
    copy: {
      "src/mainview/index.html": "views/mainview/index.html",
      "src/mainview/index.css": "views/mainview/index.css",
    },
    mac: {
      bundleCEF: false, // Use system webview
    },
  },
} satisfies ElectrobunConfig;
```

**Differences:**
- ✅ Type-checked configuration
- ✅ Simpler, more declarative
- ✅ Built-in view system
- ✅ Automatic bundling

---

## 6. Package Size

### Electron Build
```
SpaceRadar.app/
├── Contents/
│   ├── Frameworks/
│   │   └── Electron Framework.framework/  (~120MB)
│   │       └── Chromium + Node.js
│   └── Resources/
│       └── app/                            (~5MB)
│           └── Your code

Total: ~150MB
```

### Electrobun Build (Projected)
```
SpaceRadar.app/
├── Contents/
│   ├── MacOS/
│   │   └── launcher                       (~8MB Bun runtime)
│   └── Resources/
│       ├── app.asar                       (~2MB bundled code)
│       └── assets/                        (~1MB icons/images)

Total: ~12MB (uses system Safari webview)
```

**Differences:**
- ✅ 92% smaller (12MB vs 150MB)
- ✅ No bundled Chromium
- ✅ Faster downloads
- ✅ Less disk space

---

## 7. Updates

### Electron (electron-updater)
```javascript
const { autoUpdater } = require('electron-updater');

autoUpdater.checkForUpdatesAndNotify();

// Downloads full new version or large chunks
// Update size: 50-150MB
```

### Electrobun (Built-in bsdiff)
```typescript
// Automatic delta updates via bsdiff
// Only downloads changed bytes
// Update size: 14KB - 5MB (typically)
```

**Differences:**
- ✅ 90%+ smaller updates
- ✅ Faster deployment
- ✅ Less bandwidth usage
- ✅ Built into framework

---

## 8. Development Experience

### Electron
```bash
# Start development
npm start                  # Launches Electron

# Make changes
# Save file
# Manual restart needed in most cases

# Build for production
npm run build             # electron-builder (slow)
```

### Electrobun
```bash
# Start development  
bun run dev               # Launches app

# Make changes
# Save file
# Hot reload automatic ✨

# Build for production
bun run build             # Electrobun bundler (fast)
```

**Differences:**
- ✅ Faster startup (Bun)
- ✅ Hot reload built-in
- ✅ No compilation step for TypeScript
- ✅ Faster builds

---

## Summary

| Feature | Electron | Electrobun | Winner |
|---------|----------|------------|--------|
| **Type Safety** | Optional | Built-in | 🏆 Electrobun |
| **IPC** | String-based | Typed RPC | 🏆 Electrobun |
| **Bundle Size** | ~150MB | ~12MB | 🏆 Electrobun |
| **Update Size** | 50-150MB | 14KB-5MB | 🏆 Electrobun |
| **Dev Speed** | Good | Faster | 🏆 Electrobun |
| **Maturity** | Stable | Beta | 🏆 Electron |
| **Community** | Large | Small | 🏆 Electron |
| **Ecosystem** | Huge | Growing | 🏆 Electron |

**Verdict:** Electrobun offers compelling technical benefits (size, speed, DX) but Electron wins on maturity and ecosystem. For Space Radar, the bundle size reduction alone (92%) may justify the migration once Electrobun reaches v1.0.
