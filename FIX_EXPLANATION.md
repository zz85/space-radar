# Fix for Size != %space Issue

## Problem

The issue reported that child rings in the sunburst visualization had visual sizes disproportionate to their actual space usage. Specifically:
- A folder "vpd_slew" of 23.88 GB within "Run16" folder of 33.50 GB
- Should represent 71% (23.88/33.50) of the parent
- But appeared as "a tiny almost invisible sliver"

## Root Cause

The problem was in the `setNodeFilter` function in `app/js/data.js`. The original code:

```javascript
const children = d._children.filter(c => (c.sum / data.sum) * 100 > HIDE_THRESHOLD)
return children
```

This approach had two issues:

1. **Threshold was relative to root, not parent**: The threshold comparison used `data.sum` (the root of the current view) instead of `d.sum` (the parent node). This caused incorrect filtering behavior when zoomed into subdirectories.

2. **Space redistribution**: When children below the threshold were filtered out, their space was completely lost from the visualization. The d3 partition layout would then redistribute the full 360 degrees among only the remaining visible children, causing visual sizes to not match actual percentages.

### Example Scenario

Consider a directory with:
- Total: 100 GB
- BigFile1: 40 GB (40%)
- BigFile2: 30 GB (30%)
- BigFile3: 20 GB (20%)  
- 100 small files: 10 GB total (10%, each <0.1 GB so individually <0.1%)

**Without fix:**
- Only BigFile1, BigFile2, BigFile3 are shown (total 90 GB)
- The partition layout redistributes 360° among these 3 files based on their relative sizes
- BigFile1 gets 40/90 = 44.4% of the visual space (should be 40%)
- BigFile2 gets 30/90 = 33.3% of the visual space (should be 30%)
- BigFile3 gets 20/90 = 22.2% of the visual space (should be 20%)
- The 10 GB from small files is completely invisible

**With fix:**
- BigFile1, BigFile2, BigFile3, and "Other files (100 items)" are shown
- The partition layout uses the full 100 GB
- BigFile1 gets 40% of visual space ✓
- BigFile2 gets 30% of visual space ✓
- BigFile3 gets 20% of visual space ✓
- "Other files" gets 10% of visual space ✓

## Solution

The fix has two parts:

### 1. Correct Threshold Calculation

Changed threshold comparison to use parent node's size instead of root:

```javascript
if ((c.sum / d.sum) * 100 > HIDE_THRESHOLD) {
  visibleChildren.push(c)
} else {
  hiddenChildren.push(c)
}
```

### 2. Aggregate "Other Files" Node

Instead of hiding files below threshold, they are aggregated into a synthetic "Other files" node:

```javascript
const otherNode = {
  name: 'Other files (' + hiddenChildren.length + ' items)',
  sum: otherSum,
  count: otherCount,
  size: otherSum,
  value: otherSum,
  depth: d.depth + 1,
  parent: d,
  _children: null,
  children: null,
  _isOtherFiles: true,
  color: d3.lab(85, 0, 0)  // Light gray color
}
```

This ensures:
- Visual representation accurately reflects actual space usage
- All space is accounted for (percentages add up to 100%)
- Users can see there's additional content below the threshold
- The "Other files" node is visually distinct (gray color)
- Cannot be clicked into (prevented in zoomIn function)

## Files Modified

1. **app/js/data.js**: Modified `setNodeFilter` function to create "Other files" aggregate node
2. **app/js/sunburst.js**: Added check in `zoomIn` function to prevent clicking into synthetic "Other files" nodes

## Benefits

- **Accurate visualization**: Visual size now matches actual percentage of space
- **Better UX**: Users can see all space is accounted for
- **Transparency**: Shows when small files are grouped together
- **Maintains performance**: Threshold still prevents rendering thousands of tiny files individually
