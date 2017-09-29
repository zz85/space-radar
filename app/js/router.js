const { EventEmitter } = require('events')

class NavigationController extends EventEmitter {
  constructor() {
    super()
    this.clear()
  }

  clear() {
    this.backStack = []
    this.fwdStack = []
  }

  currentPath() {
    const { backStack } = this
    return backStack.length ? backStack[backStack.length - 1].concat() : []
  }

  updatePath(path) {
    if (!path.length) return
    if (this.currentPath().join('/') === path.join('/')) return
    let n = this.currentPath()
    if (!n || n !== path) {
      this.backStack.push(path)
      if (this.fwdStack.length) this.fwdStack = []
    }

    this.notify()
  }

  notify() {
    this.emit('navigationchanged', this.currentPath())
  }

  back() {
    if (this.backStack.length < 2) return
    let n = this.backStack.pop()
    log('navigateBack', n)
    this.fwdStack.push(n)
    this.notify()
  }

  forward() {
    if (!this.fwdStack.length) return
    let n = this.fwdStack.pop()
    this.backStack.push(n)
    this.notify()
  }
}

global.Navigation = new NavigationController()

global.State = {
  navigateTo: path => Navigation.updatePath(path),
  clearNavigation: () => {
    Navigation.clear()
    PluginManager.clear()
  },
  highlightPath: path => {
    PluginManager.highlightPath(path)
  }
}

/*****************
 * Graph Plugins
 * .generate(json)
 * .navigateTo(keys)
 * .cleanup()
 * .resize()
 * .showMore()
 * .showLess()
 */

Navigation.on('navigationchanged', path => {
  PluginManager.navigateTo(path)
})

let width, height

function calculateDimensions() {
  width = innerWidth
  height =
    innerHeight -
    document.querySelector('header').getBoundingClientRect().height -
    document.querySelector('footer').getBoundingClientRect().height
}

/**
 * Activate - adds to graph plugin, runs generate data
 * Generate - loads data, then navigates to path
 * Navigate - gotos path
 */
class SpacePluginManager {
  constructor() {
    const activatedGraphs = new Set()
    this.activatedGraphs = activatedGraphs
  }

  resize() {
    calculateDimensions()
    this.activatedGraphs.forEach(activatedGraph => activatedGraph.resize())
  }

  clear() {
    this.data = null
    // TODO run clear on graphs?
  }

  generate(json) {
    console.trace('generate', json)

    const loaded = this.data
    this.data = json

    this.activatedGraphs.forEach(activatedGraph => activatedGraph.generate(json))
    this.resize()
    if (!loaded) {
      State.navigateTo([json.name])
    } else {
      this.navigateTo(Navigation.currentPath())
    }
  }

  navigateTo(path) {
    console.log('navigateTo', path)

    if (!this.data) return
    //
    const current = getNodeFromPath(path, this.data)

    this.activatedGraphs.forEach(activatedGraph => activatedGraph.navigateTo(path, current, this.data))
  }

  highlightPath(path) {
    const current = path && path.length ? getNodeFromPath(path, this.data) : null
    this.activatedGraphs.forEach(activatedGraph => {
      if (activatedGraph.highlightPath) activatedGraph.highlightPath(path, current, this.data)
    })
  }

  navigateUp() {
    var current = Navigation.currentPath()
    if (current.length > 1) {
      current.pop()
      State.navigateTo(current)
    }
  }

  showLess() {
    this.activatedGraphs.forEach(activatedGraph => activatedGraph.showLess())
  }

  showMore() {
    this.activatedGraphs.forEach(activatedGraph => activatedGraph.showMore())
  }

  cleanup() {
    this.activatedGraphs.forEach(activatedGraph => activatedGraph.cleanup())
  }

  activate(graph) {
    this.activatedGraphs.add(graph)

    if (this.data) {
      // this.data = _loadLast()
      this.generate(this.data)

      // this.navigateTo(Navigation.currentPath())
    }
  }

  loadLast() {
    this.generate(_loadLast())
  }

  deactivate(graph) {
    graph.cleanup()
    this.activatedGraphs.delete(graph)
  }

  deactivateAll() {
    this.activatedGraphs.forEach(graph => this.deactivate(graph))
  }
}

global.PluginManager = new SpacePluginManager()

// chart plugins
const treemapGraph = TreeMap()
const sunburstGraph = SunBurst()
const flamegraphGraph = new FlameGraph()

// common
const listview = new ListView()
const breadcrumbs = new Breadcumbs()

PluginManager.activate(listview)
PluginManager.activate(breadcrumbs)

showSunburst()
// showFlamegraph()
// showTreemap()
