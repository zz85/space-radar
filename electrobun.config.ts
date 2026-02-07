export default {
  app: {
    name: "SpaceRadar",
    identifier: "com.zz85.spaceradar",
    version: "6.0.0",
  },
  build: {
    bun: {
      entrypoint: "app/bun/index.ts",
      external: [],
    },
    views: {
      mainview: {
        entrypoint: "app/mainview/index.ts",
        external: [],
      },
    },
    copy: {
      "app/index.html": "views/mainview/index.html",
      "app/css": "views/mainview/css",
      "node_modules/photonkit/dist/css/photon.css":
        "views/mainview/vendor/photon.css",
      "node_modules/d3-flame-graph/dist/d3-flamegraph.css":
        "views/mainview/vendor/d3-flamegraph.css",
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
};
