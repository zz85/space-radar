"use strict";

//
// Breadcrumbs
//

var selection = null;
const { contextMenu } = require("./electrobun");

function updateBreadcrumbs(d) {
  console.trace("highlightPath remove me");
  State.highlightPath(keys(d));
}

function updateSelection(s) {
  // TODO fix this
  selection = s;
}

class Breadcumbs extends Chart {
  navigateTo(_path, d) {
    if (!d) return;

    this.trail = getAncestors(d);
    _updateBreadcrumbs(this.trail);
  }

  highlightPath(_path, d) {
    if (d) {
      _updateBreadcrumbs(getAncestors(d));
      updateSelection(d);
    } else {
      _updateBreadcrumbs(this.trail);
      updateSelection(null);
    }
  }
}

const contextMenuActions = {
  "open-directory": showSelection,
  "open-file": openSelection,
  delete: trashSelection,
};

contextMenu.onAction((action) => {
  const handler = contextMenuActions[action];
  if (handler) {
    handler();
  }
});

window.addEventListener(
  "contextmenu",
  function(e) {
    if (!selection) return;
    e.preventDefault();
    const openFileEnabled = !selection.children;
    contextMenu.show([
      { label: "Open Directory", action: "open-directory" },
      { type: "separator" },
      { label: "Open File", action: "open-file", enabled: openFileEnabled },
      { type: "separator" },
      { label: "Delete", action: "delete" },
    ]);
  },
  false
);

// Given a node in a partition layout, return an array of all of its ancestor
// nodes, highest first, but excluding the root.
function getAncestors(node) {
  if (!node) return [];
  let path = [];
  let current = node;
  while (current.parent) {
    path.unshift(current);
    current = current.parent;
  }

  let root = current;

  if (root.name == "/" || root.name.indexOf("/") === -1) {
    path.unshift(root);
  } else {
    path = root.name
      .split(PATH_DELIMITER)
      .slice(1)
      .map(d => {
        return {
          name: d,
          depth: -1,
          root: true
        };
      })
      .concat(path);
  }

  return path;
}

// Update the breadcrumb trail to show the current sequence and percentage.
function _updateBreadcrumbs(nodeArray) {
  // Data join; key function combines name and depth (= position in sequence).
  let g = d3
    .select("#bottom_status")
    .selectAll("span")
    .data(nodeArray, function(d) {
      return d.name + d.depth;
    });

  // Add breadcrumb and label for entering nodes.
  let entering = g
    .enter()
    .append("span")
    // .style('-webkit-user-select', 'none')
    .style("-webkit-app-region", "no-drag")
    .style("cursor", "pointer")
    .on("click", d => {
      log("navigate", d);
      State.navigateTo(keys(d));
    });

  entering.text(function(d) {
    return (nodeArray[0] === d ? "" : " > ") + d.name;
    // (nodeArray[nodeArray.length - 1] === d ? ' (' + format(d.value) + ')' : '')
  });

  // Remove exiting nodes.
  g.exit().remove();
}
