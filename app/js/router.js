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

/*****************
 * Graph Plugins
 * .generate(json)
 * .navigateTo(keys)
 * .cleanup()
 * .resize()
 * .showMore()
 * .showLess()
 */

// plugins
var treemapGraph = TreeMap()
var sunburstGraph = SunBurst()

Navigation.on('navigationchanged', path => {
  PluginManager.navigateTo(path)
})

let activatedGraph

window.PluginManager = {
  resize: () => {
    activatedGraph.resize()
  },

  generate: json => {
    this.data = json
    console.trace('generate', json)
    activatedGraph.generate(json)
    Navigation.updatePath([json.name])
  },

  navigateTo: path => {
    console.log('navigateTo', path)

    const current = getNodeFromPath(path, this.data)
    let str = '----------\n'
    ;(current._children || current.children)
      .sort((a, b) => {
        if (a.value < b.value) return 1
        if (a.value > b.value) return -1
        return 0
      })
      .slice(0, 5)
      .forEach(child => {
        str += child.name + '\t' + format(child.value) + '\n'
      })
    log(str)
    activatedGraph.navigateTo(path)
  },

  navigateUp: () => {
    var current = Navigation.currentPath()
    if (current.length > 1) {
      current.pop()
      Navigation.updatePath(current)
    }
  },

  showLess: () => activatedGraph.showLess(),
  showMore: () => activatedGraph.showMore(),

  cleanup: () => {
    activatedGraph.cleanup()
  },

  activate: graph => {
    activatedGraph = graph

    if (this.data) {
      loadLast()
      PluginManager.resize()
      PluginManager.navigateTo(Navigation.currentPath())
    }
  }
}

showSunburst()
// showTreemap(true)

global.State = {
  clearNavigation: () => Navigation.clear()
}
