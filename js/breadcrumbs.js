'use strict'

//
// Breadcrumbs
//

let backStack = [], fwdStack = []

/*
Simple Navigation Controller
- toolbar gives intent to graph plugin via graph.navigateTo(bla)
- when the graph navigates to a new path, it calls updateNavigation
- (global)
*/

function clearNavigation() {
  backStack = [], fwdStack = []
}

function currentPath() {
  let n = backStack[backStack.length - 1]
  return n
}

function updateNavigation(path) {
  let n = currentPath()
  if (!n || n !== path) {
    backStack.push(path)
    if (fwdStack.length) fwdStack = []
  }
}

function navigateBack() {
  if (backStack.length < 2) return
  let n = backStack.pop()
  log('navigateBack', n)
  fwdStack.push(n)
  graphPlugin.navigateTo(currentPath())
}

function navigateForward() {
  if (!fwdStack.length) return
  let n = fwdStack.pop()
  backStack.push(n)
  graphPlugin.navigateTo(n)
}

var selection = null

function updateBreadcrumbs(d) {
  if (d) {
    _updateBreadcrumbs(getAncestors(d))
  }
}

function updateSelection(s) {
  selection = s
}


var Menu = remote.Menu
var MenuItem = remote.MenuItem

var contextMenu = new Menu();
var openMenu = new MenuItem({ label: 'Open', click: openSelection })
var sep = new MenuItem({ type: 'separator' })
contextMenu.append(new MenuItem({ label: 'Locate', click: showSelection }))
contextMenu.append(sep)
contextMenu.append(openMenu)

// contextMenu.append(new MenuItem({ label: 'External', click: externalSelection }))
contextMenu.append(sep)
contextMenu.append(new MenuItem({ label: 'Delete', click: trashSelection }))

var optionsMenu = new Menu();
optionsMenu.append(new MenuItem({ label: 'Sort by Size', type: 'checkbox', checked: true }));
optionsMenu.append(new MenuItem({ label: 'Sort by Name', type: 'checkbox', checked: true }));

window.addEventListener('contextmenu', function (e) {
  if (!selection) return
  e.preventDefault();

  openMenu.enabled = !selection.children

  contextMenu.popup(remote.getCurrentWindow());
}, false);


// Given a node in a partition layout, return an array of all of its ancestor
// nodes, highest first, but excluding the root.
function getAncestors(node) {
  if (!node) return []
  let path = [];
  let current = node;
  while (current.parent) {
    path.unshift(current);
    current = current.parent;
  }

  let root = current

  if (root.name == '/' || root.name.indexOf('/') === -1) {
    path.unshift(root);
  } else {
    path = root.name.split(PATH_DELIMITER).slice(1).map(d => {
      return {
        name: d,
        depth: -1,
        root: true
      }
    }).concat(path)
  }

  return path;
}

// Update the breadcrumb trail to show the current sequence and percentage.
function _updateBreadcrumbs(nodeArray) {

  // Data join; key function combines name and depth (= position in sequence).
  let g = d3
    .select('#bottom_status')
      .selectAll("span")
      .data(nodeArray, function(d) { return d.name + d.depth; });

  // Add breadcrumb and label for entering nodes.
  let entering = g.enter()
    .append('span')
    // .style('-webkit-user-select', 'none')
    .style('-webkit-app-region', 'no-drag')
    .style('cursor', 'pointer')
    .on('click', d => {
      log('navigate', d)
      graphPlugin.navigateTo(keys(d))
    })

  entering.text(function(d) {
    return (nodeArray[0] === d ? '' : ' > ' ) +
      d.name
      // (nodeArray[nodeArray.length - 1] === d ? ' (' + format(d.value) + ')' : '')
  })

  // Remove exiting nodes.
  g.exit().remove();

}