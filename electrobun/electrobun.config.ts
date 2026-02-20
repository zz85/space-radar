export default {
  app: {
    name: "Space Radar",
    identifier: "com.zz85.spaceradar",
    version: "7.0.0",
  },
  build: {
    bun: {
      entrypoint: "src/bun/index.ts",
      external: [],
    },
    views: {
      mainview: {
        entrypoint: "src/mainview/index.ts",
        external: [],
      },
    },
    copy: {
      "src/mainview/index.html": "views/mainview/index.html",
      "src/mainview/style.css": "views/mainview/style.css",
    },
  },
};
