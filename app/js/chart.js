/**
 * Chart interface
 */

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

if (typeof globalThis !== "undefined") {
  globalThis.Chart = Chart;
}

module.exports = Chart
