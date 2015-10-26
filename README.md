Space Radar Electron
====
Space Radar Electron is a disk space visualizer built with [d3.js](d3js.org) and [atom electron](electron.atom.io)

![](https://pbs.twimg.com/media/CRi_IYuU8AAhobo.png:large)

Downloads
==
Right now only Mac builds over at the [releases page](https://github.com/zz85/space-radar-electron/releases)


Features
==
- preview visualization as disk is being scanned
- cross platform (in theory, right now tested on Mac OSX)
- allow drilldown of directories
- breadcrumbs navigation

Future Enhancements
==
- select target for scanning
- color by file types
- filter hidden files
- moar!!
- let me know what you think

Futher Explorations
==
- More efficient memory usage
- More efficient scanning process
- 3D visualization

Whats New
==
V4
- Memory monitoring


Version 3
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

Version 2
- Major speed up scanning directories. About 10x from version 1, and almost as fast or faster than du.
- Runs disk scanning as a separate headless renderer process
- Json is passed back via IPC
- Remove Async npm dependency

Issues
==
Please raise on [github issue tracker](https://github.com/zz85/space-radar-electron/issues) or contact [@blurspline on twitter](http://twitter.com/blurspline)

Development
==

Run

```
DEBUG=true electron .
```

or

```
npm run app
```

Check that you have depdencies installed, otherwise run (this may take awhile for electron binaries)

```
npm install
```

Thanks
==
[Jill](http://jilln.com/) for designing the app logo
Jianwei for his comments on the app
Chee Aun for helping alpha test the app
WM for his talk on Electron that got me started