/**
 * Space Radar Filesystem Scanner
 *
 * TypeScript port of app/js/du.js (async filesystem walker) and
 * app/js/scanner.js (scan orchestrator) for the Electrobun migration.
 *
 * Runs in the Bun main process. Walks the filesystem asynchronously,
 * building a tree of { name, size?, children? } nodes, with support for
 * cancel/pause/resume, hardlink deduplication, exclusion paths, and
 * exponentially backing-off refresh callbacks.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

// ---------------------------------------------------------------------------
// Tree node types
// ---------------------------------------------------------------------------

export interface TreeNode {
  name: string;
  size?: number;
  children?: TreeNode[];
  _isFreeSpace?: boolean;
  _isOtherFiles?: boolean;
}

// ---------------------------------------------------------------------------
// Scan statistics
// ---------------------------------------------------------------------------

export interface ScanStats {
  counter: number;
  currentSize: number;
  fileCount: number;
  dirCount: number;
  errorCount: number;
  currentPath: string;
  lastProgressTime: number;
  possiblyStuck: boolean;
  cancelled: boolean;
  paused: boolean;
}

// ---------------------------------------------------------------------------
// Scanner event handlers
// ---------------------------------------------------------------------------

export interface ScannerHandlers {
  onProgress?: (
    dir: string,
    name: string,
    size: number,
    fileCount: number,
    dirCount: number,
    errorCount: number,
  ) => void;
  onRefresh?: (tree: TreeNode) => void;
  onComplete?: (tree: TreeNode, stats: ScanStats) => void;
  onError?: (error: string) => void;
}

// ---------------------------------------------------------------------------
// Internal: options bag threaded through the recursive walk
// ---------------------------------------------------------------------------

interface DescendOptions {
  parent: string;
  name: string | null;
  node: TreeNode;
  excludePaths: string[];
  seenInodes: Set<string>;
}

// ---------------------------------------------------------------------------
// Refresh scheduler (port of utils.js TaskChecker)
// ---------------------------------------------------------------------------

class RefreshScheduler {
  private running = false;
  private interval: number;
  private scheduledAt: number;
  private readonly task: (reschedule: (t?: number) => void) => void;

  constructor(
    task: (reschedule: (t?: number) => void) => void,
    interval: number,
  ) {
    this.task = task;
    this.interval = interval;
    this.scheduledAt = Date.now() + interval;
  }

  schedule(t?: number): void {
    this.running = true;
    if (t !== undefined) {
      this.interval = t;
    }
    this.scheduledAt = Date.now() + this.interval;
  }

  cancel(): void {
    this.running = false;
  }

  /** Called on every progress tick — runs the task if enough time has passed. */
  check(): void {
    if (!this.running) return;
    if (Date.now() >= this.scheduledAt) {
      this.task(this.schedule.bind(this));
    }
  }
}

// ---------------------------------------------------------------------------
// Default exclusion paths (from scanner.js)
// ---------------------------------------------------------------------------

function buildExcludePaths(homeDir: string): string[] {
  const pjoin = path.join;
  return [
    // Cloud storage paths that can cause hangs or incomplete data
    pjoin(homeDir, "Library/CloudStorage"),
    pjoin(homeDir, "Library/Containers/com.microsoft.OneDrive"),
    pjoin(homeDir, "Library/Containers/com.microsoft.OneDrive-mac"),
    pjoin(
      homeDir,
      "Library/Containers/com.microsoft.OneDriveStandaloneUpdater",
    ),
    pjoin(homeDir, "Library/Containers/com.microsoft.OneDrive-mac.FinderSync"),
    // macOS system paths that often cause permission issues or hangs
    "/System/Volumes/Data/.Spotlight-V100",
    "/private/var/db",
    "/private/var/folders",
    "/.Spotlight-V100",
    "/.fseventsd",
    "/dev",
    "/System/Volumes/VM",
    "/System/Volumes/Preboot",
    "/System/Volumes/Update",
    pjoin(homeDir, "Library/Caches"),
    pjoin(homeDir, "Library/Saved Application State"),
    // Time Machine
    "/Volumes/.timemachine",
    "/.MobileBackups",
    "/.MobileBackups.trash",
  ];
}

// ---------------------------------------------------------------------------
// Scanner class
// ---------------------------------------------------------------------------

