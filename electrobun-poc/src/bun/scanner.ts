/**
 * Disk Scanner for Space Radar Electrobun POC
 * 
 * This implements the core disk scanning functionality using Bun's fast fs APIs.
 * Demonstrates how the scanner would work in Electrobun vs the Electron version.
 */

import { readdirSync, statSync, lstatSync } from 'fs';
import { join } from 'path';

interface FileNode {
  name: string;
  path: string;
  size: number;
  children?: FileNode[];
  isDirectory: boolean;
}

interface ScanStats {
  fileCount: number;
  dirCount: number;
  totalSize: number;
  errorCount: number;
  startTime: number;
  endTime?: number;
}

interface ScanOptions {
  maxDepth?: number;
  skipHidden?: boolean;
  followSymlinks?: boolean;
  onProgress?: (stats: ScanStats) => void;
  excludePaths?: string[];
}

/**
 * Paths to exclude from scanning (system files, caches, etc.)
 */
const DEFAULT_EXCLUDE_PATHS = [
  'node_modules',
  '.git',
  '.DS_Store',
  'Library/Caches',
  'AppData/Local/Temp',
  '$RECYCLE.BIN',
  'System Volume Information',
  '.Trash',
];

export class DiskScanner {
  private stats: ScanStats;
  private options: ScanOptions;
  private cancelled = false;
  private seenInodes = new Set<string>(); // Track hardlinks

  constructor(options: ScanOptions = {}) {
    this.options = {
      maxDepth: options.maxDepth ?? 100,
      skipHidden: options.skipHidden ?? true,
      followSymlinks: options.followSymlinks ?? false,
      excludePaths: [
        ...(DEFAULT_EXCLUDE_PATHS),
        ...(options.excludePaths || [])
      ],
      onProgress: options.onProgress,
    };

    this.stats = {
      fileCount: 0,
      dirCount: 0,
      totalSize: 0,
      errorCount: 0,
      startTime: Date.now(),
    };
  }

  /**
   * Cancel the ongoing scan
   */
  cancel() {
    this.cancelled = true;
  }

  /**
   * Check if path should be excluded
   */
  private shouldExclude(path: string): boolean {
    return this.options.excludePaths!.some(exclude => 
      path.includes(exclude)
    );
  }

  /**
   * Scan a directory recursively
   */
  async scan(targetPath: string): Promise<FileNode> {
    console.log(`[Scanner] Starting scan of: ${targetPath}`);
    this.stats.startTime = Date.now();
    
    try {
      const result = await this.scanDirectory(targetPath, 0);
      this.stats.endTime = Date.now();
      
      const duration = (this.stats.endTime - this.stats.startTime) / 1000;
      console.log(`[Scanner] Scan complete in ${duration.toFixed(2)}s`);
      console.log(`[Scanner] Files: ${this.stats.fileCount.toLocaleString()}`);
      console.log(`[Scanner] Directories: ${this.stats.dirCount.toLocaleString()}`);
      console.log(`[Scanner] Total size: ${this.formatBytes(this.stats.totalSize)}`);
      console.log(`[Scanner] Errors: ${this.stats.errorCount}`);
      console.log(`[Scanner] Speed: ${(this.stats.fileCount / duration).toFixed(0)} files/sec`);
      
      return result;
    } catch (error) {
      console.error('[Scanner] Fatal error:', error);
      throw error;
    }
  }

