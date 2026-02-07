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
import { flamegraph } from "d3-flame-graph";

// Build combined d3 object (merge d3 v3 with newer modules)
const d3 = Object.assign({}, d3v3, d3Hierarchy, d3Scale, d3Selection, d3Ease);
(window as any).d3 = d3;
(window as any).d3_shape = d3Shape;
(window as any).flamegraph = flamegraph;

// Set up RPC
const rpc = Electroview.defineRPC<SpaceRadarRPC>({
  maxRequestTime: 600000,
  handlers: {
    requests: {},
    messages: {},
  },
});

const electrobun = new Electrobun.Electroview({ rpc });

// ============================================================================
// Bridge: Expose RPC methods as globals for the existing JS files
// ============================================================================

// The existing JS files use globals like sendIpcMsg, scanFolder, etc.
// We create bridge functions that route through RPC

(window as any)._electrobunRPC = electrobun.rpc;

// RPC message handlers from Bun -> View
// These will be connected after the app scripts load
(window as any)._onScanProgress = null;
(window as any)._onScanComplete = null;
(window as any)._onColorChange = null;

// Listen for messages from Bun main process
if (electrobun.rpc) {
  const rpcAny = electrobun.rpc as any;

  // Register message handlers that forward to the app
  if (rpcAny.on) {
    rpcAny.on("scanProgress", (data: any) => {
      if ((window as any)._onScanProgress) {
        (window as any)._onScanProgress(data);
      }
    });

    rpcAny.on("scanComplete", (data: any) => {
      if ((window as any)._onScanComplete) {
        (window as any)._onScanComplete(data);
      }
    });

    rpcAny.on("colorChange", (data: any) => {
      if ((window as any)._onColorChange) {
        (window as any)._onColorChange(data);
      }
    });
  }
}

console.log("SpaceRadar view loaded with Electrobun!");
