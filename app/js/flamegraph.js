'use strict'

var ease = require('d3-ease')
var flameGraph = require('d3-flame-graph')

class FlameGraph extends Chart {
  constructor() {
    super()

    this.graph = flameGraph()
      .height(400)
      .width(460)
      .cellHeight(18)
      .transitionDuration(1000)
      .transitionEase(ease.easeCubic)
    // .sort(true)
    //.sort(function(a,b){ return d3.descending(a.name, b.name);})
    // .title('Testing 123')
  }

  resize() {
    this.graph.width(width).height(height)

    this.draw()
  }

  draw() {
    if (!this.data) return
    d3
      .select('#flame-chart')
      .datum(this.data)
      .call(this.graph)
  }

  generate(data) {
    this.data = data
    this.draw()
  }
}

module.exports = FlameGraph