  /**
   * Recursively scan a directory
   */
  private async scanDirectory(dirPath: string, depth: number): Promise<FileNode> {
    if (this.cancelled) {
      throw new Error('Scan cancelled');
    }

    if (depth > this.options.maxDepth!) {
      return {
        name: dirPath.split('/').pop() || dirPath,
        path: dirPath,
        size: 0,
        isDirectory: true,
      };
    }

    const node: FileNode = {
      name: dirPath.split('/').pop() || dirPath,
      path: dirPath,
      size: 0,
      isDirectory: true,
      children: [],
    };

    try {
      // Use lstat to not follow symlinks by default
      const stat = lstatSync(dirPath);

      // Handle symlinks
      if (stat.isSymbolicLink()) {
        if (!this.options.followSymlinks) {
          return node;
        }
      }

      // Track hardlinks (dedupe)
      if (stat.ino) {
        const inode = `${stat.dev}-${stat.ino}`;
        if (this.seenInodes.has(inode)) {
          return node; // Skip duplicate hardlink
        }
        this.seenInodes.add(inode);
      }

      // Read directory contents
      const entries = readdirSync(dirPath);
      this.stats.dirCount++;

      for (const entry of entries) {
        if (this.cancelled) break;

        // Skip hidden files if configured
        if (this.options.skipHidden && entry.startsWith('.')) {
          continue;
        }

        const entryPath = join(dirPath, entry);

        // Skip excluded paths
        if (this.shouldExclude(entryPath)) {
          continue;
        }

        try {
          const entryStat = lstatSync(entryPath);

          if (entryStat.isDirectory()) {
            // Recursively scan subdirectory
            const childNode = await this.scanDirectory(entryPath, depth + 1);
            node.children!.push(childNode);
            node.size += childNode.size;
          } else if (entryStat.isFile()) {
            // Add file
            const fileNode: FileNode = {
              name: entry,
              path: entryPath,
              size: entryStat.size,
              isDirectory: false,
            };
            node.children!.push(fileNode);
            node.size += entryStat.size;
            this.stats.fileCount++;
            this.stats.totalSize += entryStat.size;
          }
        } catch (error: any) {
          // Skip files we can't access
          this.stats.errorCount++;
          if (this.stats.errorCount < 10) {
            console.warn(`[Scanner] Error accessing ${entryPath}:`, error.message);
          }
        }
      }

      // Report progress periodically
      if (this.options.onProgress && this.stats.dirCount % 100 === 0) {
        this.options.onProgress(this.stats);
      }

    } catch (error: any) {
      console.error(`[Scanner] Error scanning ${dirPath}:`, error.message);
      this.stats.errorCount++;
    }

    return node;
  }

  /**
   * Get current scan statistics
   */
  getStats(): ScanStats {
    return { ...this.stats };
  }

  /**
   * Format bytes to human-readable string
   */
  private formatBytes(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(2)} ${units[unitIndex]}`;
  }
}

/**
 * CLI entry point for testing
 */
if (import.meta.main) {
  const targetPath = process.argv[2] || process.cwd();
  
  console.log('='.repeat(60));
  console.log('Space Radar Electrobun POC - Disk Scanner');
  console.log('='.repeat(60));
  console.log(`Target: ${targetPath}\n`);

  const scanner = new DiskScanner({
    skipHidden: false,
    onProgress: (stats) => {
      // Progress callback - would send to UI in real app
      if (stats.dirCount % 500 === 0) {
        const elapsed = (Date.now() - stats.startTime) / 1000;
        const rate = stats.fileCount / elapsed;
        console.log(`Progress: ${stats.fileCount.toLocaleString()} files, ${stats.dirCount.toLocaleString()} dirs (${rate.toFixed(0)} files/sec)`);
      }
    }
  });

  // Handle Ctrl+C
  process.on('SIGINT', () => {
    console.log('\n[Scanner] Cancelling scan...');
    scanner.cancel();
  });

  try {
    const result = await scanner.scan(targetPath);
    console.log('\n' + '='.repeat(60));
    console.log('Scan complete!');
    console.log('='.repeat(60));
    
    // Show top 10 largest items
    if (result.children && result.children.length > 0) {
      const sorted = [...result.children].sort((a, b) => b.size - a.size);
      console.log('\nTop 10 largest items:');
      sorted.slice(0, 10).forEach((item, i) => {
        const size = scanner['formatBytes'](item.size);
        const type = item.isDirectory ? 'DIR ' : 'FILE';
        console.log(`  ${i + 1}. [${type}] ${item.name.padEnd(40)} ${size.padStart(12)}`);
      });
    }
  } catch (error: any) {
    console.error('\n[Scanner] Error:', error.message);
    process.exit(1);
  }
}

export type { FileNode, ScanStats, ScanOptions };