/** Threshold (ms) after which we consider the scan possibly stuck. */
const STUCK_THRESHOLD = 30_000;

/** Report progress every N items. */
const PROGRESS_INTERVAL = 10_000;

/** Yield to the event loop every N items to prevent UI lockup. */
const YIELD_INTERVAL = 5_000;

/** Refresh interval constants. */
const START_REFRESH_INTERVAL = 5_000;
const MAX_REFRESH_INTERVAL = 15 * 60 * 1_000;
const REFRESH_MULTIPLIER = 3;
const SCAN_CONCURRENCY = 16;

export class Scanner {
  // ---- state ----
  private counter = 0;
  private currentSize = 0;
  private fileCount = 0;
  private dirCount = 0;
  private errorCount = 0;
  private currentPath = "";
  private lastProgressTime = Date.now();
  private cancelled = false;
  private paused = false;
  private pauseResolvers: Array<() => void> = [];
  private scanning = false;
  private refreshScheduler: RefreshScheduler | null = null;

  // ---- handlers ----
  private handlers: ScannerHandlers;

  constructor(handlers: ScannerHandlers = {}) {
    this.handlers = handlers;
  }

  // ------------------------------------------------------------------
  // Public API
  // ------------------------------------------------------------------

  /** Start scanning `targetPath`. Resolves when the scan finishes. */
  async scan(targetPath: string): Promise<void> {
    if (this.scanning) {
      this.handlers.onError?.("A scan is already in progress");
      return;
    }

    this.resetCounters();
    this.scanning = true;

    const resolvedPath = path.resolve(targetPath);

    let stat: fs.Stats;
    try {
      stat = await fs.promises.lstat(resolvedPath);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.handlers.onError?.(`Cannot access path: ${msg}`);
      this.scanning = false;
      return;
    }

    if (!stat.isDirectory()) {
      // TODO: support du-file reading in a future pass
      this.handlers.onError?.("Only directory scanning is currently supported");
      this.scanning = false;
      return;
    }

    const homeDir = os.homedir();
    const excludePaths = buildExcludePaths(homeDir);
    const tree: TreeNode = { name: "" };

    // ---- Refresh scheduler ----
    let refreshInterval = START_REFRESH_INTERVAL;

    this.refreshScheduler = new RefreshScheduler((reschedule) => {
      this.handlers.onRefresh?.(tree);
      refreshInterval *= REFRESH_MULTIPLIER;
      reschedule(Math.min(refreshInterval, MAX_REFRESH_INTERVAL));
    }, refreshInterval);

    this.refreshScheduler.schedule();

    // ---- Walk ----
    const startTime = Date.now();
    console.log(`[scanner] Starting scan of ${resolvedPath}`);

    try {
      await this.descendFS({
        parent: resolvedPath,
        name: null,
        node: tree,
        excludePaths,
        seenInodes: new Set<string>(),
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[scanner] Unhandled error during scan: ${msg}`);
      this.handlers.onError?.(msg);
    }

    this.refreshScheduler.cancel();
    this.refreshScheduler = null;

    const elapsed = Date.now() - startTime;
    console.log(
      `[scanner] Scan finished in ${elapsed}ms — ` +
        `${this.fileCount} files, ${this.dirCount} dirs, ` +
        `${this.errorCount} errors, cancelled=${this.cancelled}`,
    );

    const finalStats = this.getStats();
    this.handlers.onComplete?.(tree, finalStats);
    this.scanning = false;
  }

  /** Cancel the current scan. */
  cancel(): void {
    this.cancelled = true;
    // Resume if paused so pending awaits can settle
    if (this.paused) {
      this.resume();
    }
    console.log("[scanner] Scan cancelled by user");
  }

  /** Pause the current scan. */
  pause(): void {
    if (!this.paused) {
      this.paused = true;
      console.log("[scanner] Scan paused");
    }
  }

  /** Resume a paused scan. */
  resume(): void {
    if (this.paused) {
      this.paused = false;
      console.log("[scanner] Scan resumed");
      const resolvers = this.pauseResolvers;
      this.pauseResolvers = [];
      for (const resolve of resolvers) {
        resolve();
      }
    }
  }

  /** Return a snapshot of the current scan statistics. */
  getStats(): ScanStats {
    return {
      counter: this.counter,
      currentSize: this.currentSize,
      fileCount: this.fileCount,
      dirCount: this.dirCount,
      errorCount: this.errorCount,
      currentPath: this.currentPath,
      lastProgressTime: this.lastProgressTime,
      possiblyStuck: Date.now() - this.lastProgressTime > STUCK_THRESHOLD,
      cancelled: this.cancelled,
      paused: this.paused,
    };
  }

  // ------------------------------------------------------------------
  // Private helpers
  // ------------------------------------------------------------------

  private resetCounters(): void {
    this.counter = 0;
    this.currentSize = 0;
    this.fileCount = 0;
    this.dirCount = 0;
    this.errorCount = 0;
    this.currentPath = "";
    this.lastProgressTime = Date.now();
    this.cancelled = false;
    this.paused = false;
    this.pauseResolvers = [];
  }

  /**
   * Returns a promise that resolves immediately if not paused,
   * or waits until `resume()` is called.
   */
  private waitIfPaused(): Promise<void> {
    if (!this.paused) return Promise.resolve();
    return new Promise<void>((resolve) => {
      this.pauseResolvers.push(resolve);
    });
  }

  /**
   * Check whether `dir` matches any exclusion path.
   * A path is excluded if it equals an exclusion entry or is a descendant of
   * one (i.e. starts with `exclusion + path.sep`).
   */
  private isExcluded(dir: string, excludePaths: string[]): boolean {
    for (const ex of excludePaths) {
      if (
        dir === ex ||
        (dir.length > ex.length && dir.startsWith(ex + path.sep))
      ) {
        return true;
      }
    }
    // Special-case: Exclude OneDrive data inside Group Containers
    if (
      dir.includes(
        path.sep + "Library" + path.sep + "Group Containers" + path.sep,
      ) &&
      dir.includes("OneDrive")
    ) {
      return true;
    }
    return false;
  }

  /**
   * Async recursive filesystem descender.
   * Port of du.js `descendFS`, rewritten with async/await for cleaner
   * pause/resume semantics.
   */
  private async descendFS(opts: DescendOptions): Promise<void> {
    const { node, excludePaths, seenInodes } = opts;

    // Resolve the full directory path
    let dir: string;
    let name: string;
    if (opts.name === null) {
      dir = opts.parent;
      name = opts.parent;
    } else {
      dir = path.join(opts.parent, opts.name);
      name = opts.name;
    }

    // Track current path for external visibility
    this.currentPath = dir;
    this.lastProgressTime = Date.now();

    // Bump counter and emit progress periodically
    this.counter++;
    if (this.counter % PROGRESS_INTERVAL === 0) {
      this.handlers.onProgress?.(
        dir,
        name,
        this.currentSize,
        this.fileCount,
        this.dirCount,
        this.errorCount,
      );
    }

    // Check if a refresh preview is due
    this.refreshScheduler?.check();

    // Yield to the event loop periodically so RPC / UI stays responsive
    if (this.counter % YIELD_INTERVAL === 0) {
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    }

    // Exclusion check
    if (this.isExcluded(dir, excludePaths)) {
      return;
    }

    // Bail on cancellation
    if (this.cancelled) return;

    // lstat
    let stat: fs.Stats;
    try {
      stat = await fs.promises.lstat(dir);
    } catch (err) {
      const code =
        err instanceof Error && "code" in err
          ? (err as NodeJS.ErrnoException).code
          : String(err);
      console.warn(`[scanner] lstat error: ${dir} ${code}`);
      this.errorCount++;
      return;
    }

    // Post-lstat cancellation check
    if (this.cancelled) return;

    // Accumulate block-based size
    if (stat.blocks) {
      this.currentSize += stat.blocks * 512;
    }

    // ---- Skip special file types ----
    if (
      stat.isSymbolicLink() ||
      stat.isSocket() ||
      stat.isFIFO() ||
      stat.isBlockDevice() ||
      stat.isCharacterDevice()
    ) {
      return;
    }

    // ---- Inode key for hardlink deduplication ----
    const inodeKey =
      stat.ino != null && stat.dev != null ? `${stat.dev}:${stat.ino}` : null;

    // ---- Regular file ----
    if (stat.isFile()) {
      this.fileCount++;
      let size = stat.size;
      if (inodeKey) {
        if (seenInodes.has(inodeKey)) {
          size = 0; // hardlink duplicate – don't double-count
        } else {
          seenInodes.add(inodeKey);
        }
      }
      node.name = name;
      node.size = size;
      return;
    }

    // ---- Directory ----
    if (stat.isDirectory()) {
      this.dirCount++;
      if (inodeKey) {
        if (seenInodes.has(inodeKey)) {
          return; // directory hardlink / bind-mount duplicate
        }
        seenInodes.add(inodeKey);
      }

      node.name = name;
      node.children = [];

      let entries: fs.Dirent[];
      try {
        entries = await fs.promises.readdir(dir, { withFileTypes: true });
      } catch (err) {
        const code =
          err instanceof Error && "code" in err
            ? (err as NodeJS.ErrnoException).code
            : String(err);
        console.warn(`[scanner] readdir error: ${dir} ${code}`);
        this.errorCount++;
        return;
      }

      // Separate files from directories to handle them differently
      const files: fs.Dirent[] = [];
      const dirs: fs.Dirent[] = [];
      const unknown: fs.Dirent[] = [];

      for (const entry of entries) {
        if (entry.isFile()) {
          files.push(entry);
        } else if (entry.isDirectory()) {
          dirs.push(entry);
        } else if (
          entry.isSymbolicLink() ||
          entry.isSocket?.() ||
          entry.isFIFO?.() ||
          entry.isBlockDevice?.() ||
          entry.isCharacterDevice?.()
        ) {
          // Skip special types — no lstat needed
        } else {
          unknown.push(entry);
        }
      }

      // Process files — still need lstat for size and inode info
      for (const file of files) {
        if (this.cancelled) return;

        const filePath = path.join(dir, file.name);
        this.counter++;
        if (this.counter % PROGRESS_INTERVAL === 0) {
          this.handlers.onProgress?.(
            filePath,
            file.name,
            this.currentSize,
            this.fileCount,
            this.dirCount,
            this.errorCount,
          );
        }
        this.refreshScheduler?.check();
        if (this.counter % YIELD_INTERVAL === 0) {
          await new Promise<void>((resolve) => setTimeout(resolve, 0));
        }

        let fileStat: fs.Stats;
        try {
          fileStat = await fs.promises.lstat(filePath);
        } catch {
          this.errorCount++;
          continue;
        }

        this.fileCount++;
        if (fileStat.blocks) {
          this.currentSize += fileStat.blocks * 512;
        }

        let size = fileStat.size;
        const fileInodeKey =
          fileStat.ino != null && fileStat.dev != null
            ? `${fileStat.dev}:${fileStat.ino}`
            : null;
        if (fileInodeKey) {
          if (seenInodes.has(fileInodeKey)) {
            size = 0;
          } else {
            seenInodes.add(fileInodeKey);
          }
        }

        const childNode: TreeNode = { name: file.name, size };
        node.children.push(childNode);
      }

      // Process unknown entries sequentially (need lstat to determine type)
      for (const entry of unknown) {
        if (this.cancelled) return;
        await this.waitIfPaused();
        if (this.cancelled) return;

        const childNode: TreeNode = { name: "" };
        node.children.push(childNode);

        await this.descendFS({
          parent: dir,
          name: entry.name,
          node: childNode,
          excludePaths,
          seenInodes,
        });
      }

      // Process subdirectories with bounded concurrency
      for (let i = 0; i < dirs.length; i += SCAN_CONCURRENCY) {
        if (this.cancelled) return;
        await this.waitIfPaused();
        if (this.cancelled) return;

        const batch = dirs.slice(i, i + SCAN_CONCURRENCY);
        // Pre-create child nodes so tree structure is maintained
        const childNodes = batch.map(() => {
          const childNode: TreeNode = { name: "" };
          node.children!.push(childNode);
          return childNode;
        });

        await Promise.all(
          batch.map((entry, idx) =>
            this.descendFS({
              parent: dir,
              name: entry.name,
              node: childNodes[idx],
              excludePaths,
              seenInodes,
            }),
          ),
        );
      }

      return;
    }

    // Unknown file type
    console.log(`[scanner] Skipping unknown file type: ${dir}`);
  }
}
