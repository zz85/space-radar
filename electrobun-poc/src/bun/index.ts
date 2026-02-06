/**
 * Space Radar Electrobun POC - Main Process
 * 
 * This demonstrates the proper use of Electrobun's BrowserWindow and RPC APIs.
 */

import { BrowserWindow, BrowserView, Utils } from "electrobun/bun";
import type { SpaceRadarRPC } from "./types/rpc";
import { DiskScanner } from "./scanner";

console.log("🌌 Space Radar Electrobun POC starting...");

// Initialize the disk scanner
const scanner = new DiskScanner();

// Define RPC communication between main and renderer
const rpc = BrowserView.defineRPC<SpaceRadarRPC>({
	maxRequestTime: 300000, // 5 minutes for large scans
	handlers: {
		requests: {
			// Start a disk scan
			startScan: async (targetPath: string) => {
				console.log(`[Main] Starting scan of: ${targetPath}`);
				
				try {
					const result = await scanner.scan(targetPath);
					console.log(`[Main] Scan complete:`, {
						files: scanner.getStats().fileCount,
						dirs: scanner.getStats().dirCount,
						size: scanner.getStats().totalSize,
					});
					
					return {
						success: true,
						data: result,
						stats: scanner.getStats(),
					};
				} catch (error: any) {
					console.error(`[Main] Scan failed:`, error);
					return {
						success: false,
						error: error.message,
					};
				}
			},
			
			// Get current scan statistics
			getStats: async () => {
				return scanner.getStats();
			},
			
			// Cancel ongoing scan
			cancelScan: async () => {
				scanner.cancel();
				return { success: true };
			},
		},
		messages: {
			// Handle messages from renderer
			"*": (messageName, payload) => {
				console.log(`[Main] Message received: ${messageName}`, payload);
			},
		},
	},
});

// Set up progress forwarding from scanner to UI
scanner.setProgressCallback((stats) => {
	// Send progress updates to the renderer
	rpc.send.scanProgress({
		fileCount: stats.fileCount,
		dirCount: stats.dirCount,
		totalSize: stats.totalSize,
		errorCount: stats.errorCount,
	});
});

// Create the main application window
const mainWindow = new BrowserWindow({
	title: "Space Radar - Electrobun POC",
	url: "views://mainview/index.html",
	frame: {
		width: 1000,
		height: 800,
		x: 100,
		y: 100,
	},
	titleBarStyle: "default",
	rpc, // Attach RPC to the window
});

// Quit the app when the main window is closed
mainWindow.on("close", () => {
	console.log("🌌 Space Radar Electrobun shutting down...");
	scanner.cancel();
	Utils.quit();
});

console.log("✅ Space Radar Electrobun app ready!");
