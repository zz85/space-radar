import * as d3Base from "d3";
import * as d3Hierarchy from "d3-hierarchy";
import * as d3Scale from "d3-scale";
import * as d3Selection from "d3-selection";
import * as d3Tip from "d3-tip";
import * as d3Ease from "d3-ease";
import { Electroview } from "electrobun/view";

const detectPlatform = () => {
  const platform = (navigator.platform || navigator.userAgent || "").toLowerCase();
  if (platform.includes("win")) return "win32";
  if (platform.includes("mac")) return "darwin";
  if (platform.includes("linux")) return "linux";
  return "linux";
};

globalThis.process = {
  platform: detectPlatform(),
  env: {},
  versions: {},
};

globalThis.global = globalThis;

globalThis.d3 = Object.assign(
  d3Base,
  d3Hierarchy,
  d3Scale,
  d3Selection,
  d3Tip,
  d3Ease,
);

const flamegraphModule = await import("d3-flame-graph");
const flamegraph =
  flamegraphModule.default || flamegraphModule.flamegraph || flamegraphModule;
if (flamegraphModule.tooltip && !flamegraph.tooltip) {
  flamegraph.tooltip = flamegraphModule.tooltip;
}
globalThis.flamegraph = flamegraph;

const threeModule = await import("../vendor/three.min.js");
globalThis.THREE =
  threeModule.default || threeModule.THREE || threeModule || globalThis.THREE;

const createEmitter = () => {
  const listeners = new Map();
  return {
    on(event, handler) {
      const handlers = listeners.get(event) || [];
      handlers.push(handler);
      listeners.set(event, handlers);
    },
    emit(event, ...args) {
      const handlers = listeners.get(event) || [];
      handlers.forEach((handler) => handler(...args));
    },
  };
};

const emitter = createEmitter();

const rpc = Electroview.defineRPC({
  handlers: {
    requests: {},
    messages: {
      scanEvent: ({ cmd, args }) => {
        if (globalThis.handleIPC) {
          globalThis.handleIPC(cmd, args);
        }
      },
      colorChange: ({ type, value }) => {
        emitter.emit("color-change", null, { type, value });
      },
      contextMenuAction: ({ action }) => {
        emitter.emit("context-menu-action", null, action);
      },
    },
  },
});

globalThis.__spaceRadarRpc = rpc;
globalThis.__spaceRadarEmitter = emitter;

globalThis.mem = (callback) => {
  rpc.request
    .getMemorySnapshot({})
    .then((data) => callback(null, data))
    .catch((error) => callback(error));
};

globalThis.si = {
  fsSize: () => rpc.request.getDiskInfo({}),
};

new Electroview({ rpc });

await import("../js/utils.js");
await import("../js/graphs.js");
await import("../js/file_extensions.js");
await import("../js/colors.js");
await import("../js/chart.js");
await import("../js/listview.js");
await import("../js/data.js");
await import("../js/sunburst.js");
await import("../js/sunburst3d.js");
await import("../js/treemap.js");
await import("../js/flamegraph.js");
await import("../js/radar.js");
await import("../js/breadcrumbs.js");
await import("../js/router.js");
