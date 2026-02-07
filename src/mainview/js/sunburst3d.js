// Based on http://bl.ocks.org/mbostock/8bee9cf362d56d9cb19f/507166861adc3d52038ba43c934e6073937eb13c

// d3_shape is loaded globally by the bundled index.ts
var d3_shape = window.d3_shape || {};

window.RENDER_3D = false;
(() => {
  "use strict";

  var inited = false;
  var animationId = null;

  var material, scene, chart;
  var canvas3d;
  var renderer, camera;

  function init3d() {
    if (inited) return;
    inited = true;

    var width = 960,
      height = 500;

    width = window.innerWidth;
    height =
      window.innerHeight -
      document.querySelector("header").getBoundingClientRect().height -
      document.querySelector("footer").getBoundingClientRect().height;

    material = new THREE.MeshLambertMaterial({
      color: Math.random() * 0xffffff,
      opacity: 0.9,
    });
    scene = new THREE.Scene();

    chart = new THREE.Object3D();
    scene.add(chart);

    canvas3d = document.getElementById("three-canvas");
    if (!canvas3d) {
      console.error("[sunburst3d] Canvas element not found");
      return;
    }

    renderer = new THREE.WebGLRenderer({
      canvas: canvas3d,
    });
    renderer.setClearColor(new THREE.Color("#fff", 1.0));
    renderer.setSize(width, height);

    camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.x = 250;
    camera.position.y = 100;
    camera.position.z = 100;
    camera.lookAt(new THREE.Vector3(20, 15, 0));

    function animate(elapsed) {
      if (!window.RENDER_3D) {
        animationId = null;
        return;
      }
      chart.rotation.y = elapsed / 1600;
      chart.rotation.z = elapsed / 2300;
      renderer.render(scene, camera);

      animationId = requestAnimationFrame(animate);
    }

    animationId = requestAnimationFrame(animate);

    var light = new THREE.PointLight(0xffffff, 0.8);
    light.position.z = -100;
    scene.add(light);

    var light2 = new THREE.PointLight(0xffffff, 0.8);
    light2.position.y = 60;
    scene.add(light2);

    var light3 = new THREE.PointLight(0xffffff, 1);
    light3.position.z = 0;
    camera.add(light3);
  }

  function plot3d(data) {
    if (!canvas3d) {
      canvas3d = document.getElementById("three-canvas");
    }

    setTimeout(() => {
      if (canvas3d) canvas3d.style.display = "block";
    }, 2000);

    var extrudeOptions = {
      amount: 1,
      bevelSize: 0,
      bevelSegments: 1,
      bevelEnabled: true,
      curveSegments: 50,
      steps: 1,
    };

    console.log("PLOTTING 3D", data.length, "nodes");

    data.forEach(function (d) {
      if (d.depth < 1) return;

      var startAngle = d.x;
      var endAngle = d.x + d.dx;

      var THICKNESS = 20;
      var HOLE = 20;

      var innerR = d.depth * THICKNESS + HOLE;
      var outerR = innerR + THICKNESS;

      // Create a new arc generator for this segment
      var segmentArc = d3_shape
        .arc()
        .innerRadius(innerR)
        .outerRadius(outerR)
        .cornerRadius(0)
        .padAngle(0.01);

      var path = new THREE.Shape();

      // Set up context for drawing to THREE.Shape
      segmentArc.context({
        moveTo: function (x, y) {
          path.moveTo(x, y);
        },
        lineTo: function (x, y) {
          path.lineTo(x, y);
        },
        arc: function (x, y, r, a0, a1, ccw) {
          var a;
          if (ccw) {
            a = a1;
            a1 = a0;
            a0 = a;
          }
          path.absarc(x, y, r, a0, a1, !ccw);
        },
        closePath: function () {
          path.closePath();
        },
      });

      // Draw the arc with the angle data
      segmentArc({
        startAngle: startAngle,
        endAngle: endAngle,
      });

      if (path.curves.length < 3) return;

      var shape = new THREE.Mesh(path.extrude(extrudeOptions), material);
      shape.position.z = d.depth * -10;
      chart.add(shape);
    });
  }

  // Toggle 3D mode on/off
  window.toggle3D = function (enabled) {
    window.RENDER_3D = enabled;

    if (enabled) {
      init3d();
      // Start animation if it was stopped
      if (!animationId && renderer && camera) {
        function animate(elapsed) {
          if (!window.RENDER_3D) {
            animationId = null;
            return;
          }
          chart.rotation.y = elapsed / 1600;
          chart.rotation.z = elapsed / 2300;
          renderer.render(scene, camera);
          animationId = requestAnimationFrame(animate);
        }
        animationId = requestAnimationFrame(animate);
      }
      // Re-render if data is loaded
      if (window.PluginManager && window.PluginManager.data) {
        // Clear existing meshes from chart
        while (chart.children.length > 0) {
          chart.remove(chart.children[0]);
        }
        // Re-plot with current data
        var nodes = partition.nodes(window.PluginManager.data);
        plot3d(nodes);
      }
      if (canvas3d) {
        canvas3d.style.display = "block";
      }
    } else {
      // Stop animation
      if (animationId) {
        cancelAnimationFrame(animationId);
        animationId = null;
      }
      if (canvas3d) {
        canvas3d.style.display = "none";
      }
    }
  };

  window.plot3d = plot3d;
  window.init3d = init3d;

  if (RENDER_3D) init3d();
})();
