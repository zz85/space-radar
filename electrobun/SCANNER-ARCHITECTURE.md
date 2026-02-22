# Scanner Architecture Options

## Context

The filesystem scanner needs to run without blocking the main Bun process
(which handles RPC, menu events, and UI callbacks). The original approach used
a Bun `Worker` thread, but `postMessage` across the thread boundary suffers
from a data-corruption bug in Electrobun v1.13.1: the native FFI's
`threadsafe` callbacks receive dangling C-string pointers because the
underlying NSString is freed by ARC before the JavaScript thread reads the
data. See the GitHub issue filed against Electrobun for details.

## Options

### Option A: In-process scanner (current choice)

Run `Scanner` directly in the main Bun process. The scanner is fully
async (`await lstat()` / `await readdir()` on every entry), so it
naturally yields to the event loop between filesystem operations.

**Mitigations for UI lockup:**

- Explicit `setTimeout(0)` yield every N items (e.g., every 1 000 entries)
  to guarantee the event loop can drain RPC and menu events.
- `JSON.stringify` for `onRefresh` / `onComplete` is the only CPU-heavy
  moment; refresh frequency is exponentially backed off so this runs
  rarely (5 s, 15 s, 45 s, ...).

**Pros:**

- Zero IPC, no serialization for scanner → bun (tree stays in memory)
- No thread boundary, no FFI cstring corruption
- Simplest code; scanner-worker.ts becomes unused
- Cancel / pause / resume are direct method calls

**Cons:**

- Shares the event loop with RPC; a very large `JSON.stringify` can
  cause a brief micro-pause (~10-50 ms for million-node trees)

### Option B: Child process with stdio IPC

Spawn a separate `Bun` process (`Bun.spawn`) running the scanner as a
standalone script. Communicate via newline-delimited JSON on stdin/stdout.

**Pros:**

- True process isolation (crash isolation, separate memory, separate GC)
- stdio is a byte stream — no FFI cstring issues
- Could scan as root / with different permissions

**Cons:**

- Still needs `JSON.stringify` / `JSON.parse` for every message
- More complex lifecycle management (spawn, kill, restart)
- Slightly higher latency than in-process calls
- Need to bundle or copy the scanner script separately

### Option C: Worker with WebSocket IPC

Keep the Worker thread but bypass `postMessage`. Instead, the Worker
connects to a local WebSocket server (similar to how the browser RPC works).

**Pros:**

- True thread isolation with reliable string transport
- WebSocket handles framing and buffering

**Cons:**

- Over-engineered for inter-thread communication
- Adds network stack overhead for something that should be memory-to-memory
- Complexity of managing the WebSocket lifecycle inside a Worker

## Decision

**Option A** was selected. The scanner's fully-async design means every
filesystem call yields to the event loop. The only CPU-bound moment is
`JSON.stringify` for refresh previews, which is mitigated by exponential
backoff (fires rarely). An explicit yield every 1 000 entries provides an
additional safety margin.

If Option A proves insufficient for extremely large scans (tens of millions
of files), Option B (child process) is the recommended escalation path.
