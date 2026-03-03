# Node.js Metrics & Monitoring

## Our Current Setup

We use `prom-client` with `collectDefaultMetrics()` → Prometheus → Grafana.

The `services.json` dashboard already covers:

- Request Rate, Error Rate, P95 Latency (RED)
- CPU Usage, Heap Usage %, Event Loop Lag (USE)
- Active Handles & Requests, Resident Memory

---

## Key Metrics for Threading Visibility

### Active Handles (`nodejs_active_handles_total`)

**Long-lived objects** that keep the event loop alive. NOT "requests being handled now."

These are things the event loop is **watching**:

- Open TCP sockets (each connected client = 1 handle)
- Timers (`setTimeout`, `setInterval`)
- File watchers (`fs.watch`)
- The HTTP server itself (1 handle)
- Child processes, UDP sockets

**Example**: Express server with 50 active client connections + 3 `setInterval` timers ≈ 54 active handles.

### Active Requests (`nodejs_active_requests_total`)

**Pending async operations** queued in the **libuv thread pool** or kernel — work started but **not yet completed**:

- A `fs.readFile()` that hasn't returned yet
- A `dns.lookup()` in progress
- A `crypto.pbkdf2()` running
- A pending `zlib.gzip()` call

**This directly shows thread pool pressure.** If this stays near 4 (default pool size), the libuv thread pool is saturated.

---

## Diagnosing Saturation

### Is the main thread (event loop) saturated?

→ **Event Loop Lag** — if lag > 100ms, the main thread can't keep up

### Is the libuv thread pool saturated?

→ **Active Requests** — if consistently near `UV_THREADPOOL_SIZE` (default 4), threads are all busy and work is queuing

### How many things are keeping the loop alive?

→ **Active Handles** — high number means many open connections/timers (not necessarily bad, gives context)

### Is CPU actually saturated?

→ **CPU Usage** — if approaching 1.0 (100% of 1 core), the main thread is CPU-bound

---

## Saturation Pattern Cheat Sheet

```
Event Loop Lag ↑  +  CPU Usage ↑     → Main thread is CPU-bound (need worker_threads)
Event Loop Lag ↑  +  CPU Usage low   → Main thread is blocked by sync I/O or a slow callback
Active Requests ↑ +  Event Loop Lag ↑ → libuv thread pool is saturated (bump UV_THREADPOOL_SIZE)
Active Handles ↑  +  Everything fine  → Just lots of connections, no problem
```

---

## Metrics We Have vs What's Missing

### Already in `services.json`

| Panel                              | Status |
| ---------------------------------- | ------ |
| CPU Usage (stat + timeseries)      | ✅      |
| Heap Usage % (stat)                | ✅      |
| Heap Used vs Total (timeseries)    | ✅      |
| Event Loop Lag mean + p99          | ✅      |
| Active Handles & Requests          | ✅      |
| Resident Memory                    | ✅      |

### Missing (from Grafana Dashboard 11159)

| Panel                          | Why It Matters for Threading                                      |
| ------------------------------ | ----------------------------------------------------------------- |
| GC Duration by Type            | GC runs on main thread — shows stop-the-world pauses              |
| GC Pause P95                   | Quick stat to see if GC is impacting latency                      |
| Heap Space Breakdown           | V8 memory pressure (new_space, old_space) that triggers GC        |
| Event Loop Lag p50/p90/p99     | All percentiles together is more useful than just mean + p99      |
| External Memory                | C++ object memory (Buffers) — managed outside V8, relevant to libuv |
| Open File Descriptors          | Correlates with libuv thread pool activity (sockets, files)       |

All these metrics are already emitted by `collectDefaultMetrics()` — we just need the Grafana panels.

---

## Grafana Dashboard 11159

The community dashboard "Node.js Application Dashboard" (ID: 11159) covers all the above.
Rather than importing it as a separate dashboard (which duplicates what we have), the recommendation
is to add a `🧵 Node.js Runtime` row to `services.json` with only the missing panels listed above.

