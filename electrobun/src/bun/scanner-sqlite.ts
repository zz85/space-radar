/**
 * SQLite-backed Filesystem Scanner
 *
 * Writes scan results directly into a SQLite database instead of building
 * an in-memory tree. This keeps memory usage flat regardless of tree size
 * and enables the backend to serve depth-limited subtrees on demand so the
 * frontend never needs to hold the full tree.
 *
 * Performance notes:
 * - WAL mode for concurrent reads during scan
 * - Batched inserts (commit every BATCH_SIZE rows)
 * - JS-managed IDs to avoid SELECT last_insert_rowid() round-trips
 * - Prepared statements reused across all inserts
 * - Directory sizes computed bottom-up after scan completes
 */

import { Database } from "bun:sqlite";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/** Commit inserts every N rows. */
const BATCH_SIZE = 20_000;

/** Report progress every N items. */
const PROGRESS_INTERVAL = 10_000;

/** Yield to the event loop every N items (sync batch size). */
const YIELD_INTERVAL = 50_000;

/** Refresh interval constants. */
const START_REFRESH_INTERVAL = 5_000;
const MAX_REFRESH_INTERVAL = 15 * 60 * 1_000;
const REFRESH_MULTIPLIER = 3;

/** Threshold (ms) after which we consider the scan possibly stuck. */
const STUCK_THRESHOLD = 30_000;

/** How many sibling directory entries are processed in parallel. */
const SCAN_CONCURRENCY = 16;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SqliteScannerHandlers {
  onProgress?: (
    dir: string,
    name: string,
    size: number,
    fileCount: number,
    dirCount: number,
    errorCount: number,
  ) => void;
  /** Lightweight notification — caller should query getSubtree(). */
  onRefresh?: () => void;
  onComplete?: (stats: SqliteScanStats) => void;
  onError?: (error: string) => void;
}

export interface SqliteScanStats {
  fileCount: number;
  dirCount: number;
  totalSize: number;
  errorCount: number;
  cancelled: boolean;
}

interface NodeRow {
  id: number;
  parent_id: number | null;
  name: string;
  size: number;
  is_dir: number;
  depth: number;
}

// ---------------------------------------------------------------------------
// Refresh scheduler (same exponential backoff as scanner.ts)
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
    if (t !== undefined) this.interval = t;
    this.scheduledAt = Date.now() + this.interval;
  }

  cancel(): void {
    this.running = false;
  }

  check(): void {
    if (!this.running) return;
    if (Date.now() >= this.scheduledAt) {
      this.task(this.schedule.bind(this));
    }
  }
}

// ---------------------------------------------------------------------------
// Exclusion paths
// ---------------------------------------------------------------------------

function buildExcludePaths(homeDir: string): string[] {
  const pjoin = path.join;
  return [
    pjoin(homeDir, "Library/CloudStorage"),
    pjoin(homeDir, "Library/Containers/com.microsoft.OneDrive"),
    pjoin(homeDir, "Library/Containers/com.microsoft.OneDrive-mac"),
    pjoin(
      homeDir,
      "Library/Containers/com.microsoft.OneDriveStandaloneUpdater",
    ),
    pjoin(homeDir, "Library/Containers/com.microsoft.OneDrive-mac.FinderSync"),
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
    "/Volumes/.timemachine",
    "/.MobileBackups",
    "/.MobileBackups.trash",
  ];
}

// ---------------------------------------------------------------------------
// SqliteScanner
// ---------------------------------------------------------------------------

export class SqliteScanner {
  private db: Database;
  private handlers: SqliteScannerHandlers;
  private refreshScheduler: RefreshScheduler | null = null;

  // Scan state
  private scanning = false;
  private cancelled = false;
  private paused = false;
  private pauseResolvers: Array<() => void> = [];

  // Counters
  private counter = 0;
  private currentSize = 0;
  private fileCount = 0;
  private dirCount = 0;
  private errorCount = 0;
  private currentPath = "";
  private lastProgressTime = Date.now();

  // Insert batching
  private insertStmt!: ReturnType<Database["query"]>;
  private nextId = 1;
  private batchCount = 0;
  private inTransaction = false;
  private rootId: number | null = null;

