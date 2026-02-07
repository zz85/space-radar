# Space Radar

SpaceRadar allows interactive visualization of disk space and memory. It currently supports Sunburst, Treemap, and Flamegraph charts.

Built with [Electrobun](https://electrobun.dev) — ultra fast, tiny, cross-platform desktop apps with TypeScript.

## Downloads

Download Mac, Windows, and Linux builds at the [releases page](https://github.com/zz85/space-radar/releases)

## Features

- Space visualizations using sunburst, treemap, and flamegraph charts
- Previews visualization as disk is being scanned
- Fast scanning (completes faster than `du`)
- Cross platform (macOS, Windows, Linux)
- Cancel and pause/resume scanning
- Directory drilldown with breadcrumbs and navigation
- Opens files and directories in system file manager
- Memory usage breakdown (cross-platform)
- Color Schemes — Seaborn palettes, colorblind-friendly options
- 3D Mode — Experimental 3D sunburst visualization

## Screenshots

![space-radar-4](https://cloud.githubusercontent.com/assets/314997/11022585/5c847364-869d-11e5-8079-0a16e7d747e4.gif)

![screenshot 2015-11-09 04 45 27](https://cloud.githubusercontent.com/assets/314997/11022582/3cc0bc90-869d-11e5-85c2-e79a0bf7c27f.png)

![screenshot 2015-11-09 04 45 36](https://cloud.githubusercontent.com/assets/314997/11022581/33822b50-869d-11e5-9fe6-2db6b7a81505.png)

## Reading from a file

To create a file to be read from use `du -ak`, for example:

- `du -ak /var/log /usr | gzip -c > /tmp/sizes.txt.gz`
- `du -ak /opt /home /tmp > /tmp/sizes.txt`

Compressed files can be read directly. To detect them, the file name has to end with `.gz`.

## What's New

### V7

- **Electrobun Migration** — Transitioned from Electron to [Electrobun](https://electrobun.dev) for smaller app size, faster startup, and native system webview
- **Bun Runtime** — Main process now runs on Bun for blazing fast TypeScript execution
- **Typed RPC** — Communication between main and view processes uses typed RPC instead of Electron IPC
- **Native File Dialogs** — Uses Electrobun's native file dialog APIs
- **Simplified Architecture** — No more hidden scanner windows; scanning runs directly in the Bun process

### V6

- **Electron 40** - Major upgrade from Electron 28
- **Apple Silicon** - Native arm64 builds for M1/M2/M3 Macs
- **Canvas Sunburst** - Rewritten visualization using Canvas 2D for much better performance
- **Cancel/Pause Scanning** - Stop or pause ongoing scans, view partial results
- **Free Space Visualization** - See available disk space in the sunburst chart
- **Accurate Scanning** - Skip symlinks, dedupe hardlinks, exclude problematic paths
- **Real-time Stats** - See file/directory counts, scan speed, and errors during scanning
- **Color Schemes** - New Seaborn palettes, colorblind-friendly options
- **3D Mode** - Experimental 3D sunburst visualization

### V5

- Import from DU file
- Flamegraphs (BETA)
- Directory Listview

### V4

- Treemap view
- Memory monitoring
- Context Menus for locating + opening + deleting files / directories
- Navigation controls (back/fwd/up)

## Development

### Prerequisites

- [Bun](https://bun.sh) runtime
- macOS, Windows, or Linux

### Install dependencies:

```bash
bun install
```

### Run in development mode:

```bash
bun run dev
```

Or simply:

```bash
bun start
```

### Build for distribution:

```bash
bun run build
```

## Architecture

SpaceRadar uses Electrobun's architecture:

- **Bun Main Process** (`src/bun/index.ts`): Handles window management, file scanning, native dialogs, and system operations
- **Webview** (`src/mainview/`): The UI with D3.js visualizations, communicates with the main process via typed RPC
- **RPC Schema** (`src/mainview/rpc.ts`): Type-safe interface for bidirectional communication

## History

This project started as a quick prototype for testing [Electron](https://www.electronjs.org/) and [D3.js](https://d3js.org). In V7 it was migrated to [Electrobun](https://electrobun.dev) for a smaller, faster, more modern desktop app experience.

## Issues

Please raise on [GitHub issue tracker](https://github.com/zz85/space-radar/issues) or contact [@blurspline on Twitter](http://twitter.com/blurspline)

## Thanks

- [Jill](http://jilln.com/) for designing the app logo
- [Contributors](https://github.com/zz85/space-radar/graphs/contributors)

## License

MIT
