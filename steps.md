## Observability Plan

Learning observability by building it from scratch — structured logging, metrics, and distributed tracing for a Node.js monorepo running on ECS.

---

## Phase 1 — Build the packages (no infra needed to verify)

### Step 1: `@repo/logger` — Structured JSON logging to stdout

**What we're building:** A Winston-based logger that writes structured JSON to stdout. No connection to Loki or any backend — the agent handles shipping.

**Why stdout and not direct-to-Loki:**
- Infrastructure-agnostic — swap Alloy for Datadog Agent, zero code change
- Docker already captures stdout to disk (`json-file` driver), so logs survive agent crashes
- Every container platform (ECS, Kubernetes, Lambda) knows how to collect stdout

**Key concepts to learn:**
- Structured logging vs unstructured (`console.log("something happened")` vs `{"level":"info","message":"Post created","postId":"123"}`)
- Why JSON format matters — agents and backends can parse, index, and filter on fields
- Log levels: `error` > `warn` > `info` > `debug` — production typically runs at `info`, local dev at `debug`
- Winston transports — we only use Console transport (stdout). In other setups you might add file, HTTP, or Loki transports

**Deliverables:**
- [ ] `packages/logger/` — package.json, tsconfig.json, vitest.config.mts
- [ ] `src/logger.ts` — `createLogger()` factory
- [ ] Unit tests for logger
- [ ] Wire into `posts-service` — replace existing console.log/logger calls

**How to verify (no docker-compose needed):**
```bash
npm run dev --workspace=posts-service
# Hit an endpoint, check terminal output is structured JSON:
# {"level":"info","message":"Post created","service":"posts-service","postId":"123","timestamp":"2024-..."}
```

---

### Step 2: `@repo/metrics` — Prometheus-format /metrics endpoint

**What we're building:** Express middleware that auto-tracks HTTP request metrics + a `/metrics` endpoint that exposes them in Prometheus text format. The agent (or Prometheus directly) scrapes this endpoint.

**Why Prometheus format:**
- Industry standard — every monitoring tool understands it (Prometheus, Datadog, Grafana, New Relic)
- Pull-based model — the agent/Prometheus comes to you, your app doesn't need to know where to push
- Human-readable — `curl localhost:6001/metrics` shows plain text you can read

**Key concepts to learn:**
- **Metric types:**
  - **Counter** — only goes up (e.g., `http_requests_total`, `errors_total`). Reset on restart.
  - **Gauge** — goes up and down (e.g., `active_connections`, `memory_usage_bytes`)
  - **Histogram** — measures distributions (e.g., `http_request_duration_seconds`). Gives you p50, p95, p99 for free.
  - **Summary** — similar to histogram but calculated client-side. Less common.
