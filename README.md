# Space Radar

SpaceRadar allows interactive visualization of disk space and memory. It currently supports Sunburst, Treemap, and Flamegraph charts.

## Downloads

Download Mac, Windows, and Linux builds at the [releases page](https://github.com/zz85/space-radar/releases)

## Features

- Space visualizations using sunburst, treemap, and flamegraph charts
- Previews visualization as disk is being scanned
- Fast scanning (completes faster than `du`)
- Cross platform (macOS, Windows, Linux)
- Apple Silicon native support (arm64)
- Cancel and pause/resume scanning
- Free space visualization
- Directory drilldown with breadcrumbs and navigation
- Opens files and directories in system file manager
- Analyze disk contents from a remote server (see [Reading from a file](#reading-from-a-file))
- Memory usage breakdown (cross-platform)
- Auto-updates

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

### V6

- **Electron 40** - Major upgrade from Electron 28
- **Apple Silicon** - Native arm64 builds for M1/M2/M3 Macs
- **Canvas Sunburst** - Rewritten visualization using Canvas 2D for much better performance
- **Cancel/Pause Scanning** - Stop or pause ongoing scans, view partial results
- **Free Space Visualization** - See available disk space in the sunburst chart
- **Accurate Scanning** - Skip symlinks, dedupe hardlinks, exclude problematic paths (OneDrive caches, system files)
- **Real-time Stats** - See file/directory counts, scan speed, and errors during scanning
- **Memory Visualization** - Cross-platform support (macOS, Windows, Linux)
- **Color Schemes** - New Seaborn palettes, colorblind-friendly options
- **3D Mode** - Experimental 3D sunburst visualization
- **Auto-updates** - Automatic update notifications via electron-updater
- **GitHub Actions CI/CD** - Automated builds for all platforms

### V5

- Import from DU file
- Upgrade electron
- Flamegraphs (BETA)
- Directory Listview
- Update libs - Electron, D3

### V4

- Treemap view
- Memory monitoring
- Mac App look using [Photon](http://photonkit.com)
- Context Menus for locating + opening + deleting files / directories
- Navigation controls (back/fwd/up)
- Switched disk scanning jobs to invisible renderer process

### V3

- App icon finally! Thanks [Jill](http://jilln.com/) for the help with this :)
- Many Bug fixes
- Disk scanning is moved to a webview process
- Investigated various RPC methods. Now uses LocalStorage + FileSystem IPC message passing
- Reduce memory usage (and Electron crashes) by not caching key paths
- Tested on > 100GB & 2M files
- Improvements to user interactivity esp on hover states
- To prevent renderer process from hitting heap mem limit (1.5GB), all previous data is null, with dom elements removed to reduce memory pressure
- Allow target selection for disk usage scanning
- Locate path in Finder
- Env Debug Flags

### V2

- Major speed up scanning directories. About 10x from version 1, and almost as fast or faster than du.
- Runs disk scanning as a separate headless renderer process
- Json is passed back via IPC
- Remove Async npm dependency

## Development

Install dependencies:

```bash
npm install
```

Run in development mode:

```bash
npm run debug
```

Or simply:

```bash
npm start
```

Build for distribution:

```bash
npm run build        # Current platform
npm run build:mac    # macOS
npm run build:win    # Windows
npm run build:linux  # Linux
```

## History

This project started as quick prototype for me to test drive [Electron](https://www.electronjs.org/) (& some ES6 syntax), [D3.js](https://d3js.org) and to explore the question of "what's taking up my disk space". Turns out writing a disk visualization app isn't that simple as I dwell into figuring out how to make disk scanning not block the UI thread, IPC calls go faster, smoother rendering, lesser memory usage, more sensible interactions...

## Issues

Please raise on [GitHub issue tracker](https://github.com/zz85/space-radar/issues) or contact [@blurspline on Twitter](http://twitter.com/blurspline)

## Thanks

- [Jill](http://jilln.com/) for designing the app logo
- Jianwei for his comments on the app
- Chee Aun for helping alpha test the app
- WM for his talk on Electron that got me started
- [Contributors](https://github.com/zz85/space-radar/graphs/contributors)

## License

MIT
