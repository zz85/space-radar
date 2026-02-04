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
    const newHeight = (height * 2) / 3;
    console.log("FlameGraph resize", width, height);
    this.graph.width(width).height(newHeight);
    const svg = document.querySelector(".d3-flame-graph");
    if (svg) {
      svg.setAttribute("width", width);
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
    this.data = root;
    this.draw();
    // Note: zoomTo in v4 takes a hierarchy node directly
    // The node passed here should already be a hierarchy node from the data
  }

  generate(data) {
    console.log("FlameGraph generate");

    // TODO. This may cause hangups!!!
    // partition = d3.layout.partition()
    //   partition
    //     .value(d => d.size)
    //     .sort(namesort) // namesort countsort sizesort

    // computeNodeSize(data)
    // setNodeFilter(data)

    this.data = data;
    this.draw();
  }

  cleanup() {
    this.chart.selectAll("*").remove();
  }
}
