/**
 * Scanner Worker
 *
 * Runs the filesystem scanner in a separate Bun Worker thread so the main
 * process event loop stays free for RPC, menu events, and UI callbacks.
 *
 * Communication with the main thread uses postMessage:
 *
 * Main -> Worker:
 *   { type: "scan",   path: string }
 *   { type: "cancel" }
 *   { type: "pause"  }
 *   { type: "resume" }
 *
 * Worker -> Main:
 *   { type: "started" }
 *   { type: "progress", dir, name, size, fileCount, dirCount, errorCount }
 *   { type: "refresh",  data: string }
 *   { type: "complete", data: string, stats: {...} }
 *   { type: "error",    error: string }
 */

import { Scanner } from "./scanner";

let activeScanner: Scanner | null = null;

self.onmessage = (event: MessageEvent) => {
  const msg = event.data;

  switch (msg.type) {
    case "scan": {
      // Cancel any in-progress scan before starting a new one
      if (activeScanner) {
        activeScanner.cancel();
      }

      activeScanner = new Scanner({
        onProgress: (dir, name, size, fileCount, dirCount, errorCount) => {
          self.postMessage({
            type: "progress",
            dir,
            name,
            size,
            fileCount,
            dirCount,
            errorCount,
          });
        },
        onRefresh: (tree) => {
          self.postMessage({
            type: "refresh",
            data: JSON.stringify(tree),
          });
        },
        onComplete: (tree, stats) => {
          self.postMessage({
            type: "complete",
            data: JSON.stringify(tree),
            stats: {
              fileCount: stats.fileCount,
              dirCount: stats.dirCount,
              currentSize: stats.currentSize,
              errorCount: stats.errorCount,
              cancelled: stats.cancelled,
            },
          });
        },
        onError: (error) => {
          self.postMessage({
            type: "error",
            error,
          });
        },
      });

      // Fire-and-forget — progress is reported via postMessage
      activeScanner.scan(msg.path);
      self.postMessage({ type: "started" });
      break;
    }

    case "cancel": {
      if (activeScanner) {
        activeScanner.cancel();
      }
      break;
    }

    case "pause": {
      if (activeScanner) {
        activeScanner.pause();
      }
      break;
    }

    case "resume": {
      if (activeScanner) {
        activeScanner.resume();
      }
      break;
    }
  }
};
