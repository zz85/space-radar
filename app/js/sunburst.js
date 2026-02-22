"use strict";

/**
 * Canvas-based Sunburst visualization
 * Replaces SVG implementation for better performance
 */
function SunBurst() {
  // ============== Configuration ==============
  var LEVELS = 11;
  var INNER_LEVEL = 7;
  var USE_COUNT = 0;
  var ANIMATION_DURATION = 300;

  // ============== State ==============
  var rootNode = null;
  var currentNode = null;
  var hoveredNode = null;
  var canvas, ctx;
  var width, height, centerX, centerY;
  var radius, CORE_RADIUS, OUTER_RADIUS, FLEXI_LEVEL;

  // Flat array of visible nodes for rendering
  var visibleNodes = [];

  // Animation state
  var animationStart = null;
  var isAnimating = false;

  // RAF task for rendering
  var drawer = new TimeoutRAFTask(draw);

  // DOM references for center display
  var core_top, core_center, core_tag;

  // ============== Initialization ==============
  function init() {
    canvas = document.getElementById("sunburst-canvas");
    if (!canvas) {
      console.error("[sunburst] Canvas element not found");
      return;
    }
    ctx = canvas.getContext("2d");

    core_top = document.getElementById("core_top");
    core_center = document.getElementById("core_center");
    core_tag = document.getElementById("core_tag");

    // Event listeners on canvas
    canvas.addEventListener("mousemove", onMouseMove);
    canvas.addEventListener("mouseout", onMouseOut);
    canvas.addEventListener("click", onClick);

    // Click on explanation div also zooms out
    var explanation = document.getElementById("explanation");
    if (explanation) {
      explanation.addEventListener("click", function () {
        if (currentNode && currentNode.parent) {
          State.navigateTo(keys(currentNode.parent));
        }
      });
    }

    calcDimensions();
  }

  function calcDimensions() {
    var header = document.querySelector("header");
    var footer = document.querySelector("footer");

    width = window.innerWidth;
    height =
      window.innerHeight -
      (header ? header.getBoundingClientRect().height : 0) -
      (footer ? footer.getBoundingClientRect().height : 0);

    var dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = width + "px";
    canvas.style.height = height + "px";

    centerX = width / 2;
    centerY = height / 2;

    var len = Math.min(width, height);
    radius = len * 0.45;
    CORE_RADIUS = radius * 0.4;
    OUTER_RADIUS = radius - CORE_RADIUS;
    FLEXI_LEVEL = Math.min(LEVELS, INNER_LEVEL);
  }

  // ============== Drawing ==============
  function draw(next) {
    if (!canvas || !ctx) return;

    var dpr = window.devicePixelRatio || 1;
    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);

    // Update animation progress
    var t = 1;
    if (isAnimating && animationStart) {
      var elapsed = Date.now() - animationStart;
      t = Math.min(elapsed / ANIMATION_DURATION, 1);
      t = easeOutCubic(t);
      if (t >= 1) {
        isAnimating = false;
        animationStart = null;
      }
    }

    // Draw arcs (already sorted by depth, back to front)
    for (var i = 0; i < visibleNodes.length; i++) {
      var node = visibleNodes[i];
      drawArc(node, t);
    }

    // Draw center circle
    drawCenter();

    ctx.restore();

    // Continue animation if needed
    if (isAnimating) {
      next();
    }
  }

  function drawArc(node, t) {
    var d = node.data;

    // Interpolate if animating
    var startAngle = lerp(node.fromStartAngle, node.startAngle, t);
    var endAngle = lerp(node.fromEndAngle, node.endAngle, t);
    var innerR = lerp(node.fromInnerR, node.innerR, t);
    var outerR = lerp(node.fromOuterR, node.outerR, t);

    // Skip if arc is too small
    if (endAngle - startAngle < 0.002) return;
    if (outerR - innerR < 1) return;

    ctx.beginPath();
    ctx.arc(centerX, centerY, outerR, startAngle, endAngle);
    ctx.arc(centerX, centerY, innerR, endAngle, startAngle, true);
    ctx.closePath();

    // Get fill color - special handling for free space
    var color;
    if (d._isFreeSpace) {
      // Light gray for free space to distinguish from used space
      color = "#e8e8e8";
    } else {
      color = fill(d);
    }

    if (color && typeof color.toString === "function") {
      ctx.fillStyle = color.toString();
    } else if (color) {
      ctx.fillStyle = color;
    } else {
      ctx.fillStyle = "#888";
    }

    // Hover effect - dim non-related segments
    if (hoveredNode) {
      if (isAncestorOrDescendant(d, hoveredNode)) {
        ctx.globalAlpha = 1;
      } else {
        ctx.globalAlpha = 0.3;
      }
    } else {
      ctx.globalAlpha = 0.85;
    }

    ctx.fill();

    // Stroke
    ctx.globalAlpha = 0.6;
    ctx.strokeStyle = "#c8c8c8";
    ctx.lineWidth = Math.max(0.25, 1.0 - (d.depth - currentNode.depth) * 0.08);
    ctx.stroke();

    ctx.globalAlpha = 1;
  }

  function drawCenter() {
    ctx.beginPath();
    ctx.arc(centerX, centerY, CORE_RADIUS, 0, Math.PI * 2);

    if (hoveredNode) {
      ctx.fillStyle = "rgba(238, 238, 238, 0.5)";
    } else {
      ctx.fillStyle = "rgba(238, 238, 238, 0.2)";
    }
    ctx.fill();

    // Light border
    ctx.strokeStyle = "#ddd";
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // ============== Hit Testing ==============
  function hitTest(mouseX, mouseY) {
    var dx = mouseX - centerX;
    var dy = mouseY - centerY;
    var distance = Math.sqrt(dx * dx + dy * dy);

    // Angle from positive x-axis, but we need to adjust for our rotation
    var angle = Math.atan2(dy, dx);

    // Check center circle first
    if (distance <= CORE_RADIUS) {
      return { type: "center", node: currentNode };
    }

    // Check arcs from front to back (reverse order for proper hit detection)
    for (var i = visibleNodes.length - 1; i >= 0; i--) {
      var node = visibleNodes[i];

      // Check if distance is within this ring
      if (distance >= node.innerR && distance <= node.outerR) {
        // Normalize angles to compare
        var nodeStart = normalizeAngle(node.startAngle);
        var nodeEnd = normalizeAngle(node.endAngle);
        var testAngle = normalizeAngle(angle);

        // Handle wrap-around case
        var inArc = false;
        if (nodeStart <= nodeEnd) {
          inArc = testAngle >= nodeStart && testAngle <= nodeEnd;
        } else {
          // Arc wraps around 0
          inArc = testAngle >= nodeStart || testAngle <= nodeEnd;
        }

        if (inArc) {
          return { type: "arc", node: node.data };
        }
      }
    }

    return null;
  }

  function normalizeAngle(angle) {
    while (angle < 0) angle += Math.PI * 2;
    while (angle >= Math.PI * 2) angle -= Math.PI * 2;
    return angle;
  }

  // ============== Event Handlers ==============
  function onMouseMove(e) {
    if (!currentNode) return;

    var rect = canvas.getBoundingClientRect();
    var mouseX = e.clientX - rect.left;
    var mouseY = e.clientY - rect.top;

    var hit = hitTest(mouseX, mouseY);
    var newHovered = hit ? hit.node : null;

    if (newHovered !== hoveredNode) {
      hoveredNode = newHovered;
      if (hoveredNode) {
        updateCore(hoveredNode);
        State.highlightPath(keys(hoveredNode));
      } else {
        if (currentNode) updateCore(currentNode);
        State.highlightPath();
      }
      scheduleDraw();
    }
  }

  function onMouseOut() {
    if (hoveredNode) {
      hoveredNode = null;
      if (currentNode) updateCore(currentNode);
      State.highlightPath();
      scheduleDraw();
    }
  }

  function onClick(e) {
    if (!currentNode) return;

    var rect = canvas.getBoundingClientRect();
    var mouseX = e.clientX - rect.left;
    var mouseY = e.clientY - rect.top;

    var hit = hitTest(mouseX, mouseY);
    if (!hit) return;

    if (hit.type === "center") {
      // Zoom out
      if (currentNode && currentNode.parent) {
        State.navigateTo(keys(currentNode.parent));
      }
    } else if (hit.type === "arc") {
      // Zoom in
      var node = hit.node;

      // Prevent zooming into "Other files" or "Free Space" synthetic nodes
      if (node._isOtherFiles || node._isFreeSpace) return;

      // If clicking on depth > 1, zoom to parent instead
      if (node.depth - currentNode.depth > 1) {
        node = node.parent;
      }

      if (node && (node._children || node.children)) {
        State.navigateTo(keys(node));
      }
    }
  }

  // ============== Core Display ==============
  function updateCore(d) {
    if (!d) return;

    var baseNode = currentNode || rootNode;
    var percent = baseNode
      ? ((d.sum / baseNode.sum) * 100).toFixed(2) + "%"
      : "";

    if (core_top) core_top.innerHTML = d.name || "";
    if (core_center)
      core_center.innerHTML = format(d.sum).split(" ").join("<br/>");
    if (core_tag) core_tag.innerHTML = percent + "<br/>";
  }

  // ============== Navigation ==============
  function navigateTo(targetKeys) {
    if (!rootNode) return;
    var targetNode = getNodeFromPath(targetKeys, rootNode);
    if (targetNode) {
      zoom(targetNode);
    }
  }

  function zoom(node) {
    if (!node) return;

    // Save current state for animation
    var oldNodes = visibleNodes.slice();
    var oldNodeMap = new Map();
    oldNodes.forEach(function (n) {
      oldNodeMap.set(key(n.data), n);
    });

    currentNode = node;
    updateCore(node);

    // Compute new layout
    computeVisibleNodes(node);

    // Setup animation interpolation
    visibleNodes.forEach(function (n) {
      var k = key(n.data);
      var old = oldNodeMap.get(k);
      if (old) {
        // Existing node - animate from old position
        n.fromStartAngle = old.startAngle;
        n.fromEndAngle = old.endAngle;
        n.fromInnerR = old.innerR;
        n.fromOuterR = old.outerR;
      } else {
        // New node - animate from center/collapsed state
        var midAngle = (n.startAngle + n.endAngle) / 2;
        n.fromStartAngle = midAngle;
        n.fromEndAngle = midAngle;
        n.fromInnerR = CORE_RADIUS;
        n.fromOuterR = CORE_RADIUS;
      }
    });

    isAnimating = true;
    animationStart = Date.now();

    scheduleDraw();
  }

  function computeVisibleNodes(node) {
    if (!node) return;

    // Use d3 partition to compute layout
    setNodeFilter(node);
    var nodes = partition.nodes(node).slice(1); // skip root (the current node itself)

    // Calculate max depth for FLEXI_LEVEL
    var maxDepth = 0;
    nodes.forEach(function (n) {
      var relativeDepth = n.depth - node.depth;
      if (relativeDepth > maxDepth) maxDepth = relativeDepth;
    });

    FLEXI_LEVEL = Math.min(LEVELS, INNER_LEVEL, maxDepth);
    if (FLEXI_LEVEL < 1) FLEXI_LEVEL = 1;

    // Convert to render format
    visibleNodes = [];
    var ADJUSTMENT = -Math.PI / 2; // Rotate so 0 degrees is at top

    nodes.forEach(function (d) {
      var relativeDepth = d.depth - node.depth;

      // Skip nodes beyond visible depth
      if (relativeDepth > LEVELS || relativeDepth < 1) return;

      var innerR =
        CORE_RADIUS + (OUTER_RADIUS / FLEXI_LEVEL) * (relativeDepth - 1);
      var outerR =
        CORE_RADIUS + (OUTER_RADIUS / FLEXI_LEVEL) * relativeDepth - 1;

      // Ensure valid radii
      if (innerR < 0) innerR = 0;
      if (outerR <= innerR) return;

      // Skip arcs too small to draw — their angular span is less than the
      // 0.005-radian gap subtracted below, which would invert startAngle
      // and endAngle. The hitTest wrap-around logic then matches nearly
      // every angle, stealing clicks from real arcs.
      if (d.dx < 0.005) return;

      visibleNodes.push({
        data: d,
        startAngle: d.x + ADJUSTMENT,
        endAngle: d.x + d.dx + ADJUSTMENT - 0.005, // small gap between segments
        innerR: innerR,
        outerR: outerR,
        // Animation from values (set later)
        fromStartAngle: d.x + ADJUSTMENT,
        fromEndAngle: d.x + d.dx + ADJUSTMENT - 0.005,
        fromInnerR: innerR,
        fromOuterR: outerR,
      });
    });

    // Sort by depth (back to front) for proper rendering
    visibleNodes.sort(function (a, b) {
      return a.data.depth - b.data.depth;
    });
  }

  // ============== Generate ==============
  function generateSunburst(root) {
    rootNode = root;
    currentNode = root;

    partition = d3.layout.partition();

    partition
      .value(function (d) {
        return d.size;
      })
      .sort(namesort)
      .size([2 * Math.PI, radius]);

    computeNodeCount(root);
    computeNodeSize(root);

    console.time("color");
    colorByTypes(root);
    console.timeEnd("color");

    console.log("Root count", root.count, "ROOT size", format(root.value));

    // Set up node filter with sum values
    setNodeFilter(root).value(function (d) {
      return USE_COUNT ? d.count : d.sum;
    });

    // Compute initial visible nodes
    computeVisibleNodes(root);
    updateCore(root);

    // No animation on initial load - set from = to
    visibleNodes.forEach(function (n) {
      n.fromStartAngle = n.startAngle;
      n.fromEndAngle = n.endAngle;
      n.fromInnerR = n.innerR;
      n.fromOuterR = n.outerR;
    });

    // Render 3D if enabled
    if (RENDER_3D) {
      plot3d(partition.nodes(root));
    }

    scheduleDraw();
  }

  // ============== Utilities ==============
  function scheduleDraw() {
    drawer.run();
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  function isAncestorOrDescendant(a, b) {
    if (!a || !b) return false;

    // Check if a is ancestor of b
    var node = b;
    while (node) {
      if (node === a) return true;
      node = node.parent;
    }

    // Check if b is ancestor of a
    node = a;
    while (node) {
      if (node === b) return true;
      node = node.parent;
    }

    return false;
  }

  // ============== Initialize ==============
  init();

  // ============== Plugin Interface ==============
  return {
    resize: function () {
      calcDimensions();
      if (currentNode) {
        computeVisibleNodes(currentNode);
        // No animation on resize
        visibleNodes.forEach(function (n) {
          n.fromStartAngle = n.startAngle;
          n.fromEndAngle = n.endAngle;
          n.fromInnerR = n.innerR;
          n.fromOuterR = n.outerR;
        });
        scheduleDraw();
      }
    },

    generate: generateSunburst,

    showMore: function () {
      LEVELS++;
      if (currentNode) {
        computeVisibleNodes(currentNode);
        visibleNodes.forEach(function (n) {
          n.fromStartAngle = n.startAngle;
          n.fromEndAngle = n.endAngle;
          n.fromInnerR = n.innerR;
          n.fromOuterR = n.outerR;
        });
        scheduleDraw();
      }
    },

    showLess: function () {
      if (LEVELS <= 1) return;
      LEVELS--;
      if (currentNode) {
        computeVisibleNodes(currentNode);
        visibleNodes.forEach(function (n) {
          n.fromStartAngle = n.startAngle;
          n.fromEndAngle = n.endAngle;
          n.fromInnerR = n.innerR;
          n.fromOuterR = n.outerR;
        });
        scheduleDraw();
      }
    },

    cleanup: function () {
      rootNode = null;
      currentNode = null;
      hoveredNode = null;
      visibleNodes = [];
      if (ctx) {
        var dpr = window.devicePixelRatio || 1;
        ctx.save();
        ctx.scale(dpr, dpr);
        ctx.clearRect(0, 0, width, height);
        ctx.restore();
      }
    },

    navigateTo: function (targetKeys) {
      if (!rootNode) return;
      var n = getNodeFromPath(targetKeys, rootNode);
      if (n) {
        zoom(n);
      }
    },

    highlightPath: function (path, node) {
      var newHovered = node || null;
      if (newHovered !== hoveredNode) {
        hoveredNode = newHovered;
        if (hoveredNode) {
          updateCore(hoveredNode);
        } else if (currentNode) {
          updateCore(currentNode);
        }
        scheduleDraw();
      }
    },
  };
}
