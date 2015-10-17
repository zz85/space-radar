Space Radar Electron
====
Space Radar Electron is a disk space visualizer built with [d3.js](d3js.org) and [atom electron](electron.atom.io)

![](https://pbs.twimg.com/media/CRi_IYuU8AAhobo.png:large)


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

Known Issues
==
- Electron may freeze when scanning really really large directories

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