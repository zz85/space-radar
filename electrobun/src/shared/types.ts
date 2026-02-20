/**
 * Shared RPC type definitions for Space Radar Electrobun
 *
 * Defines the typed contract between the Bun main process and the WebView renderer.
 * Replaces the 4 separate IPC mechanisms from the Electron version:
 *   1. Electron ipcMain/ipcRenderer
 *   2. localStorage cross-window hack
 *   3. Temp file compressed IPC
 *   4. webContents.send
 *
 * All of these are now unified into Electrobun's typed RPC system.
 */

export type RPCSchema<T> = T;

export type SpaceRadarRPC = {
  /** Functions that execute in the Bun main process, callable from the webview */
  bun: RPCSchema<{
    requests: {
      /** Open a native folder picker dialog */
      selectFolder: {
        params: {
          startingFolder?: string;
        };
        response: string | null;
      };
      /** Start scanning a directory path */
      scanDirectory: {
        params: {
          path: string;
        };
        response: { started: boolean; error?: string };
      };
      /** Cancel the current scan */
      cancelScan: {
        params: {};
        response: void;
      };
      /** Pause the current scan */
      pauseScan: {
        params: {};
        response: void;
      };
      /** Resume the current scan */
      resumeScan: {
        params: {};
        response: void;
      };
      /** Show a file/folder in the system file manager */
      showItemInFolder: {
        params: {
          path: string;
        };
        response: void;
      };
      /** Move a file/folder to the system trash */
      moveToTrash: {
        params: {
          path: string;
        };
        response: boolean;
      };
      /** Open a new app window */
      openNewWindow: {
        params: {};
        response: void;
      };
      /** Get disk space info for a path */
      getDiskInfo: {
        params: {
          path: string;
        };
        response: {
          total: number;
          used: number;
          available: number;
          usePercent: number;
        } | null;
      };
      /** Load last saved scan data */
      loadLastScan: {
        params: {};
        response: string | null; // JSON string of tree data
      };
      /** Save scan data for persistence */
      saveScanData: {
        params: {
          data: string; // JSON string of tree data
        };
        response: void;
      };
      /** Show a native context menu */
      showContextMenu: {
        params: {
          items: Array<{
            label: string;
            action: string;
            enabled?: boolean;
          }>;
        };
        response: void;
      };
      /** Scan memory usage (process tree) */
      scanMemory: {
        params: {};
        response: string | null; // JSON string of memory tree
      };
    };
    messages: {
      /** Generic log message from webview to bun */
      logToBun: {
        msg: string;
      };
    };
  }>;
  /** Functions that execute in the WebView, callable from Bun */
  webview: RPCSchema<{
    requests: {};
    messages: {
      /** Scan progress update */
      scanProgress: {
        dir: string;
        name: string;
        size: number;
        fileCount: number;
        dirCount: number;
        errorCount: number;
      };
      /** Scan refresh (intermediate preview of data) */
      scanRefresh: {
        data: string; // JSON tree data
      };
      /** Scan completed */
      scanComplete: {
        data: string; // JSON tree data
        stats: {
          fileCount: number;
          dirCount: number;
          currentSize: number;
          errorCount: number;
          cancelled: boolean;
        };
      };
      /** Scan error */
      scanError: {
        error: string;
      };
      /** Color/mode change from application menu */
      colorChange: {
        type: string;
        value: string;
      };
      /** Context menu item clicked */
      contextMenuClicked: {
        action: string;
      };
    };
  }>;
};
