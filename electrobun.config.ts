import type { ElectrobunConfig } from "electrobun";

export default {
	app: {
		name: "SpaceRadar",
		identifier: "com.zz85.spaceradar",
		version: "7.0.0",
	},
	build: {
		bun: {
			entrypoint: "src/bun/index.ts",
		},
		views: {
			mainview: {
				entrypoint: "src/mainview/index.ts",
			},
		},
		copy: {
			"src/mainview/index.html": "views/mainview/index.html",
			"src/mainview/css/photon.css": "views/mainview/css/photon.css",
			"src/mainview/css/d3-flamegraph.css": "views/mainview/css/d3-flamegraph.css",
			"src/mainview/css/style.css": "views/mainview/css/style.css",
			"src/mainview/css/throbber.css": "views/mainview/css/throbber.css",
			"src/mainview/css/breadcrumb.css": "views/mainview/css/breadcrumb.css",
			"src/mainview/vendor/three.min.js": "views/mainview/vendor/three.min.js",
			"src/mainview/fonts/photon-entypo.eot": "views/mainview/fonts/photon-entypo.eot",
			"src/mainview/fonts/photon-entypo.svg": "views/mainview/fonts/photon-entypo.svg",
			"src/mainview/fonts/photon-entypo.ttf": "views/mainview/fonts/photon-entypo.ttf",
			"src/mainview/fonts/photon-entypo.woff": "views/mainview/fonts/photon-entypo.woff",
			"src/mainview/js/utils.js": "views/mainview/js/utils.js",
			"src/mainview/js/mem.js": "views/mainview/js/mem.js",
			"src/mainview/js/graphs.js": "views/mainview/js/graphs.js",
			"src/mainview/js/file_extensions.js": "views/mainview/js/file_extensions.js",
			"src/mainview/js/colors.js": "views/mainview/js/colors.js",
			"src/mainview/js/chart.js": "views/mainview/js/chart.js",
			"src/mainview/js/listview.js": "views/mainview/js/listview.js",
			"src/mainview/js/data.js": "views/mainview/js/data.js",
			"src/mainview/js/sunburst.js": "views/mainview/js/sunburst.js",
			"src/mainview/js/sunburst3d.js": "views/mainview/js/sunburst3d.js",
			"src/mainview/js/treemap.js": "views/mainview/js/treemap.js",
			"src/mainview/js/flamegraph.js": "views/mainview/js/flamegraph.js",
			"src/mainview/js/breadcrumbs.js": "views/mainview/js/breadcrumbs.js",
			"src/mainview/js/router.js": "views/mainview/js/router.js",
			"src/mainview/js/radar.js": "views/mainview/js/radar.js",
		},
		mac: {
			bundleCEF: false,
		},
		linux: {
			bundleCEF: false,
		},
		win: {
			bundleCEF: false,
		},
	},
} satisfies ElectrobunConfig;
