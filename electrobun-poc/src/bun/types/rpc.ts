/**
 * RPC Type Definitions for Space Radar Electrobun
 * 
 * Defines the typed RPC interface between main and renderer processes.
 */

import type { FileNode, ScanStats } from "../scanner";

// RPC interface defining all communication between main and renderer
export interface SpaceRadarRPC {
requests: {
// Request to start scanning a directory
startScan: {
params: string; // target path
response: {
success: boolean;
data?: FileNode;
stats?: ScanStats;
error?: string;
};
};

// Request current scan statistics
getStats: {
params: void;
response: ScanStats;
};

// Request to cancel ongoing scan
cancelScan: {
params: void;
response: {
success: boolean;
};
};
};

messages: {
// Progress updates sent from main to renderer
scanProgress: {
fileCount: number;
dirCount: number;
totalSize: number;
errorCount: number;
};
};
}
