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

    // Separate children into visible and hidden based on threshold
    // NOTE: Threshold is calculated relative to the parent node (d.sum), not the root.
    // This ensures correct filtering behavior when zoomed into subdirectories.
    const visibleChildren = []
    const hiddenChildren = []
    
    d._children.forEach(c => {
      if ((c.sum / d.sum) * 100 > HIDE_THRESHOLD) {
        visibleChildren.push(c)
      } else {
        hiddenChildren.push(c)
      }
    })
    
    // If there are hidden children, create an aggregate "Other files" node
    // This ensures the visual representation accurately reflects the actual space usage
    if (hiddenChildren.length > 0) {
      // Calculate total size and count of hidden items
      let otherSum = 0
      let otherCount = 0
      hiddenChildren.forEach(c => {
        otherSum += c.sum
        otherCount += c.count
      })
      
      // Create synthetic "Other files" node
      const otherNode = {
        name: 'Other files (' + hiddenChildren.length + ' items)',
        sum: otherSum,
        count: otherCount,
        size: otherSum,
        value: otherSum,
        depth: d.depth + 1,
        parent: d,
        _children: null,  // Other files node has no children
        children: null,
        _isOtherFiles: true,  // Mark this as a synthetic node
        color: d3.lab(85, 0, 0)  // Light gray color to distinguish it
      }
      
      visibleChildren.push(otherNode)
    }
    
    return visibleChildren
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
