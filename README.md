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

Whats New
==

2.0.0
- Major speed up scanning directories. About 10x from version 1, and almost as fast or faster than du.
- Runs disk scanning as a separate headless renderer process
- Json is passed back via IPC
- Remove Async npm dependency

Known Issues
==
- UI may freeze momentary loading large data sets

Development
==

Run

```
electron .
```

or

```
npm run app
```

Check that you have depdencies installed, otherwise run (this may take awhile for electron binaries)

```
npm install
```

Issues
==
Use the [github issue tracker](https://github.com/zz85/space-radar-electron/issues) or contact [@blurspline on twitter](http://twitter.com/blurspline)