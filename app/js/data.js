/**
 * Process data
 */

const partition = d3.layout.partition()

function computeNodeCount(data) {
  console.time('compute1')
  partition
    .value(d => 1)
    .nodes(data)
    .forEach(d => {
      d.count = d.value
    })
  console.timeEnd('compute1')
}

function computeNodeSize(data) {
  console.time('compute2')
  partition
    .value(d => d.size)
    .nodes(data)
    // .filter(function(d) {
    //   return (d.dx > 0.005); // 0.005 radians = 0.29 degrees
    // })
    .forEach(function(d) {
      d._children = d.children // save before mutating
      d.sum = d.value
    })

  console.timeEnd('compute2')
}

function namesort(a, b) {
  return d3.ascending(a.name, b.name)
}
function sizesort(a, b) {
  return d3.ascending(a.sum, b.sum)
}
function countsort(a, b) {
  return d3.ascending(a.count, b.count)
}
