# Testing Guide for Size Representation Fix

## How to Verify the Fix

### Manual Testing Steps

1. **Build and Run the Application**
   ```bash
   npm run app
   ```

2. **Test Scenario 1: Large folder with many small files**
   - Scan a directory that has:
     - A few large files/folders (> 1% each)
     - Many small files (< 0.1% each)
   - **Expected behavior**:
     - Large files should show with visual size matching their actual percentage
     - An "Other files (N items)" slice should appear representing the aggregate of small files
     - The "Other files" slice should be light gray in color
     - All slices together should represent 100% of the space (no missing space)

3. **Test Scenario 2: Click on "Other files"**
   - Try clicking on the "Other files" slice
   - **Expected behavior**:
     - Should NOT zoom into the "Other files" node
     - Should remain at the current view level

4. **Test Scenario 3: Zoom into subdirectory**
   - Click on a large subdirectory to zoom in
   - Observe the child slices
   - **Expected behavior**:
     - If the subdirectory has small children (< 0.1% of the subdirectory), they should be aggregated into "Other files"
     - Visual sizes should match actual percentages relative to the current directory

5. **Test Scenario 4: Percentage Display**
   - Hover over different slices and observe the percentage shown in the center
   - **Expected behavior**:
     - Percentages should accurately reflect actual space usage
     - For example, if a file is 23.88 GB in a 33.50 GB parent, it should show approximately 71%

### Visual Indicators

✅ **Correct Behavior:**
- Visual slice size matches percentage shown on hover
- "Other files" appears as a light gray slice when small files exist
- Total visual space = 100% (no gaps or overlaps)

❌ **Incorrect Behavior (old bug):**
- Large files appear as tiny slivers despite high percentages
- Visual size doesn't match percentage
- Small files completely disappear without aggregation

### Example Test Case

**Directory Structure:**
```
MyFolder (100 GB)
├── BigFolder1 (40 GB) - 40%
├── BigFolder2 (30 GB) - 30%
├── MediumFolder (20 GB) - 20%
├── SmallFile1 (3 GB) - 3%
├── SmallFile2 (2 GB) - 2%
├── TinyFile1 (1 GB) - 1%
├── TinyFile2 (0.5 GB) - 0.5%
└── ... 50 more tiny files totaling 3.5 GB - 3.5%
```

**Expected Visualization:**
- BigFolder1: ~40% of the circle (large slice)
- BigFolder2: ~30% of the circle (large slice)
- MediumFolder: ~20% of the circle (medium slice)
- SmallFile1: 3% of the circle (small slice, visible)
- SmallFile2: 2% of the circle (small slice, visible)
- TinyFile1: 1% of the circle (small slice, visible)
- "Other files (51 items)": ~4% of the circle (light gray, aggregates TinyFile2 + 50 tiny files)

**Total**: 100% of the circle is filled

### Automated Testing

Since there's no automated test suite, manual verification using the steps above is recommended. However, you can verify the logic by:

1. **Console Logging**: Check the browser console when running the app
   - Should see "computeNodeCount" and "computeNodeSize" timing logs
   - No JavaScript errors

2. **Inspect Data**: Use browser DevTools to inspect the data structure
   - Look for nodes with `_isOtherFiles: true`
   - Verify `otherNode.sum` equals the sum of all hidden children

### Known Limitations

- The 0.1% threshold is hardcoded in `app/js/data.js` (line 50)
- The "Other files" node cannot be expanded (by design)
- The fix only applies to sunburst view, not treemap (treemap has different filtering approach)