- **Labels** — dimensions on a metric. `http_requests_total{method="GET", route="/posts", status="200"}`. Powerful but cardinality matters (don't use userId as a label).
- **Cardinality** — unique combinations of label values. High cardinality = expensive storage. `method × route × status` = manageable. `method × route × status × userId` = explosion.
- **`prom-client`** — the Node.js Prometheus client library. Has `collectDefaultMetrics()` for Node.js internals (event loop lag, heap size, GC duration).

**Deliverables:**
- [ ] `packages/metrics/` — package.json, tsconfig.json, vitest.config.mts
- [ ] `src/middleware.ts` — Express middleware for HTTP request tracking
- [ ] `src/metrics-endpoint.ts` — Express handler for `GET /metrics`
- [ ] `src/registry.ts` — factory for custom metrics
- [ ] Unit tests
- [ ] Wire into `posts-service`

**How to verify (no docker-compose needed):**
```bash
npm run dev --workspace=posts-service
curl http://localhost:6001/posts    # generate some traffic
curl http://localhost:6001/metrics  # see Prometheus output:
# http_request_duration_seconds_bucket{method="GET",route="/posts",status="200",le="0.1"} 3
# http_request_duration_seconds_count{method="GET",route="/posts",status="200"} 3
# http_request_duration_seconds_sum{method="GET",route="/posts",status="200"} 0.045
```

---

### Step 3: `@repo/tracing` — OpenTelemetry traces via OTLP

**What we're building:** OpenTelemetry SDK initialization that auto-instruments HTTP, Express, and pg (PostgreSQL) calls. Exports traces via OTLP protocol to the agent.

**Why OpenTelemetry:**
- Vendor-neutral standard — works with Tempo, Jaeger, Zipkin, Datadog, New Relic, etc.
- Auto-instrumentation — wraps HTTP, Express, pg, Redis libraries automatically, zero code changes needed
- OTLP protocol — one wire format that every backend understands

**Key concepts to learn:**
- **Trace** — the full journey of a request across services (e.g., API call → database query → cache lookup → SQS publish)
- **Span** — a single unit of work within a trace (e.g., "POST /posts handler" is one span, "SELECT * FROM posts" is another)
- **Trace ID** — unique ID shared by all spans in a trace. This is how you correlate a frontend click → API call → DB query
- **Span ID + Parent Span ID** — forms the tree structure within a trace
- **Context propagation** — how trace ID travels between services. HTTP header `traceparent: 00-<traceId>-<spanId>-01` is the W3C standard
- **Auto-instrumentation vs manual spans** — auto covers HTTP/Express/pg. For custom business logic (e.g., "process payment"), you add manual spans
- **Must initialize BEFORE other imports** — OpenTelemetry monkey-patches `http`, `express`, `pg` modules. If they're imported first, the patching misses them

**Deliverables:**
- [ ] `packages/tracing/` — package.json, tsconfig.json, vitest.config.mts
- [ ] `src/tracing.ts` — `initTracing()` factory
- [ ] Unit tests
- [ ] Wire into `posts-service` (as the very first import)

**How to verify (no docker-compose needed):**
```bash
npm run dev --workspace=posts-service
# App should boot without errors. Traces won't go anywhere yet (no collector),
# but OpenTelemetry SDK is designed to fail silently — no impact on the app.
# Console may show: "Failed to export spans" — that's expected, Alloy isn't running yet.
```

---

## Phase 2 — Observability infrastructure + verify logs and metrics

### Step 4: `docker-compose.observability.yml` + config files

**What we're building:** A separate docker-compose file with the full Grafana stack (Alloy, Loki, Prometheus, Tempo, Grafana) and all config files.

**Why separate from app docker-compose:**
- Keep app dev simple — `docker-compose up -d postgres redis` is fast
- Observability stack is optional for app development
- Different lifecycle — you might restart observability without touching app containers

**Key concepts to learn:**
- **Alloy pipeline** — Alloy is configured as a series of components: source → processing → destination. E.g., `loki.source.docker` → `loki.write` sends Docker logs to Loki.
- **Grafana datasource provisioning** — Grafana can auto-configure datasources from a YAML file on startup. No manual clicking in the UI.
- **Docker networking** — the observability compose joins the same `app-network` as the app compose, so Alloy can reach app containers.

**Deliverables:**
- [ ] `docker-compose.observability.yml`
- [ ] `observability/alloy-config.alloy` — Alloy pipeline (Docker logs → Loki, scrape /metrics → Prometheus remote write, OTLP receiver → Tempo)
- [ ] `observability/loki.yml`
- [ ] `observability/prometheus.yml`
- [ ] `observability/tempo.yml`
- [ ] `observability/grafana/provisioning/datasources/datasources.yml`

**How to verify:**
```bash
# Start app infrastructure
docker-compose up -d postgres redis localstack

# Start observability stack
docker-compose -f docker-compose.observability.yml up -d

# Confirm all containers healthy
docker-compose -f docker-compose.observability.yml ps

# Access UIs
# Grafana: http://localhost:3000 (admin/admin) — should show 3 datasources
# Alloy:   http://localhost:12345 — should show pipeline components
# Prometheus: http://localhost:9090 — should show targets
```

---

### Step 5: Verify logs end-to-end (app → Alloy → Loki → Grafana)

**What we're verifying:** Structured JSON logs from `posts-service` flow through Alloy into Loki, and we can query them in Grafana.

**Key concepts to learn:**
- **Log pipeline in Alloy:**
  1. Alloy reads Docker container logs via Docker socket
  2. Logs are JSON — Alloy can extract fields (`level`, `message`, `service`, etc.) as labels
  3. Labels become queryable in Loki (`{service="posts-service"} | level="error"`)
- **LogQL** — Loki's query language. Similar to PromQL but for logs:
  - `{service="posts-service"}` — all logs from posts-service
  - `{service="posts-service"} |= "error"` — logs containing "error"
  - `{service="posts-service"} | json | level="error"` — parse JSON, filter by level field
- **Labels vs parsed fields** — Loki indexes labels (fast filter), but does full-text search on content. Keep label cardinality low.
- **Log parsing** — if JSON fields aren't automatically extracted as labels, we configure Alloy's processing stage to do it

**Steps:**
- [ ] Start posts-service (with `@repo/logger` wired in)
- [ ] Hit some endpoints to generate logs
- [ ] Open Grafana → Explore → select Loki datasource
- [ ] Query: `{container_name=~".*posts.*"}` — do logs show up?
- [ ] Check if JSON fields (level, message, service) are parsed as labels
- [ ] If not, tweak Alloy config to add JSON parsing stage
- [ ] Try filtering: `{service="posts-service"} | json | level="error"`

---

### Step 6: Add and verify metrics (system, service, business)

**What we're verifying:** Metrics from `posts-service` are scraped by Alloy, stored in Prometheus, and queryable in Grafana.

**Three categories of metrics:**

**System metrics** — Node.js runtime health. Comes free from `prom-client`'s `collectDefaultMetrics()`:
- `process_cpu_seconds_total` — CPU usage
- `nodejs_heap_size_used_bytes` — memory usage
- `nodejs_eventloop_lag_seconds` — event loop health (if this spikes, your app is blocked)
- `nodejs_active_handles_total` — open file descriptors, sockets, etc.

**Service metrics** — HTTP layer. Comes from our middleware:
- `http_request_duration_seconds` — histogram with method, route, status labels
- `http_requests_total` — counter of all requests

**Business metrics** — domain-specific. We add these manually in app code:
- `posts_created_total` — how many posts created
- `sqs_messages_processed_total{handler="post-created"}` — messages consumed
- `sqs_message_processing_duration_seconds` — how long each message takes

**Key concepts to learn:**
- **PromQL** — Prometheus query language:
  - `rate(http_requests_total[5m])` — requests per second over last 5 min
  - `histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))` — p95 latency
  - `increase(posts_created_total[1h])` — posts created in last hour
- **rate() vs increase()** — `rate()` gives per-second average, `increase()` gives total increase over a window
- **Scrape interval** — how often Prometheus/Alloy hits `/metrics`. Typically 15s or 30s. Shorter = more data points = more storage.

**Steps:**
- [ ] Confirm Alloy is scraping posts-service `/metrics` (check Alloy UI → targets)
- [ ] Open Grafana → Explore → select Prometheus datasource
- [ ] Query system metrics: `nodejs_heap_size_used_bytes`
- [ ] Query service metrics: `rate(http_request_duration_seconds_count[5m])`
- [ ] Add business metrics to posts-service using `@repo/metrics` registry
- [ ] Query business metrics: `increase(posts_created_total[1h])`

---

## Phase 3 — Verify traces end-to-end

### Step 7: Verify traces (app → Alloy → Tempo → Grafana)

**What we're verifying:** Distributed traces from `posts-service` flow through Alloy into Tempo, and we can visualize the full request lifecycle in Grafana.

**Key concepts to learn:**
- **Trace waterfall view** — Grafana shows spans as a waterfall (timeline). You see exactly where time is spent:
  ```
  POST /posts (120ms)
  ├── middleware (2ms)
  ├── validate input (1ms)
  ├── INSERT INTO posts (45ms)    ← pg auto-instrumented
  ├── publish to SQS (30ms)       ← HTTP auto-instrumented
  └── serialize response (1ms)
  ```
- **Trace-to-logs correlation** — if the logger includes the trace ID in log output, you can click from a trace span directly to the matching log lines in Loki. This is incredibly powerful for debugging.
- **Trace-to-metrics correlation** — Tempo can generate metrics from traces (RED metrics: Rate, Errors, Duration). This means traces aren't just for debugging — they feed your dashboards too.
- **Sampling** — in production, you don't trace every request (too expensive). Common strategies:
  - Head sampling: decide at the start (e.g., trace 10% of requests)
  - Tail sampling: decide after the trace completes (e.g., always keep traces with errors or slow spans)

**Steps:**
- [ ] Confirm Alloy is receiving OTLP from posts-service (check Alloy UI)
- [ ] Hit `POST /posts` to generate a trace with multiple spans
- [ ] Open Grafana → Explore → select Tempo datasource
- [ ] Search by service name: `posts-service`
- [ ] Click a trace — verify you see the waterfall with HTTP + pg spans
- [ ] Check if trace ID appears in the structured logs (trace-to-log correlation)
- [ ] If not, configure logger to include trace context from OpenTelemetry

---

## What's NOT in scope (but good to know exists)

| Topic | Why it matters | When to tackle |
|---|---|---|
| **Grafana dashboards** | Pre-built dashboards for Node.js, PostgreSQL, Redis | After Phase 3 — once data flows, build dashboards |
| **Alerting** | Grafana alerting rules (e.g., error rate > 5%, p99 latency > 2s) | After dashboards — you need to know what "normal" looks like first |
| **SQS consumer metrics** | Custom prom-client metrics in `@repo/sqs-consumer` | During Phase 2 Step 6 (business metrics) or after |
| **Alloy PostgreSQL/Redis exporters** | Infrastructure metrics from Alloy built-in exporters | After Phase 3 — add to Alloy config |
| **YACE for CloudWatch** | AWS infrastructure metrics (EC2, ALB, SQS) in Prometheus | Production only — not needed for local dev |
| **Trace sampling** | Reduce trace volume in production | When trace storage costs matter |
| **Log-based metrics** | Extract metrics from log patterns (e.g., count errors per endpoint) | When you want metrics without code changes |
