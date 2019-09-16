/**
 * Process data
 */

let partition

// Moving this here for some v8 specific optimizations

function one() {
  return 1
}

function sizeValue(d) {
  return d.size
}

function countIsValue(d) {
  return (d.count = d.value)
}

function sumAndHideChildren(d) {
  d._children = d.children // save before mutating
  d.sum = d.value
}

function computeNodeCount(data) {
  console.time('computeNodeCount')
  partition
    .value(one)
    .nodes(data)
    .forEach(countIsValue)

  console.timeEnd('computeNodeCount')
}
function computeNodeSize(data) {
  console.time('computeNodeSize')
  partition
    .value(sizeValue)
    .nodes(data)
    // .filter(function(d) {
    //   return (d.dx > 0.005); // 0.005 radians = 0.29 degrees
    // })
    .forEach(sumAndHideChildren)

  console.timeEnd('computeNodeSize')
}

function setNodeFilter(data) {
  const LEVELS = 11,
    HIDE_THRESHOLD = 0.1

  return partition.children(function hideChildren(d, depth) {
    if (depth >= LEVELS) {
      return null
    }
    if (!d._children) return null

    const children = d._children.filter(c => c.sum / data.sum * 100 > HIDE_THRESHOLD)
    return children
    // return depth < LEVELS ? d._children : null;
  })
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
