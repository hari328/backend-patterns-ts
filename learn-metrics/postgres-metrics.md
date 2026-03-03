# PostgreSQL Observability

## The 3 Layers

```
Layer 1 — Server-side    postgres_exporter → pg_* metrics (connections, cache, locks, vacuum)
Layer 2 — App pool       prom-client gauges (db_pool_active, db_pool_max)
Layer 3 — Query-level    OTel trace spans → Tempo spanmetrics (rate, errors, duration)
```

Debug order follows the correlation chain:

```
HTTP latency spike
  → pool_active high / approaching pool_max     [services dashboard]
    → connections idle in transaction            [postgres dashboard]
      → dead tuples rising on a specific table  [postgres dashboard]
        → seq scans on that table               [postgres dashboard]
          → slow span in trace                  [postgres dashboard RED section]
```

---

## Layer 1 — Server-side metrics (postgres_exporter)

These come for free once postgres_exporter is running. No code changes needed.

---

### 1. Connections

**Metrics:** `pg_stat_activity_count`, `pg_settings_max_connections`

**What it is:** Postgres has a hard limit on simultaneous connections (`max_connections`, default 100).
Every connection consumes ~5–10 MB of RAM regardless of whether it's doing anything.

**Key states on `pg_stat_activity_count{state}`:**

| state | meaning |
|---|---|
| `active` | running a query right now |
| `idle` | connected but doing nothing — app pool is not releasing connections |
| `idle in transaction` | started BEGIN, ran a query, never committed — **danger zone** |

**Why `idle in transaction` is dangerous:** It holds row locks and blocks VACUUM from cleaning
dead tuples. One forgotten transaction can stall an entire table.

**Dashboard query:** `sum(pg_stat_activity_count) / pg_settings_max_connections`

**Alert threshold:** >70% yellow, >90% red.

**Pattern to recognise:** `idle in transaction` going non-zero → your app forgot to commit/rollback somewhere.

---

### 2. Cache Hit Ratio

**Metrics:** `pg_stat_database_blks_hit`, `pg_stat_database_blks_read`

**What it is:** Postgres has a shared buffer cache (in RAM).
- `blks_hit` = page served from RAM cache
- `blks_read` = page had to be read from disk (100–1000× slower)

**Dashboard query:**
```
pg_stat_database_blks_hit / (pg_stat_database_blks_hit + pg_stat_database_blks_read)
```

**Alert threshold:** <99% is worth investigating; <95% is a problem.

**Pattern to recognise:** Cache hit drops → you're doing full table scans (missing index).
Correlate with the Seq Scans panel to confirm.

---

### 3. Dead Tuples & Vacuum

**Metrics:** `pg_stat_user_tables_n_dead_tup`, `pg_stat_user_tables_n_live_tup`

**What it is:** Postgres uses MVCC (Multi-Version Concurrency Control). When you UPDATE or DELETE
a row, the old version is not immediately removed — it becomes a "dead tuple". VACUUM is the
background process that cleans them up.

**Why it matters:** Dead tuples waste disk space and slow sequential scans (the scanner still
has to skip over dead rows). If VACUUM can't keep up — usually because an `idle in transaction`
connection is blocking cleanup — dead tuples pile up.

**Dashboard query:** `topk(5, pg_stat_user_tables_n_dead_tup)` broken down by table.

**Pattern to recognise:** A specific table's dead tuple count rising steadily → VACUUM is
blocked on that table → find the blocking `idle in transaction` connection.

---

### 4. Sequential vs Index Scans

**Metrics:** `pg_stat_user_tables_seq_scan`, `pg_stat_user_tables_idx_scan`

**What it is:**
- `seq_scan` — Postgres read every single row in the table to find matches
- `idx_scan` — Postgres used an index to jump directly to matching rows

**Why it matters:** Sequential scans on large tables are the #1 cause of slow queries.
One seq scan on a 1M-row table touches every page — hammers cache hit ratio, spikes duration.

**Dashboard query:**
```
sum(rate(pg_stat_user_tables_seq_scan[5m]))  # bad
sum(rate(pg_stat_user_tables_idx_scan[5m]))  # good
```

**Pattern to recognise:** Seq scans rising on a specific table → missing index.
Cross-reference with your RED trace spans to see which query is slow.

---

### 5. Locks

**Metric:** `pg_locks_count{mode}`

**What it is:** Postgres locks rows/tables during writes.

