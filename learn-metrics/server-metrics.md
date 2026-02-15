# 📐 Backend Observability — 4-Layer Model

Engineer order: infra up → app → deps → business. Debug order: reverse.

---

## 1️⃣ ⚙️ USE — Resource Health

**U**tilization · **S**aturation · **E**rrors — Brendan Gregg. Ask 3 questions for every resource.

| Resource | U | S | E | 🚨 |
|---|---|---|---|---|
| 🖥️ CPU | `process_cpu_*` | Event loop lag | — | >80% / lag >100ms |
| 🧠 Memory | `resident_memory_bytes` | Heap used→limit | OOM kills | Heap >80% limit |
| 💾 Disk | Usage % | I/O wait | R/W errors | >80% |
| 🌐 Network | Bytes in/out | Conn queue depth | Timeouts | Spike detection |
| 📂 File descriptors | `open_fds / max_fds` | — | Silent conn failures | Ratio >0.8 |

> 💡 Disk & network → infra (CloudWatch). The rest → app `/metrics`.

### Runtime USE cheat sheet

| | 🔄 Pipeline backed up? | 🧠 Memory efficient? | 🗑️ GC latency? |
|---|---|---|---|
| **Node.js** | Event loop lag | Heap used vs total | GC duration |
| **JVM** | Thread pool saturation | Heap generations | GC pause time |
| **Go** | Goroutine count | Heap alloc | STW pause |
| **Python** | Event loop lag (asyncio) | Object count | GC gen counts |
| **.NET** | Thread pool queue | Gen0/1/2 heap | GC collection count |

---

## 2️⃣ 🔴 RED — Application Health

**R**ate · **E**rrors · **D**uration — Tom Wilkie. For every endpoint.

| Signal | Metric | 🚨 |
|---|---|---|
| 📈 Rate | `http_requests_total` | Sudden drop → upstream broke |
| ❌ Errors | `5xx / total` | >1% warn · >5% crit |
| ⏱️ Duration | `http_request_duration_seconds` p50/p95/p99 | P95 >500ms warn · >1s crit |

> ⚠️ Break RED down **by route**. Global P95 200ms hides `/posts` 50ms + `/search` 2s.

### How we get RED

Two approaches — pick one:

| Approach | How | Pros | Cons |
|---|---|---|---|
| 🔧 Prometheus middleware | `prom-client` histogram in Express middleware | Full control, custom buckets | Manual code per service |
| 🔭 OTel auto-instrumentation | `@opentelemetry/instrumentation-http` | Zero code, also gives traces | Need OTel SDK setup |

---

## 3️⃣ 🔗 Dependency Health — via Traces

Your service is only as fast as its slowest dependency. **Use distributed tracing (OTel → Tempo)** instead of manual metrics wrapping.

| Dependency | OTel auto-instrumentation | What spans give you |
|---|---|---|
| 🐘 Database | Drizzle built-in spans (`drizzle.execute`) | Query duration, errors, SQL text |
| 🔴 Redis | `@opentelemetry/instrumentation-ioredis` | Command duration, errors |
| 📨 SQS | `@opentelemetry/instrumentation-aws-sdk` | Publish/receive duration, errors |
| 🌐 HTTP calls | `@opentelemetry/instrumentation-http` | Outbound call duration, status |

> 💡 Infra exporters (Alloy postgres/redis exporter) say the DB is fine from *its* side.
> Trace spans say how long *your service* waited — pool exhaustion, network latency, timeouts.

### Why traces > manual dep metrics

| | Manual metrics | Traces |
|---|---|---|
| Setup | Wrap every client call | One SDK init, zero per-dep code |
| Duration | ✅ | ✅ (span start→end) |
| Errors | ✅ | ✅ (span status + exception events) |
| Breakdown | ❌ | ✅ (parent→child spans show where time went) |
| Cross-service | ❌ | ✅ (trace propagation) |

---

## 4️⃣ 📊 Business Metrics

Domain-specific. What your product team cares about. **Always custom code.**

| Type | Example |
|---|---|
| 📝 Entity creation | `posts_created_total`, `posts_with_hashtags_total` |
| 💰 Conversions | Signups/sec, purchases/sec |
| 🎯 Feature usage | API calls to specific features |
| 🚫 Business errors | "Post rejected: user banned" (not 5xx, but product failure) |

> 💡 `posts_created_total` dropping to zero is more meaningful than any CPU or latency alert.

---

## 🔍 Debug Flow (top-down)

```
📉 Biz: posts_created_total → 0
  → 🔴 RED: error rate spiked 100%
    → 🔗 Trace: DB span 30s, timeout
      → ⚙️ USE: event loop lag 25s, pool exhausted
```

---

## 📋 Cheat Sheet

| Layer | Framework | Tool | Answers |
|---|---|---|---|
| ⚙️ USE | Brendan Gregg | Prometheus + prom-client | Is the machine healthy? |
| 🔴 RED | Tom Wilkie | Prometheus or OTel | Is the service healthy? |
| 🔗 Deps | — | OTel traces → Tempo | Are the things I call healthy? |
| 📊 Biz | — | Prometheus (custom counters) | Is the product working? |