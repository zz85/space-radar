"use strict";

// d3-flame-graph v4 is loaded via script tag as global `flamegraph`
// (see index.html for <script src="node_modules/d3-flame-graph/dist/d3-flamegraph.js">)

function getNodePath(node) {
  const fullname = [];
  while (node.parent) {
    fullname.push(node.data.name);
    node = node.parent;
  }
  fullname.push(node.data.name);

  return fullname.reverse();
}

class FlameGraph extends Chart {
  constructor() {
    super();

    this.chart = d3.select("#flame-chart");

    this.graph = flamegraph()
      .height(400)
      .width(460)
      .cellHeight(20)
      .transitionDuration(350)
      .transitionEase(d3.easeCubic);
    // .sort(true)
    //.sort(function(a,b){ return d3.descending(a.name, b.name);})
    // .title('')

    // Use the new d3-flame-graph tooltip API (v4)
    var tip = flamegraph.tooltip.defaultFlamegraphTooltip().text(d => {
      const fullpath = getNodePath(d).join("/");
      // short name = d.data.name
      return (
        fullpath +
        " - " +
        format(d.data.value) +
        " " +
        `(${((d.data.value / this.data.value) * 100).toFixed(2)}%)`
      );
    });

    this.graph.tooltip(tip).onClick(e => {
      if (e) {
        const movingTo = getNodePath(e).join("/");
        const route = Navigation.currentPath().join("/");
        console.log("click captured", e);
        if (route !== movingTo) {
          console.log("movingTo", movingTo, route);
        }
        this.currentPath = movingTo;
        State.navigateTo(getNodePath(e));
      }
    });
  }

  resize() {
    // Ensure we have valid dimensions
    const w = width || window.innerWidth;
    const h = height || window.innerHeight - 200;
    const newHeight = (h * 2) / 3;
    console.log("FlameGraph resize", w, h);
    this.graph.width(w).height(newHeight);
    const svg = document.querySelector(".d3-flame-graph");
    if (svg) {
      svg.setAttribute("width", w);
      svg.setAttribute("height", newHeight);
    }
    this.draw();
  }

  draw() {
    if (!this.data) return;
    console.log("FlameGraph draw");

    this.chart.datum(this.data).call(this.graph);
  }

  navigateTo(path, node, root) {
    if (path.join("/") === this.currentPath) return console.log("abort draw");
    console.log("FlameGraph navigateTo");
    // Don't redraw on navigation - flamegraph handles its own zoom
    // this.data = root;
    // this.draw();
  }

  generate(data) {
    console.log("FlameGraph generate");

    // Preprocess data to ensure 'value' is set for d3-flame-graph
    // d3-flame-graph expects each node to have a 'value' property
    function computeValue(node) {
      if (node.children && node.children.length > 0) {
        let sum = 0;
        for (const child of node.children) {
          sum += computeValue(child);
        }
        node.value = sum;
        return sum;
      } else {
        // Leaf node - use size or default to 0
        node.value = node.size || 0;
        return node.value;
      }
    }

    // Clone data to avoid mutating the original
    const clonedData = JSON.parse(JSON.stringify(data));
    computeValue(clonedData);

    // Filter out very small nodes to prevent memory issues with large trees
    const THRESHOLD = 0.001; // 0.1% of total
    const totalValue = clonedData.value || 1;

    function filterSmallNodes(node) {
      if (node.children) {
        node.children = node.children
          .filter(child => child.value / totalValue >= THRESHOLD)
          .map(filterSmallNodes);
      }
      return node;
    }

    filterSmallNodes(clonedData);

    this.data = clonedData;
    this.draw();
  }

  cleanup() {
    this.chart.selectAll("*").remove();
  }
}
