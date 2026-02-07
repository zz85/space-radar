"use strict";
// Memory usage - browser-compatible stub for Electrobun
// Memory scanning requires Node.js APIs not available in the webview
// In the future, this could be implemented via RPC to the Bun process

function mem(callback) {
  // Memory scanning not available in webview
  callback(new Error("Memory scanning is not yet available in Electrobun mode"));
}