  constructor(dbPath: string, handlers: SqliteScannerHandlers = {}) {
    this.db = new Database(dbPath);
    this.db.exec("PRAGMA journal_mode=WAL");
    this.db.exec("PRAGMA synchronous=NORMAL");
    this.db.exec("PRAGMA cache_size=-64000"); // 64 MB
    this.db.exec("PRAGMA temp_store=MEMORY");
    this.db.exec("PRAGMA mmap_size=268435456"); // 256 MB memory-mapped I/O
    this.setupSchema();
    this.handlers = handlers;
  }

  /** Update handlers (e.g. before starting a new scan on the same instance). */
  setHandlers(handlers: SqliteScannerHandlers): void {
    this.handlers = handlers;
  }

  // ------------------------------------------------------------------
  // Schema
  // ------------------------------------------------------------------

  private setupSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS nodes (
        id        INTEGER PRIMARY KEY,
        parent_id INTEGER,
        name      TEXT    NOT NULL,
        size      INTEGER NOT NULL DEFAULT 0,
        is_dir    INTEGER NOT NULL DEFAULT 0,
        depth     INTEGER NOT NULL DEFAULT 0
      );
    `);
  }

  private createIndexes(): void {
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_parent ON nodes(parent_id);
      CREATE INDEX IF NOT EXISTS idx_depth  ON nodes(depth);
    `);
  }

  // ------------------------------------------------------------------
  // Public API
  // ------------------------------------------------------------------

  async scan(targetPath: string): Promise<void> {
    if (this.scanning) {
      this.handlers.onError?.("A scan is already in progress");
      return;
    }

    this.resetState();
    this.scanning = true;
    this.db.exec("PRAGMA locking_mode=EXCLUSIVE");

    const resolvedPath = path.resolve(targetPath);

    let stat: fs.Stats;
    try {
      stat = await fs.promises.lstat(resolvedPath);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.handlers.onError?.(`Cannot access path: ${msg}`);
      this.db.exec("PRAGMA locking_mode=NORMAL");
      this.scanning = false;
      return;
    }

    if (!stat.isDirectory()) {
      this.handlers.onError?.("Only directory scanning is currently supported");
      this.db.exec("PRAGMA locking_mode=NORMAL");
      this.scanning = false;
      return;
    }

    // Clear previous scan data
    this.db.exec("DROP TABLE IF EXISTS nodes");
    this.setupSchema();
    this.nextId = 1;

    // Prepare insert statement
    this.insertStmt = this.db.query(
      "INSERT INTO nodes (id, parent_id, name, size, is_dir, depth) VALUES (?, ?, ?, ?, ?, ?)",
    );

    // Refresh scheduler
    let refreshInterval = START_REFRESH_INTERVAL;
    this.refreshScheduler = new RefreshScheduler((reschedule) => {
      // Commit pending batch so the refresh query sees latest data
      this.commitBatch();
      this.handlers.onRefresh?.();
      refreshInterval *= REFRESH_MULTIPLIER;
      reschedule(Math.min(refreshInterval, MAX_REFRESH_INTERVAL));
    }, refreshInterval);
    this.refreshScheduler.schedule();

    const homeDir = os.homedir();
    const excludePaths = buildExcludePaths(homeDir);

    const startTime = Date.now();
    console.log(`[sqlite-scanner] Starting scan of ${resolvedPath}`);

    this.beginBatch();

    let scanFailed = false;

    try {
      try {
        await this.descendFS(
          null, // parent_id (null for root)
          resolvedPath,
          resolvedPath, // root name = full path
          0, // depth
          excludePaths,
          new Set<string>(),
        );
      } catch (err) {
        scanFailed = true;
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[sqlite-scanner] Unhandled error: ${msg}`);
        this.handlers.onError?.(msg);
      }

      // Flush remaining inserts
      this.commitBatch();
      this.refreshScheduler?.cancel();
      this.refreshScheduler = null;

      // Create indexes after bulk insert for better performance
      try {
        this.createIndexes();
      } catch (err) {
        console.error("[sqlite-scanner] Failed to create indexes:", err);
      }

      // Compute cumulative directory sizes bottom-up
      if (!this.cancelled && !scanFailed) {
        try {
          console.log("[sqlite-scanner] Computing directory sizes...");
          this.computeDirectorySizes();
        } catch (err) {
          console.error(
            "[sqlite-scanner] Failed to compute directory sizes:",
            err,
          );
        }
      }

      const elapsed = Date.now() - startTime;
      const stats = this.getStats();
      console.log(
        `[sqlite-scanner] Scan finished in ${elapsed}ms — ` +
          `${stats.fileCount} files, ${stats.dirCount} dirs, ` +
          `${stats.errorCount} errors, cancelled=${stats.cancelled}`,
      );

      // Only send onComplete if we didn't already send onError
      if (!scanFailed) {
        this.handlers.onComplete?.(stats);
      }
    } finally {
      // Always clean up — even if an unexpected exception escaped above
      try {
        this.db.exec("PRAGMA locking_mode=NORMAL");
      } catch (_) {}
      this.refreshScheduler?.cancel();
      this.refreshScheduler = null;
      this.scanning = false;
    }
  }

  cancel(): void {
    this.cancelled = true;
    if (this.paused) this.resume();
    console.log("[sqlite-scanner] Scan cancelled");
  }

  pause(): void {
    if (!this.paused) {
      this.paused = true;
      console.log("[sqlite-scanner] Scan paused");
    }
  }

  resume(): void {
    if (this.paused) {
      this.paused = false;
      console.log("[sqlite-scanner] Scan resumed");
      const resolvers = this.pauseResolvers;
      this.pauseResolvers = [];
      for (const r of resolvers) r();
    }
  }

  /** Get the root node ID of the current/last scan. */
  getRootId(): number | null {
    const row = this.db
      .query("SELECT id FROM nodes WHERE parent_id IS NULL LIMIT 1")
      .get() as { id: number } | null;
    return row?.id ?? null;
  }

  /**
   * Return a depth-limited subtree as a JSON-compatible tree object.
   * Each node has { name, size, children?, _nodeId }.
   * Directories beyond maxDepth are returned as leaves with their
   * cumulative size (so visualizations render correct proportions).
   *
   * When directory sizes haven't been computed yet (mid-scan), this
   * method calculates them on the fly:
   * 1. Edge directories (at maxDepth, size 0): recursive SUM of
   *    descendant file sizes via a prepared statement per node.
   * 2. Inner directories: bottom-up aggregation from children.
   */
  getSubtree(nodeId: number, maxDepth: number): any | null {
    const rows = this.db
      .query(
        `WITH RECURSIVE tree AS (
          SELECT id, parent_id, name, size, is_dir, 0 AS rel_depth
            FROM nodes WHERE id = ?
          UNION ALL
          SELECT n.id, n.parent_id, n.name, n.size, n.is_dir, t.rel_depth + 1
            FROM nodes n
            JOIN tree t ON n.parent_id = t.id
           WHERE t.rel_depth < ?
        )
        SELECT id, parent_id, name, size, is_dir, rel_depth FROM tree`,
      )
      .all(nodeId, maxDepth) as Array<NodeRow & { rel_depth: number }>;

    if (rows.length === 0) return null;

    // Build node map
    const map = new Map<number, any>();
    for (const r of rows) {
      map.set(r.id, {
        name: r.name,
        ...(r.is_dir ? { children: [] } : { size: r.size }),
        ...(r.is_dir && r.size > 0 ? { size: r.size } : {}),
        _nodeId: r.id,
      });
    }

    // Link children to parents
    for (const r of rows) {
      if (r.parent_id !== null && map.has(r.parent_id)) {
        map.get(r.parent_id).children.push(map.get(r.id));
      }
    }

    // Compute sizes for directories when computeDirectorySizes() hasn't run
    // (i.e. during an in-progress scan). After scan completes, dirs already
    // have correct sizes from the DB so this loop is skipped entirely.
    const hasMissingSizes = rows.some((r) => r.is_dir && r.size === 0);
    if (hasMissingSizes) {
      this.fillMissingSizes(rows, map, maxDepth);
    }

    // Attach parent node ID so the frontend can navigate up past this subtree
    const root = map.get(nodeId);
    if (root) {
      const rootRow = rows.find((r) => r.id === nodeId);
      root._parentNodeId = rootRow?.parent_id ?? null;
    }

    return root ?? null;
  }

  /**
   * Fill in missing directory sizes for a partial subtree.
   *
   * Phase 1 — edge directories (at maxDepth with size 0): run a recursive
   *   CTE per node to SUM all descendant file sizes. Uses a prepared
   *   statement so Bun's native SQLite binding avoids re-parsing.
   *
   * Phase 2 — inner directories: simple bottom-up aggregation from their
   *   already-sized children (deepest first).
   */
  private fillMissingSizes(
    rows: Array<NodeRow & { rel_depth: number }>,
    map: Map<number, any>,
    maxDepth: number,
  ): void {
    // Phase 1: edge directories — query descendant file sizes from the DB
    const descSizeStmt = this.db.query(`
      WITH RECURSIVE desc AS (
        SELECT id, size, is_dir FROM nodes WHERE parent_id = ?
        UNION ALL
        SELECT n.id, n.size, n.is_dir
          FROM nodes n
          JOIN desc d ON n.parent_id = d.id
      )
      SELECT COALESCE(SUM(CASE WHEN is_dir = 0 THEN size ELSE 0 END), 0) AS total
        FROM desc
    `);

    for (const r of rows) {
      if (r.is_dir && r.size === 0 && r.rel_depth === maxDepth) {
        const result = descSizeStmt.get(r.id) as { total: number } | null;
        if (result && result.total > 0) {
          map.get(r.id).size = result.total;
        }
      }
    }

    // Phase 2: inner directories — bottom-up from deepest to shallowest
    for (let d = maxDepth - 1; d >= 0; d--) {
      for (const r of rows) {
        if (r.is_dir && r.size === 0 && r.rel_depth === d) {
          const node = map.get(r.id);
          if (node && node.children) {
            let total = 0;
            for (const child of node.children) total += child.size || 0;
            if (total > 0) node.size = total;
          }
        }
      }
    }
  }

  /**
   * Reconstruct the full filesystem path for a node by walking parent links.
   */
  getNodePath(nodeId: number): string {
    const parts: string[] = [];
    let current = nodeId;
    const stmt = this.db.query(
      "SELECT parent_id, name FROM nodes WHERE id = ?",
    );
    while (true) {
      const row = stmt.get(current) as {
        parent_id: number | null;
        name: string;
      } | null;
      if (!row) break;
      parts.unshift(row.name);
      if (row.parent_id === null) break;
      current = row.parent_id;
    }
    // The root node's name is the full resolved path, children are just names
    // so join everything after the first element with path.sep
    if (parts.length <= 1) return parts[0] || "";
    return path.join(parts[0], ...parts.slice(1));
  }

  /** Close the database. */
  close(): void {
    try {
      this.db.close();
    } catch (_) {}
  }

  // ------------------------------------------------------------------
  // Private: scan walk
  // ------------------------------------------------------------------

  private resetState(): void {
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
    this.batchCount = 0;
    this.inTransaction = false;
    this.rootId = null;
  }

  private getStats(): SqliteScanStats {
    return {
      fileCount: this.fileCount,
      dirCount: this.dirCount,
      totalSize: this.currentSize,
      errorCount: this.errorCount,
      cancelled: this.cancelled,
    };
  }

  private waitIfPaused(): Promise<void> {
    if (!this.paused) return Promise.resolve();
    return new Promise<void>((resolve) => {
      this.pauseResolvers.push(resolve);
    });
  }

  private isExcluded(dir: string, excludePaths: string[]): boolean {
    for (const ex of excludePaths) {
      if (
        dir === ex ||
        (dir.length > ex.length && dir.startsWith(ex + path.sep))
      ) {
        return true;
      }
    }
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

  // ------------------------------------------------------------------
  // Private: batch insert helpers
  // ------------------------------------------------------------------

  private beginBatch(): void {
    if (!this.inTransaction) {
      this.db.exec("BEGIN");
      this.inTransaction = true;
      this.batchCount = 0;
    }
  }

  private commitBatch(): void {
    if (this.inTransaction) {
      try {
        this.db.exec("COMMIT");
      } catch (err) {
        console.error("[sqlite-scanner] COMMIT failed:", err);
        try {
          this.db.exec("ROLLBACK");
        } catch (_) {}
      }
      this.inTransaction = false;
      this.batchCount = 0;
    }
  }

  private insertNode(
    parentId: number | null,
    name: string,
    size: number,
    isDir: boolean,
    depth: number,
  ): number {
    const id = this.nextId++;
    try {
      this.insertStmt.run(id, parentId, name, size, isDir ? 1 : 0, depth);
    } catch (err) {
      console.error("[sqlite-scanner] Insert failed:", err);
      this.errorCount++;
      return id;
    }
    this.batchCount++;

    if (this.batchCount >= BATCH_SIZE) {
      this.commitBatch();
      this.beginBatch();
    }

    return id;
  }

  // ------------------------------------------------------------------
  // Private: directory size aggregation
  // ------------------------------------------------------------------

  private computeDirectorySizes(): void {
    const maxRow = this.db
      .query("SELECT MAX(depth) AS d FROM nodes WHERE is_dir = 1")
      .get() as { d: number | null };

    const maxDepth = maxRow?.d ?? 0;

    const updateStmt = this.db.query(`
      UPDATE nodes SET size = (
        SELECT COALESCE(SUM(c.size), 0)
          FROM nodes c
         WHERE c.parent_id = nodes.id
      ) WHERE is_dir = 1 AND depth = ?
    `);

    // Bottom-up: deepest directories first (wrapped in a transaction)
    this.db.exec("BEGIN");
    for (let d = maxDepth; d >= 0; d--) {
      updateStmt.run(d);
    }
    this.db.exec("COMMIT");
  }

  // ------------------------------------------------------------------
  // Private: recursive filesystem walk
  // ------------------------------------------------------------------

  private async descendFS(
    parentId: number | null,
    dir: string,
    name: string,
    depth: number,
    excludePaths: string[],
    seenInodes: Set<string>,
  ): Promise<void> {
    this.currentPath = dir;
    this.lastProgressTime = Date.now();

    // Counter, progress, refresh, yield
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
    this.refreshScheduler?.check();
    if (this.counter % YIELD_INTERVAL === 0) {
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    }

    // Exclusion / cancellation
    if (this.isExcluded(dir, excludePaths)) return;
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
      console.warn(`[sqlite-scanner] lstat error: ${dir} ${code}`);
      this.errorCount++;
      return;
    }

    if (this.cancelled) return;

    if (stat.blocks) {
      this.currentSize += stat.blocks * 512;
    }

    // Skip special file types
    if (
      stat.isSymbolicLink() ||
      stat.isSocket() ||
      stat.isFIFO() ||
      stat.isBlockDevice() ||
      stat.isCharacterDevice()
    ) {
      return;
    }

    // Hardlink dedup
    const inodeKey =
      stat.ino != null && stat.dev != null ? `${stat.dev}:${stat.ino}` : null;

    // ---- Regular file ----
    if (stat.isFile()) {
      this.fileCount++;
      let size = stat.size;
      if (inodeKey) {
        if (seenInodes.has(inodeKey)) {
          size = 0;
        } else {
          seenInodes.add(inodeKey);
        }
      }
      this.insertNode(parentId, name, size, false, depth);
      return;
    }

    // ---- Directory ----
    if (stat.isDirectory()) {
      this.dirCount++;
      if (inodeKey) {
        if (seenInodes.has(inodeKey)) return;
        seenInodes.add(inodeKey);
      }

      const nodeId = this.insertNode(parentId, name, 0, true, depth);
      if (parentId === null) this.rootId = nodeId;

      let entries: fs.Dirent[];
      try {
        entries = await fs.promises.readdir(dir, { withFileTypes: true });
      } catch (err) {
        const code =
          err instanceof Error && "code" in err
            ? (err as NodeJS.ErrnoException).code
            : String(err);
        console.warn(`[sqlite-scanner] readdir error: ${dir} ${code}`);
        this.errorCount++;
        return;
      }

      // Separate files (can be handled inline) from directories (need recursion)
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
          // Skip special types entirely — no lstat needed
        } else {
          unknown.push(entry);
        }
      }

      // Process files inline — they still need lstat for size and inode
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
        this.insertNode(nodeId, file.name, size, false, depth + 1);
      }

      // Process unknown entries (need lstat to determine type) sequentially
      for (const entry of unknown) {
        if (this.cancelled) return;
        await this.waitIfPaused();
        if (this.cancelled) return;

        await this.descendFS(
          nodeId,
          path.join(dir, entry.name),
          entry.name,
          depth + 1,
          excludePaths,
          seenInodes,
        );
      }

      // Process subdirectories with bounded concurrency
      for (let i = 0; i < dirs.length; i += SCAN_CONCURRENCY) {
        if (this.cancelled) return;
        await this.waitIfPaused();
        if (this.cancelled) return;

        const batch = dirs.slice(i, i + SCAN_CONCURRENCY);
        await Promise.all(
          batch.map((entry) =>
            this.descendFS(
              nodeId,
              path.join(dir, entry.name),
              entry.name,
              depth + 1,
              excludePaths,
              seenInodes,
            ),
          ),
        );
      }
    }
  }
}
