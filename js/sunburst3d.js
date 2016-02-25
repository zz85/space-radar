// Based on http://bl.ocks.org/mbostock/8bee9cf362d56d9cb19f/507166861adc3d52038ba43c934e6073937eb13c

d3_shape = require('d3-shape');

(() => {
'use strict'

var inited = false;

var material, scene, chart, arc;
var canvas3d

function init3d() {

	if (inited) return;
	inited = true;

	var width = 960,
	    height = 500;

	width = window.innerWidth;
	height = window.innerHeight - document.querySelector('header').getBoundingClientRect().height - document.querySelector('footer').getBoundingClientRect().height;


  // material = new THREE.MeshNormalMaterial({transparent: true, opacity: 0.9});

  material = new THREE.MeshLambertMaterial({color: Math.random() * 0xffffff, opacity: 0.9});
	scene = new THREE.Scene;

	chart = new THREE.Object3D();
	scene.add(chart);

	arc = d3_shape.arc()

	canvas3d = document.getElementById('three-canvas');

	var renderer = new THREE.WebGLRenderer({
		canvas: canvas3d
	});
	renderer.setClearColor(new THREE.Color("#fff", 1.0));
	renderer.setSize(width, height);

	var camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
	camera.position.x = 250;
	camera.position.y = 100;
	camera.position.z = 100;
	camera.lookAt(new THREE.Vector3(20, 15, 0));

	function animate(elapsed) {
		chart.rotation.y = elapsed / 1600;
		chart.rotation.z = elapsed / 2300;
	  renderer.render(scene, camera);

	  requestAnimationFrame(animate);
	};

	animate();

	var light = new THREE.PointLight( 0xffffff, 0.8 );
	light.position.z = -100;
	scene.add( light );

	var light = new THREE.PointLight( 0xffffff, 0.8 );
	light.position.y = 60;
	scene.add( light );

	var light = new THREE.PointLight( 0xffffff, 1 );
	light.position.z = 0;
	camera.add( light );

}


function plot3d(data) {

	setTimeout( () => {
		canvas3d.style.display = 'block';
	}, 2000)

	var c;
	// while (c = scene.children[0]) scene.remove(c)


	var extrudeOptions = {
	  amount: 1,
	  bevelSize: 0,
	  bevelSegments: 1,
	  bevelEnabled: true,
	  curveSegments: 50,
	  steps: 1
	};

	console.log('PLOTTING ', data)

	data.forEach(function(d) {
		if (d.depth < 1) return;
		var a = d.x;
		var b = d.x + d.dx;
		var s = Math.min(a, b);
		var t = Math.max(a, b);

		var THICKNESS = 20;
		var RADIUS = 200;
		var HOLE = 20;

		var r = d.depth * THICKNESS + HOLE;

		arc.innerRadius(r) //
    .outerRadius(r + THICKNESS) // RADIUS - for cake like
    .cornerRadius(0)
    .padAngle(0.01);

	  var path = new THREE.Shape;

	  arc.context({
	    moveTo: function(x, y) { path.moveTo(x, y); },
	    lineTo: function(x, y) { path.lineTo(x, y); },
	    arc: function(x, y, r, a0, a1, ccw) {
	    	// path.absarc(x, y, r, a0, a1, ccw);
	      var a;
	      if (ccw) a = a1, a1 = a0, a0 = a; // Uh, what?
	      path.absarc(x, y, r, a0, a1, !ccw);
	    },
	    closePath: function() { path.closePath(); }
	  })({
			startAngle: s,
			endAngle: t
		});

		if (path.curves.length < 3) return;

	  // var shape = THREE.SceneUtils.createMultiMaterialObject(path.extrude(extrudeOptions), [material]);

	  var shape = new THREE.Mesh(path.extrude(extrudeOptions), material);
	  shape.position.z = d.depth * -10;
	  chart.add(shape);
	});

}

	window.plot3d = plot3d;
	init3d();

})()
