// SpaceRadar View Entry Point for Electrobun
// This runs in the webview context and sets up RPC communication with the Bun main process

import Electrobun, { Electroview } from "electrobun/view";
import type { SpaceRadarRPC } from "./rpc.ts";

// Import D3 modules and expose globally for the existing JS files
import * as d3v3 from "d3";
import * as d3Hierarchy from "d3-hierarchy";
import * as d3Scale from "d3-scale";
import * as d3Selection from "d3-selection";
import * as d3Ease from "d3-ease";
import * as d3Shape from "d3-shape";
// @ts-ignore - d3-flame-graph has global side effects
import { flamegraph as flamegraphFn, defaultFlamegraphTooltip } from "d3-flame-graph";

// Attach tooltip to flamegraph function for backward compatibility
const flamegraphWithTooltip = Object.assign(flamegraphFn, {
  tooltip: { defaultFlamegraphTooltip },
});

// Build combined d3 object (merge d3 v3 with newer modules)
const d3 = Object.assign({}, d3v3, d3Hierarchy, d3Scale, d3Selection, d3Ease);
(window as any).d3 = d3;
(window as any).d3_shape = d3Shape;
(window as any).flamegraph = flamegraphWithTooltip;

// Set up RPC with message handlers for incoming messages from Bun
const rpc = Electroview.defineRPC<SpaceRadarRPC>({
  maxRequestTime: 600000,
  handlers: {
    requests: {},
    messages: {
      scanProgress: (data: any) => {
        if ((window as any)._onScanProgress) {
          (window as any)._onScanProgress(data);
        }
      },
      scanComplete: (data: any) => {
        if ((window as any)._onScanComplete) {
          (window as any)._onScanComplete(data);
        }
      },
      colorChange: (data: any) => {
        if ((window as any)._onColorChange) {
          (window as any)._onColorChange(data);
        }
      },
    },
  },
});

const electrobun = new Electrobun.Electroview({ rpc });

// Expose RPC for the app JS files to make requests to Bun
(window as any)._electrobunRPC = rpc;

// Message handler placeholders - set by radar.js when it loads
(window as any)._onScanProgress = null;
(window as any)._onScanComplete = null;
(window as any)._onColorChange = null;

console.log("SpaceRadar view loaded with Electrobun!");
