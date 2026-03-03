# Node.js Threading Model

Node.js is **not** single-threaded. The "single-threaded" label only applies to the **JavaScript execution** layer. Under the hood, Node.js uses multiple threads.

---

## The Architecture (3 Layers)

### 1. Main Thread (V8 JavaScript Engine)

- Executes your JavaScript code — callbacks, promises, async/await
- Runs the **event loop** (managed by `libuv`)
- If you block this thread (e.g., a massive `for` loop), the entire server stalls

### 2. libuv Thread Pool (Default: 4 threads)

Node.js delegates **blocking I/O** and **CPU-heavy C++ operations** to a pool of worker threads managed by `libuv`:

- **File system** operations (`fs.readFile`, `fs.writeFile`, etc.)
- **DNS lookups** (`dns.lookup()` — not `dns.resolve()`, which uses c-ares)
- **Crypto** operations (`crypto.pbkdf2`, `crypto.randomBytes`, `crypto.scrypt`)
- **Zlib** compression/decompression

You can increase the pool size via `UV_THREADPOOL_SIZE` (max 1024):

```bash
UV_THREADPOOL_SIZE=8 node app.js
```

If you have 4 concurrent `fs.readFile` calls, they run on 4 threads in parallel. A 5th call **queues** until a thread is free.

### 3. OS-Level Async (Kernel Threads)

Network I/O (`TCP`, `UDP`, `HTTP`) does **not** use the thread pool. Instead, libuv delegates to OS-level async mechanisms:

- **Linux**: `epoll`
- **macOS**: `kqueue`
- **Windows**: `IOCP`

This is why Node.js handles thousands of concurrent connections efficiently.

---

## Event Loop Phases

The event loop has 6 phases, executed in order each "tick":

```
   ┌───────────────────────────┐
┌─>│        timers              │  ← setTimeout, setInterval callbacks
│  └─────────────┬─────────────┘
│  ┌─────────────┴─────────────┐
│  │     pending callbacks      │  ← I/O callbacks deferred from previous tick
│  └─────────────┬─────────────┘
│  ┌─────────────┴─────────────┐
│  │       idle, prepare        │  ← internal use only
│  └─────────────┬─────────────┘
│  ┌─────────────┴─────────────┐
│  │          poll              │  ← retrieve new I/O events; execute I/O callbacks
│  └─────────────┬─────────────┘
│  ┌─────────────┴─────────────┐
│  │          check             │  ← setImmediate() callbacks
│  └─────────────┬─────────────┘
│  ┌─────────────┴─────────────┐
│  │     close callbacks        │  ← socket.on('close', ...)
│  └─────────────┘
│         │
│   process.nextTick() and
│   resolved Promises run
│   between EVERY phase
│         │
└─────────┘
```

---

## Worker Threads (Since Node.js 10.5+)

For **CPU-intensive JavaScript** work, Node.js provides the `worker_threads` module — real OS threads running separate V8 isolates:

- libuv threads run **C++ code** (internal Node operations)
- Worker threads run **your JavaScript** in isolated V8 instances
- Communication via message passing (`SharedArrayBuffer` or structured clone)

---

## Summary Table

| What               | Thread                    | Example                          |
| ------------------- | ------------------------- | -------------------------------- |
| Your JS code        | Main thread               | `app.get('/', handler)`          |
| Network I/O         | OS kernel (no thread)     | `http.get()`, TCP sockets        |
| File I/O            | libuv pool (4 threads)    | `fs.readFile()`                  |
| DNS lookup           | libuv pool                | `dns.lookup()`                   |
| Crypto              | libuv pool                | `crypto.pbkdf2()`               |
| Zlib                | libuv pool                | `zlib.gzip()`                    |
| CPU-heavy JS        | Worker thread (you create)| Image processing, parsing        |

---

## Practical Implications

1. **Thread pool starvation** — Many `fs` + `crypto` calls compete for the same 4 libuv threads. Bump `UV_THREADPOOL_SIZE` if I/O-heavy.
2. **Don't block the main thread** — A synchronous 500ms computation blocks every client. Use `worker_threads` for CPU work.
3. **Network scales naturally** — Network I/O uses OS-level async (not the thread pool), so Node.js handles tens of thousands of concurrent connections without more threads.
4. **`dns.lookup()` vs `dns.resolve()`** — `lookup` uses the thread pool (`getaddrinfo`), `resolve` uses c-ares (async). Under high concurrency, `lookup` can become a bottleneck.

