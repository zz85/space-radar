// RPC Schema for SpaceRadar communication between Bun main process and webview
// This file defines the typed interface for bidirectional communication

import type { RPCSchema } from "electrobun";

export type SpaceRadarRPC = {
  // Bun-side schema: requests handled by bun, messages received by bun
  bun: RPCSchema<{
    requests: {
      selectFolder: {
        params: void;
        response: { path: string | null };
      };
      selectFile: {
        params: void;
        response: { path: string | null };
      };
      startScan: {
        params: { targetPath: string };
        response: { started: boolean };
      };
      cancelScan: {
        params: void;
        response: { cancelled: boolean };
      };
      pauseScan: {
        params: void;
        response: { paused: boolean };
      };
      resumeScan: {
        params: void;
        response: { resumed: boolean };
      };
      openDirectory: {
        params: { dirPath: string };
        response: { success: boolean };
      };
      openExternal: {
        params: { url: string };
        response: { success: boolean };
      };
      trashItem: {
        params: { filePath: string };
        response: { success: boolean };
      };
      loadLast: {
        params: void;
        response: { data: any };
      };
      confirmAction: {
        params: { message: string };
        response: { confirmed: boolean };
      };
    };
    messages: {
      logFromView: {
        msg: string;
      };
    };
  }>;
  // Webview-side schema: requests handled by webview, messages received by webview
  webview: RPCSchema<{
    requests: {};
    messages: {
      scanProgress: {
        path: string;
        name: string;
        size: number;
        fileCount: number;
        dirCount: number;
        errorCount: number;
      };
      scanComplete: {
        data: any;
        stats: {
          fileCount: number;
          dirCount: number;
          errorCount: number;
          currentSize: number;
          cancelled: boolean;
        };
      };
      colorChange: {
        type: string;
        value: string;
      };
    };
  }>;
};