| mode | when it appears |
|---|---|
| `RowExclusiveLock` | normal UPDATE/DELETE — expected |
| `AccessShareLock` | SELECT — expected |
| `ShareLock` | FK constraint checks |
| `AccessExclusiveLock` | ALTER TABLE, VACUUM FULL — blocks everything |

**Pattern to recognise:** `AccessExclusiveLock` spike + latency spike = a migration or
`LOCK TABLE` is running. Every other query is queued behind it.

---

### 6. Deadlocks

**Metric:** `pg_stat_database_deadlocks`

**What it is:** Two transactions each hold a lock the other wants. Postgres detects this and
kills one with `ERROR: deadlock detected`.

**Why it matters:** Any deadlock = a request failed. They also indicate a design problem:
two code paths acquire the same rows in different orders.

**Dashboard query:** `rate(pg_stat_database_deadlocks[5m])`

**Target:** Zero. Any non-zero value is worth investigating.

---

### 7. Commits vs Rollbacks

**Metrics:** `pg_stat_database_xact_commit`, `pg_stat_database_xact_rollback`

**Why it matters:** `rollbacks/s > 0` means failed transactions. Small amounts are normal
(constraint violations, deadlocks). A sustained rollback rate means your app is frequently
doing work that then fails — wasted compute, dead tuples, held locks.

---

### 8. TX Wraparound Age

**Metric:** `pg_database_wraparound_age`

**What it is:** Postgres uses 32-bit transaction IDs. After ~2 billion transactions it wraps
around. Postgres forces aggressive autovacuum as you approach the limit. At 2B it shuts down
entirely until you run manual VACUUM.

**Alert thresholds:** >150M yellow, >1.5B red (emergency).

**In development:** Almost never an issue. In production under heavy write load, if autovacuum
is suppressed by long transactions, this can creep up.

---

### 9. Temp Files

**Metrics:** `pg_stat_database_temp_files`, `pg_stat_database_temp_bytes`

**What it is:** When a sort or hash operation doesn't fit in `work_mem` (default 4 MB per
query), Postgres spills to disk as a temp file.

**Pattern to recognise:** Temp files appearing → a query is doing a sort/join on too much
data without an index, or `work_mem` needs to be increased. Correlate with your RED
"Query Duration" panel to find which query is slow.

---

### 10. Checkpoints

**Metrics:** `pg_stat_bgwriter_checkpoints_timed`, `pg_stat_bgwriter_checkpoints_req`

**What it is:** Postgres periodically flushes dirty pages from RAM to disk (a checkpoint).
- `timed` = happened on schedule — normal, healthy
- `req` = postgres was forced to checkpoint early because WAL got too full — sign of write pressure

**Pattern to recognise:** `requested` > `timed` → write throughput is higher than Postgres
can absorb. Fix: increase `max_wal_size` or `checkpoint_completion_target`.

---

## Layer 2 — App pool metrics (prom-client)

**Metrics:** `{service}_db_pool_active`, `{service}_db_pool_max`

These are custom gauges tracked in `packages/database/src/pool-metrics.ts`.
They increment/decrement around every `execute()` call in `instrument-db.ts`.

**Why pool_active is often 0:** postgres.js queries complete in ~1–5 ms.
Prometheus scrapes every 15 s. Unless a query is in-flight during a scrape, active = 0.
This is healthy — it means your database is responding quickly.

**Dashboard:** Services dashboard → Connection Pool row.

---

## Layer 3 — Query-level (OTel spans → Tempo spanmetrics)

**Metrics generated from traces:**
- `traces_spanmetrics_calls_total{span_name=~"pg.*"}` — query rate
- `traces_spanmetrics_calls_total{status_code="STATUS_CODE_ERROR"}` — error rate
- `traces_spanmetrics_latency_bucket` — p50/p95/p99 duration

**Dashboard:** PostgreSQL dashboard → RED section.

These are the most actionable — they tell you exactly which query operation is slow or failing.

---

## Quick reference: what is red → what to check

| Symptom | First place to look |
|---|---|
| High HTTP latency | Pool active / pool max (services dashboard) |
| Pool approaching max | `idle in transaction` connections (postgres) |
| Rising dead tuples | Which table? Then find the blocking transaction |
| Low cache hit ratio | Which table has rising seq scans? → Missing index |
| Temp files appearing | Which query in RED spans is slow? → Missing sort index |
| Deadlocks | Two code paths locking same rows in different order |
| Forced checkpoints | Write throughput too high → tune `max_wal_size` |
| `AccessExclusiveLock` | Schema migration running → coordinate deploys |
