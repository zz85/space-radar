import type { ElectrobunConfig } from "electrobun";

export default {
	app: {
		name: "Space Radar",
		identifier: "com.zz85.space-radar.electrobun",
		version: "0.1.0",
	},
	build: {
		views: {
			mainview: {
				entrypoint: "src/mainview/index.ts",
			},
		},
		copy: {
			"src/mainview/index.html": "views/mainview/index.html",
			"src/mainview/index.css": "views/mainview/index.css",
		},
		mac: {
			bundleCEF: false, // Use system webview for smaller bundle
		},
		linux: {
			bundleCEF: false,
		},
		win: {
			bundleCEF: false,
		},
	},
} satisfies ElectrobunConfig;
