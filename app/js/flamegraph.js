'use strict'

var ease = require('d3-ease')
var flameGraph = require('d3-flame-graph')
flameGraph = flameGraph()
  .height(400)
  .width(460)
  .cellHeight(18)
  .transitionDuration(0)
  .transitionEase(ease.easeCubic)
  .sort(true)
  //Example to sort in reverse order
  //.sort(function(a,b){ return d3.descending(a.name, b.name);})
  .title('Testing 123')

class Chart {
  resize() {
    console.log('implement me resize()')
  }

  generate() {
    console.log('implement me generate()')
  }

  navigateTo() {
    console.log('implement me navigateTo()')
  }

  showMore() {
    console.log('implement me showMore()')
  }

  showLess() {
    console.log('implement me showLess()')
  }

  cleanup() {
    console.log('implement me cleanup()')
  }
}

class FlameGraph extends Chart {
  constructor() {
    super()
  }

  generate(data) {
    this.data = data

    d3
      .select('#flame-chart')
      .datum(data)
      .call(flameGraph)
  }
}

module.exports = FlameGraph
