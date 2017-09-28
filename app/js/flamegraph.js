'use strict'

const flameGraph = require('d3-flame-graph')

function getNodePath(node) {
  const fullname = []
  while (node.parent) {
    fullname.push(node.name)
    node = node.parent
  }
  fullname.push(node.name)

  return fullname.reverse()
}

class FlameGraph extends Chart {
  constructor() {
    super()

    this.chart = d3.select('#flame-chart')

    this.graph = flameGraph()
      .height(400)
      .width(460)
      .cellHeight(20)
      .transitionDuration(350)
      .transitionEase(d3.easeCubic)
    // .sort(true)
    //.sort(function(a,b){ return d3.descending(a.name, b.name);})
    // .title('')

    var tip = d3
      .tip()
      .direction('s')
      .offset([8, 0])
      .attr('class', 'd3-flame-graph-tip')
      .html(d => {
        const fullpath = getNodePath(d.data).join('/')
        // short name = d.data.name
        return fullpath + ' - ' + format(d.data.value) + ' ' + `(${(d.data.value / this.data.value * 100).toFixed(2)}%)`
      })

    this.graph.tooltip(tip).onClick(e => {
      if (e) {
        const movingTo = getNodePath(e.data).join('/')
        const route = Navigation.currentPath().join('/')
        console.log('click captured', e)
        if (route !== movingTo) {
          console.log('movingTo', movingTo, route)
        }
        this.currentPath = movingTo
        State.navigateTo(getNodePath(e.data))
      }
    })
  }

  resize() {
    const newHeight = height * 2 / 3
    console.log('FlameGraph resize', width, height)
    this.graph.width(width).height(newHeight)
    const svg = document.querySelector('.d3-flame-graph')
    svg.setAttribute('width', width)
    svg.setAttribute('height', newHeight)
    this.draw()
  }

  draw() {
    if (!this.data) return
    console.log('FlameGraph draw')

    this.chart.datum(this.data).call(this.graph)
  }

  navigateTo(path, node, root) {
    if (path.join('/') === this.currentPath) return console.log('abort draw')
    console.log('FlameGraph navigateTo')
    this.data = root
    this.draw()
    if (node && node !== root) {
      this.graph.zoomTo(node)
    }
  }

  generate(data) {
    console.log('FlameGraph generate')
    computeNodeSize(data)
    this.data = data
    this.draw()
  }

  cleanup() {
    this.chart.empty()
  }
}

module.exports = FlameGraph
