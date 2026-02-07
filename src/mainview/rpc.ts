// RPC Schema for SpaceRadar communication between Bun main process and webview
// This file defines the typed interface for bidirectional communication

export interface SpaceRadarRPC {
  requests: {
    // Bun-side handlers (called by the view)
    selectFolder: () => { path: string | null };
    selectFile: () => { path: string | null };
    startScan: (args: { targetPath: string }) => { started: boolean };
    cancelScan: () => { cancelled: boolean };
    pauseScan: () => { paused: boolean };
    resumeScan: () => { resumed: boolean };
    openDirectory: (args: { dirPath: string }) => { success: boolean };
    openExternal: (args: { url: string }) => { success: boolean };
    trashItem: (args: { filePath: string }) => { success: boolean };
    loadLast: () => { data: any };
    confirmAction: (args: { message: string }) => { confirmed: boolean };
  };
  messages: {
    // Bun-side message handlers (fire-and-forget from view)
    logFromView: (args: { msg: string }) => void;
    // View-side message handlers (fire-and-forget from Bun)
    scanProgress: (args: {
      path: string;
      name: string;
      size: number;
      fileCount: number;
      dirCount: number;
      errorCount: number;
    }) => void;
    scanComplete: (args: {
      data: any;
      stats: {
        fileCount: number;
        dirCount: number;
        errorCount: number;
        currentSize: number;
        cancelled: boolean;
      };
    }) => void;
    colorChange: (args: {
      type: string;
      value: string;
    }) => void;
  };
}
