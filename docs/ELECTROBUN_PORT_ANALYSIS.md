# Electrobun Port Analysis for Space Radar

**Date:** February 6, 2026  
**Issue:** [#66 - Consider rewriting / porting the entire SpaceRadar to ElectronBun](https://github.com/zz85/space-radar/issues/66)

## Executive Summary

Porting Space Radar from Electron to Electrobun would require **moderate to significant effort** (estimated 2-4 weeks of development time). While Electrobun offers compelling benefits in bundle size and performance, the port would require rewriting substantial portions of the codebase and comes with trade-offs that need careful consideration.

**Recommendation:** Consider a **proof-of-concept** implementation first to validate performance claims and assess compatibility with Space Radar's specific requirements before committing to a full port.

---

## What is Electrobun?

[Electrobun](https://github.com/blackboardsh/electrobun) is a modern desktop application framework that aims to be a "solution-in-a-box" for building cross-platform desktop applications. Key characteristics:

- **Runtime:** Uses Bun instead of Node.js for the main process
- **Language:** TypeScript-first design (vs Electron's JavaScript-based approach)
- **WebView:** Uses native system webviews instead of bundling Chromium
- **Bundle Size:** ~12MB self-extracting bundles (vs 100-200MB for typical Electron apps)
- **Updates:** Delta updates as small as 14KB using bsdiff
- **Architecture:** Strong process isolation with typed RPC between main and renderer
- **Maturity:** Beta/early stage (first released Feb 2024, ~2,880 GitHub stars as of Feb 2026)

---

## Current Space Radar Architecture

### Technology Stack
- **Runtime:** Electron 40.1.0
- **Language:** JavaScript (ES6, no TypeScript)
- **UI Framework:** Vanilla JS with D3.js for visualizations
- **CSS Framework:** Photon Kit (Mac-style UI)
- **Key Libraries:**
  - `d3` v3.5.6 + modern d3 modules (hierarchy, scale, selection, shape)
  - `d3-flame-graph` for flamegraph charts
  - `systeminformation` for cross-platform memory stats
  - `electron-updater` for auto-updates

### Code Statistics
- **Total Lines:** ~5,600 lines of JavaScript across 24 files
- **Main Process:** `main.js` + helper modules
- **Renderer Process:** Main window (`index.html` + JS modules)
- **Scanner Process:** Headless renderer window (`headless.html` + `scanner.js`)
- **IPC Usage:** 15+ IPC message handlers for communication between processes

### Core Features
1. **Disk Scanning:** Fast recursive directory traversal with Node.js `fs` module
2. **Visualization:** Sunburst (Canvas 2D), Treemap, and Flamegraph charts
3. **Pause/Resume/Cancel:** Scanning control via IPC messages
4. **Memory Monitoring:** Cross-platform memory usage via `systeminformation`
5. **File Operations:** Open in Finder/Explorer, directory navigation
6. **Import/Export:** Load from `du` command output files (text/gzipped)
7. **Auto-updates:** Via `electron-updater` with GitHub releases

### Process Architecture
```
Main Process (main.js)
├── Main Window (BrowserWindow)
│   └── Renderer (index.html + JS modules)
└── Scanner Window (Hidden BrowserWindow)
    └── Headless Renderer (headless.html + scanner.js)
```

IPC is heavily used for:
- Forwarding scan requests from UI to scanner
- Streaming progress updates (file counts, sizes, errors)
- Pause/resume/cancel commands
- Folder selection dialogs

---

## Porting Effort Analysis

### 1. Code Migration (Estimated: 1-2 weeks)

#### Language Conversion
- **Current:** Pure JavaScript (ES6)
- **Target:** TypeScript (Electrobun is TypeScript-first)
- **Effort:** 
  - Add type definitions for all modules (~24 files)
  - Convert to TypeScript syntax
  - Set up `tsconfig.json` for Bun/Electrobun environment
  - **Complexity:** Medium - code is well-structured but no existing types

#### Main Process Rewrite
- **Current:** `app/main.js` (377 lines)
  - Uses Electron's `BrowserWindow`, `ipcMain`, `dialog`, `Menu`, `shell`
  - Manages two renderer windows (main + scanner)
  - Implements auto-update logic
- **Target:** Electrobun's Bun process (`src/bun/index.ts`)
  - Use Electrobun's `BrowserWindow` API (similar but different)
  - Reimplement menu building with Electrobun's menu API
  - Update auto-update mechanism (if supported)
- **Effort:** Moderate - API is similar but requires careful mapping

#### Scanner Process Architecture
- **Current:** Hidden BrowserWindow running Node.js code
- **Target:** Likely needs to be a Bun worker thread or subprocess
- **Challenges:**
  - Electrobun's process isolation model may differ
  - Need to verify if Bun can run the same `fs` operations efficiently
  - IPC mechanism will be completely different (typed RPC in Electrobun)
- **Effort:** High - this is a critical component that needs redesign

#### IPC Communication
- **Current:** Electron's `ipcMain`/`ipcRenderer` with string-based channels
  ```javascript
  ipcRenderer.send('scan-go', targetPath)
  ipcMain.on('scan-go', (event, targetPath) => { ... })
  ```
- **Target:** Electrobun's typed RPC system
  ```typescript
  // Requires defining typed interfaces for all messages
  interface ScanRequest { path: string }
  // RPC calls instead of raw IPC
  ```
- **Effort:** Medium - need to define types and refactor ~15 IPC call sites

#### File System Operations
- **Current:** Node.js `fs` module (synchronous and asynchronous)
- **Target:** Bun's `fs` (mostly compatible but some differences)
- **Effort:** Low - Bun is largely Node.js compatible here
- **Risk:** Need to verify performance is comparable for disk scanning

### 2. Dependencies Migration (Estimated: 3-5 days)

#### Direct Dependencies
| Package | Current | Electrobun Compatibility | Migration Effort |
|---------|---------|--------------------------|------------------|
| `d3` | v3.5.6 + modern modules | ✅ Should work | Low - may need bundling config |
| `d3-flame-graph` | v4.1.3 | ✅ Browser library | Low |
| `photonkit` | v0.1.2 | ✅ CSS framework | None |
| `systeminformation` | v5.30.7 | ⚠️ Node.js specific | Medium - test with Bun |
| `electron-updater` | v6.7.3 | ❌ Electron-specific | High - use Electrobun's updater |
| `tail-stream` | v0.3.3 | ⚠️ Unknown | Medium - test compatibility |

**Key Concerns:**
- `systeminformation` - heavily relies on Node.js APIs; need to verify Bun compatibility
- `electron-updater` - must be replaced with Electrobun's update mechanism
- Bundle configuration - Electrobun uses Bun's bundler; need to ensure all dependencies bundle correctly

### 3. Build System (Estimated: 2-3 days)

#### Current Build Process
- **Builder:** `electron-builder` v26.0.0
- **Targets:** macOS (x64, arm64, universal), Windows (x64), Linux (x64)
- **Artifacts:** DMG, ZIP (Mac), NSIS installer (Windows), AppImage, DEB (Linux)
- **Configuration:** Extensive config in `package.json` (lines 50-155)

#### Electrobun Build Process
- **Builder:** Built-in `electrobun build` command
- **Configuration:** `electrobun.config.ts` file
- **Targets:** Supports macOS, Windows, Linux
- **Unknown Factors:**
  - Code signing support (Mac needs `hardenedRuntime`, notarization)
  - Icon handling (`.icns`, `.png`)
  - Custom installer options (NSIS configuration)
  - Multi-architecture builds (x64, arm64, universal)

**Effort:** Medium - need to translate electron-builder config to Electrobun format and verify feature parity

### 4. UI/Renderer Changes (Estimated: 3-5 days)

#### Current Renderer
- **HTML:** Vanilla HTML with inline script tags
- **Node Integration:** Enabled (`nodeIntegration: true`)
- **Modules:** Direct `require()` of Node.js modules in browser context
- **D3.js:** Loaded via `require()` and extended with additional modules

#### Electrobun Renderer
- **Structure:** Likely needs `src/mainview/` directory with separate entry point
- **Module System:** Uses Electrobun's bundler, may not support direct `require()` in HTML
- **Node Integration:** Different security model, likely needs RPC for Node.js operations
- **Bundling:** Need to configure how D3 and other libraries are loaded

**Changes Required:**
- Restructure HTML to work with Electrobun's bundler
- Move Node.js operations (file system, shell) to main process with RPC
- Update module loading strategy for D3.js and dependencies
- Test Canvas rendering performance (critical for sunburst visualization)

### 5. Testing & Validation (Estimated: 1 week)

#### Functional Testing
- Disk scanning accuracy and performance
- Pause/resume/cancel operations
- Memory visualization on all platforms
- File operations (open, locate in file manager)
- Import/export from `du` files
- All visualization modes (sunburst, treemap, flamegraph)
- Color schemes and display modes

#### Platform Testing
- macOS (Intel, Apple Silicon)
- Windows 11+
- Linux (Ubuntu 22.04+)

#### Performance Benchmarking
- Scan speed comparison (Electron vs Electrobun)
- Memory usage
- Application startup time
- Bundle size verification

---

## Benefits of Electrobun

### 1. **Dramatically Smaller Bundle Size** ⭐⭐⭐
- **Current:** Electron apps typically 100-200MB (includes Chromium + Node.js)
- **Electrobun:** ~12MB (uses system webview)
- **Benefit:** Faster downloads, smaller disk footprint
- **Space Radar Impact:** HIGH - current v6.0.0 builds are likely 150MB+

### 2. **Tiny Delta Updates** ⭐⭐⭐
- **Current:** electron-updater downloads full new version or large chunks
- **Electrobun:** Updates as small as 14KB via bsdiff
- **Benefit:** Faster updates, less bandwidth
- **Space Radar Impact:** HIGH - users get patches faster

### 3. **Faster Startup** ⭐⭐
- **Electrobun:** No Chromium to initialize, uses native webview
- **Benefit:** Quicker app launch
- **Space Radar Impact:** MEDIUM - app already launches reasonably fast

### 4. **Modern TypeScript Workflow** ⭐⭐
- **Current:** JavaScript with no type safety
- **Electrobun:** TypeScript-first with full type checking
- **Benefit:** Better developer experience, fewer runtime errors
- **Space Radar Impact:** MEDIUM - would improve maintainability

### 5. **Bun Performance** ⭐⭐
- **Current:** Node.js runtime
- **Electrobun:** Bun runtime (faster startup, faster FS operations)
- **Benefit:** Potentially faster disk scanning
- **Space Radar Impact:** MEDIUM-HIGH - disk I/O is core functionality
- **Note:** Needs benchmarking to confirm real-world benefits

### 6. **Simplified Deployment** ⭐
- Self-extracting bundles
- Integrated update system
- Less complex build configuration (potentially)
- **Space Radar Impact:** LOW-MEDIUM - current build system works well

---

## Drawbacks and Risks

### 1. **Framework Maturity** ⚠️⚠️⚠️
- **Electrobun:** Beta/early stage, first released Feb 2024
- **Electron:** Mature, stable, widely used since 2013
- **Risks:**
  - Breaking API changes
  - Undocumented edge cases
  - Limited community support/examples
  - Potential bugs in framework itself
- **Impact:** HIGH RISK - production app stability could suffer

### 2. **Platform Compatibility** ⚠️⚠️
- **Electron:** Comprehensive cross-platform support, battle-tested
- **Electrobun:** "Official" support only for macOS 14+, Windows 11+, Ubuntu 22.04+
- **Risks:**
  - Older OS versions not supported
  - System webview differences across platforms
  - Less control over rendering engine (no bundled Chromium)
- **Impact:** MEDIUM-HIGH - may exclude users on older systems

### 3. **Native Webview Limitations** ⚠️⚠️
- **Electron:** Bundled Chromium ensures consistent rendering
- **Electrobun:** Uses Safari (macOS), Edge WebView2 (Windows), WebKitGTK (Linux)
- **Risks:**
  - Rendering differences across platforms
  - Canvas performance may vary
  - D3.js compatibility issues
  - CSS/JavaScript feature availability varies
- **Impact:** HIGH - Space Radar's Canvas-based sunburst visualization is critical

### 4. **Dependency Compatibility** ⚠️⚠️
- **systeminformation:** Unknown if fully compatible with Bun
- **electron-updater:** Must be replaced entirely
- **Other npm packages:** May have Bun compatibility issues
- **Impact:** MEDIUM - may need to find alternatives or contribute fixes

### 5. **Learning Curve** ⚠️
- New APIs to learn
- Different architecture patterns
- TypeScript conversion required
- Limited documentation/examples compared to Electron
- **Impact:** MEDIUM - increases development time

### 6. **Feature Parity Unknowns** ⚠️⚠️
- **Auto-updates:** Need to verify Electrobun's update system matches electron-updater features
- **Menu handling:** Complex menu with radio buttons, checkboxes
- **File dialogs:** Need equivalents for folder selection
- **Shell integration:** Opening files/folders in system file manager
- **Code signing:** macOS notarization, Windows signing
- **Impact:** MEDIUM-HIGH - may need workarounds or lose features

### 7. **Community and Ecosystem** ⚠️⚠️
- **Electron:** 
  - 114,000+ GitHub stars
  - Massive ecosystem of plugins and tools
  - Extensive documentation and Stack Overflow answers
- **Electrobun:**
  - ~2,880 GitHub stars
  - Small community
  - Limited third-party resources
- **Impact:** MEDIUM - harder to find help when stuck

---

## Technical Compatibility Analysis

### Critical Features Assessment

| Feature | Electron | Electrobun | Migration Risk |
|---------|----------|------------|----------------|
| **File System Scanning** | ✅ Node.js fs | ✅ Bun fs (compatible) | Low |
| **Canvas 2D Rendering** | ✅ Chromium | ⚠️ System webview | Medium-High |
| **IPC Communication** | ✅ ipcMain/Renderer | ✅ Typed RPC | Medium |
| **Hidden Worker Window** | ✅ BrowserWindow | ❓ Unknown pattern | High |
| **Auto-updates** | ✅ electron-updater | ✅ Built-in | Medium |
| **Native Menus** | ✅ Menu API | ✅ Menu API | Low |
| **File Dialogs** | ✅ dialog API | ✅ dialog API | Low |
| **Shell Operations** | ✅ shell.openPath | ✅ Should be available | Low |
| **Multi-window** | ✅ Multiple BrowserWindows | ✅ Supported | Low |
| **System Integration** | ✅ Tray, notifications | ❓ Unknown | Unknown |
| **Memory Profiling** | ✅ systeminformation | ⚠️ Needs testing | Medium |
| **D3.js Compatibility** | ✅ Full support | ⚠️ Needs verification | Medium |

### Performance Benchmarks Needed

Before committing to migration, benchmark these critical operations:

1. **Disk Scanning Speed**
   - Scan ~100,000 files directory tree
   - Compare Electron (Node.js) vs Electrobun (Bun)
   - Measure time to completion

2. **Canvas Rendering**
   - Sunburst chart with 10,000+ nodes
   - Frame rate during animation
   - Cross-platform consistency

3. **Memory Usage**
   - Peak memory during large scans
   - Resident memory at idle
   - Comparison of Chromium vs system webview overhead

4. **Startup Time**
   - Cold start
   - Warm start

---

## Recommended Approach

### Phase 1: Proof of Concept (1-2 weeks)
**Goal:** Validate critical assumptions before full commitment

1. **Create minimal Electrobun app** with:
   - Basic window with Canvas
   - Simple disk scanner (scan single directory)
   - Render results as basic sunburst
   
2. **Benchmark critical paths:**
   - Disk scanning performance (Bun vs Node.js)
   - Canvas rendering performance
   - Cross-platform testing (macOS, Windows, Linux)

3. **Test key dependencies:**
   - Verify `systeminformation` works with Bun
   - Test D3.js rendering in system webviews
   - Validate auto-update mechanism

4. **Assess results:**
   - If performance is better or equivalent: proceed to Phase 2
   - If compatibility issues arise: document blockers
   - If performance is worse: reconsider migration

### Phase 2: Incremental Migration (2-3 weeks)
**If POC is successful:**

1. **Core Infrastructure:**
   - Convert main process to TypeScript
   - Set up Electrobun build configuration
   - Implement IPC layer with typed RPC

2. **Scanner Module:**
   - Port disk scanning logic
   - Implement pause/resume/cancel
   - Add progress streaming

3. **Basic UI:**
   - Port main window
   - Implement sunburst visualization
   - Add basic controls

4. **Feature Parity:**
   - Add treemap and flamegraph views
   - Implement memory monitoring
   - Port all color schemes
   - Add file operations

5. **Polish:**
   - Auto-updates
   - Menu system
   - Error handling
   - Cross-platform testing

### Phase 3: Beta Testing (1-2 weeks)

1. Release to small group of testers
2. Gather feedback on performance and stability
3. Fix platform-specific issues
4. Compare with Electron version

### Alternative: Hybrid Approach

Consider keeping Electron for now but making incremental improvements:
- Reduce bundle size with custom Electron builds
- Optimize scanning performance
- Improve update mechanism

Then revisit Electrobun in 6-12 months when it's more mature.

---

## Cost-Benefit Summary

### Total Estimated Effort
- **Optimistic:** 3-4 weeks (assuming smooth migration)
- **Realistic:** 5-7 weeks (accounting for debugging and platform issues)
- **Pessimistic:** 8-12 weeks (if major compatibility issues arise)

### Maintenance Impact
- **Short-term:** Higher (learning curve, fixing new issues)
- **Long-term:** Potentially lower (TypeScript, smaller codebase to debug)

### User Impact
- **Positive:** Smaller downloads, faster updates, potentially faster performance
- **Negative:** Risk of bugs, possible feature regressions, some users may be on unsupported OS versions

---

## Final Recommendation

### For Immediate Production Use: **Do Not Port Yet** ❌

**Reasons:**
1. Electrobun is still in beta/early stage - too risky for production
2. Space Radar is stable on Electron 40 - "if it ain't broke, don't fix it"
3. Significant development effort (4-7 weeks minimum) with uncertain payoff
4. Risk of introducing bugs and breaking existing functionality
5. Unknown compatibility with critical dependencies

### For Experimentation: **Build a POC** ✅

**Reasons:**
1. Electrobun's benefits (size, performance) are compelling for disk utility apps
2. POC can validate performance claims with minimal risk
3. Opportunity to learn a modern framework
4. Can keep Electron version as fallback
5. If successful, can plan gradual migration

### For Future (6-12 months): **Reconsider When Mature** ⏰

**Wait for:**
1. Electrobun to reach v1.0 or later (more stable API)
2. Larger community adoption (more examples, better docs)
3. Clear evidence of dependency compatibility
4. More apps successfully using it in production

**Monitor:**
- Electrobun's GitHub activity and release notes
- Community feedback and bug reports
- Performance benchmarks from other apps

---

## Action Items

1. ✅ **Review this analysis** with project stakeholders
2. ⬜ **Decide on approach:** POC, wait, or skip entirely
3. ⬜ **If POC:** Allocate 1-2 weeks for prototype development
4. ⬜ **If wait:** Set calendar reminder to revisit in 6 months
5. ⬜ **If skip:** Document decision and close issue #66

---

## References

- [Electrobun GitHub Repository](https://github.com/blackboardsh/electrobun)
- [Electrobun Documentation](https://blackboard.sh/electrobun/docs/)
- [Space Radar Issue #66](https://github.com/zz85/space-radar/issues/66)
- [Bun Runtime](https://bun.sh)
- [Electron Documentation](https://www.electronjs.org/docs/latest)

---

**Document Version:** 1.0  
**Last Updated:** February 6, 2026  
**Author:** GitHub Copilot Analysis
