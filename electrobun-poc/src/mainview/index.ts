/**
 * Space Radar Electrobun POC - Renderer Process
 * 
 * This demonstrates the proper use of Electrobun's RPC from the renderer side.
 */

import { BrowserView } from "electrobun/view";
import type { SpaceRadarRPC } from "../bun/types/rpc";

console.log("🌌 Space Radar renderer loaded!");

// Get RPC connection to main process
const rpc = BrowserView.getRPC<SpaceRadarRPC>();

// DOM elements
const pathInput = document.getElementById('pathInput') as HTMLInputElement;
const scanBtn = document.getElementById('scanBtn') as HTMLButtonElement;
const cancelBtn = document.getElementById('cancelBtn') as HTMLButtonElement;
const statsContainer = document.getElementById('statsContainer') as HTMLDivElement;
const statusMessage = document.getElementById('statusMessage') as HTMLDivElement;
const canvas = document.getElementById('sunburstCanvas') as HTMLCanvasElement;

// Stats elements
const fileCountEl = document.getElementById('fileCount') as HTMLSpanElement;
const dirCountEl = document.getElementById('dirCount') as HTMLSpanElement;
const totalSizeEl = document.getElementById('totalSize') as HTMLSpanElement;
const errorCountEl = document.getElementById('errorCount') as HTMLSpanElement;

let isScanning = false;
let scanResult: any = null;

// Listen for progress updates from main process
rpc.listen.scanProgress((data) => {
	console.log("[Renderer] Progress update:", data);
	updateStats(data);
});

// Start scan button
scanBtn.addEventListener('click', async () => {
	const path = pathInput.value.trim();
	if (!path) {
		showStatus('Please enter a path to scan', 'error');
		return;
	}

	try {
		isScanning = true;
		scanBtn.disabled = true;
		cancelBtn.style.display = 'inline-block';
		statsContainer.style.display = 'flex';
		showStatus('Scanning... This may take a while for large directories.', 'info');

		console.log("[Renderer] Requesting scan:", path);
		
		// Call RPC method on main process
		const result = await rpc.request.startScan(path);
		
		console.log("[Renderer] Scan result:", result);

		if (result.success && result.data) {
			scanResult = result.data;
			showStatus(`✓ Scan complete! Found ${result.stats?.fileCount} files in ${result.stats?.dirCount} directories.`, 'success');
			
			// Draw visualization
			drawSunburst(result.data);
		} else {
			showStatus(`Error: ${result.error || 'Unknown error'}`, 'error');
		}
	} catch (error: any) {
		console.error("[Renderer] Scan failed:", error);
		showStatus(`Error: ${error.message}`, 'error');
	} finally {
		isScanning = false;
		scanBtn.disabled = false;
		cancelBtn.style.display = 'none';
	}
});

// Cancel scan button
cancelBtn.addEventListener('click', async () => {
	console.log("[Renderer] Requesting cancel");
	await rpc.request.cancelScan();
	showStatus('Scan cancelled by user', 'info');
	isScanning = false;
	scanBtn.disabled = false;
	cancelBtn.style.display = 'none';
});

// Update statistics display
function updateStats(stats: any) {
	fileCountEl.textContent = stats.fileCount.toLocaleString();
	dirCountEl.textContent = stats.dirCount.toLocaleString();
	totalSizeEl.textContent = formatBytes(stats.totalSize);
	errorCountEl.textContent = stats.errorCount.toString();
}

// Format bytes to human-readable string
function formatBytes(bytes: number): string {
	const units = ['B', 'KB', 'MB', 'GB', 'TB'];
	let size = bytes;
	let i = 0;
	while (size >= 1024 && i < units.length - 1) {
		size /= 1024;
		i++;
	}
	return size.toFixed(2) + ' ' + units[i];
}

// Show status message
function showStatus(message: string, type: 'info' | 'success' | 'error') {
	statusMessage.textContent = message;
	statusMessage.className = `status-message ${type}`;
}

// Simple sunburst visualization
function drawSunburst(data: any) {
	const ctx = canvas.getContext('2d');
	if (!ctx) return;

	const width = canvas.width;
	const height = canvas.height;
	const centerX = width / 2;
	const centerY = height / 2;
	const maxRadius = Math.min(width, height) / 2 - 20;

	// Clear canvas
	ctx.clearRect(0, 0, width, height);

	// Colors
	const colors = ['#a1c9f4', '#ffb482', '#8de5a1', '#ff9f9b', '#d0bbff', '#debb9b'];

	function drawNode(node: any, startAngle: number, endAngle: number, innerRadius: number, outerRadius: number, depth: number) {
		const color = colors[depth % colors.length];

		// Draw arc
		ctx.beginPath();
		ctx.arc(centerX, centerY, outerRadius, startAngle, endAngle);
		ctx.arc(centerX, centerY, innerRadius, endAngle, startAngle, true);
		ctx.closePath();
		ctx.fillStyle = color;
		ctx.fill();
		ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
		ctx.lineWidth = 1;
		ctx.stroke();

		// Draw children
		if (node.children && node.children.length > 0) {
			const totalSize = node.size;
			let currentAngle = startAngle;
			const radiusStep = 80;
			const childInner = outerRadius;
			const childOuter = Math.min(outerRadius + radiusStep, maxRadius);

			for (const child of node.children) {
				const angleSize = ((endAngle - startAngle) * child.size) / totalSize;
				const childEnd = currentAngle + angleSize;
				drawNode(child, currentAngle, childEnd, childInner, childOuter, depth + 1);
				currentAngle = childEnd;
			}
		}
	}

	// Draw center circle
	ctx.beginPath();
	ctx.arc(centerX, centerY, 60, 0, Math.PI * 2);
	ctx.fillStyle = '#ffffff';
	ctx.fill();
	ctx.strokeStyle = '#cccccc';
	ctx.lineWidth = 2;
	ctx.stroke();

	// Draw center text
	ctx.fillStyle = '#333';
	ctx.font = 'bold 14px sans-serif';
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';
	ctx.fillText(formatBytes(data.size), centerX, centerY);

	// Draw the tree
	drawNode(data, 0, Math.PI * 2, 60, 140, 0);

	console.log("[Renderer] Sunburst visualization drawn");
}

console.log("✅ Space Radar renderer ready!");
