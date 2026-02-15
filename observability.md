# Observability Stack

Three pillars of observability implemented as generic, reusable packages in `packages/`.

All packages are **infrastructure-agnostic** — they don't know about Loki, Prometheus, or Tempo. An agent (Grafana Alloy, Datadog Agent, etc.) handles shipping data to the backend. Swap the agent, app code never changes.

---

## Architecture

### How the three signals flow

```
App Container                          Agent Container                    Backend
─────────────                          ───────────────                    ───────
stdout (JSON logs)        ──→  Agent reads Docker logs     ──→  Loki (or Datadog Logs)
GET /metrics              ──→  Agent scrapes /metrics      ──→  Prometheus (or Datadog Metrics)
OTLP push to agent:4318   ──→  Agent receives traces       ──→  Tempo (or Datadog APM)
```

### Agent-based collection (Grafana Alloy / Datadog Agent)

The agent runs as a **Docker container** alongside your app containers — it is NOT installed on the EC2 machine. On ECS, it runs as a daemon service (`scheduling_strategy = "DAEMON"`), which tells ECS to place exactly one agent container on every EC2 instance in the cluster.

```
EC2 Instance (just a host that runs Docker containers)
│
│  The EC2 machine only has Docker + ECS agent on it (from the ECS-optimized AMI).
│  Everything else runs as containers that ECS places on the machine.
│
├── Docker Container: alloy (or datadog-agent)   ← ECS daemon scheduled this
├── Docker Container: posts-service              ← ECS scheduled this
└── Docker Container: recommender-service        ← ECS scheduled this
```

The agent container mounts the host's Docker socket (`/var/run/docker.sock`) as a volume, so it can read logs from the other containers on the same host.

When ASG adds a new EC2 instance, ECS automatically starts an agent container on it. When an instance is removed, the agent container goes with it.

### Switching agents (Alloy → Datadog or vice versa)

| Layer | Grafana Stack | Datadog | App code change? |
|---|---|---|---|
| Agent | Alloy ECS daemon | Datadog Agent ECS daemon | ❌ No |
| Logs | stdout → Alloy → Loki | stdout → DD Agent → Datadog | ❌ No |
| Metrics | /metrics → Alloy → Prometheus | /metrics → DD Agent → Datadog | ❌ No |
| Traces | OTLP → Alloy → Tempo | OTLP → DD Agent → Datadog APM | ❌ No |
| Visualization | Grafana (self-hosted) | Datadog UI (SaaS) | ❌ No |
| Terraform | Alloy daemon task definition | DD Agent daemon task definition | ❌ No |

---

## Packages

### `@repo/logger` — Structured JSON to stdout

**Libraries:** `winston`

| Export | Description |
|---|---|
| `createLogger(config)` | Factory returning a configured Winston logger |

- Writes structured JSON to **stdout** — the agent picks it up
- No direct connection to Loki or any backend

```typescript
import { createLogger } from '@repo/logger';

const logger = createLogger({
  service: 'posts-service',
  environment: 'development',
});

logger.info('Post created', { postId: '123', userId: '456' });
// → {"level":"info","message":"Post created","service":"posts-service","postId":"123","userId":"456","timestamp":"..."}
```

---

### `@repo/metrics` — Prometheus-format /metrics endpoint

**Libraries:** `prom-client`

| Export | Description |
|---|---|
| `metricsMiddleware()` | Express middleware — auto-tracks request duration (histogram) and count (counter) per route/method/status |
| `metricsEndpoint()` | Express route handler — exposes `/metrics` for agent scraping |
| `createMetricsRegistry(config)` | Factory for registering custom metrics |

```typescript
import { metricsMiddleware, metricsEndpoint } from '@repo/metrics';

app.use(metricsMiddleware());
app.get('/metrics', metricsEndpoint());
```

---

### `@repo/tracing` — OpenTelemetry traces via OTLP

**Libraries:** `@opentelemetry/sdk-node`, `@opentelemetry/exporter-trace-otlp-http`, `@opentelemetry/auto-instrumentations-node`

| Export | Description |
|---|---|
| `initTracing(config)` | Initializes OpenTelemetry SDK, exports traces via OTLP to the agent |

- **Auto-instrumentation** — traces HTTP, Express, and pg calls with zero code changes
- Must be called **before** any other imports (OpenTelemetry requirement)
- Pushes OTLP to a configurable endpoint (agent on port 4318)

```typescript
import { initTracing } from '@repo/tracing';

initTracing({
  serviceName: 'posts-service',
  otlpEndpoint: 'http://alloy:4318',
});

// all other imports AFTER this
import express from 'express';
```

---

## Local Development

Separate docker-compose file (`docker-compose.observability.yml`) to keep app dev simple.

```bash
# App development (existing docker-compose.yml)
docker-compose up -d postgres redis localstack

# Observability stack (separate file)
docker-compose -f docker-compose.observability.yml up -d
```

### Services

| Service | Port | Purpose |
|---|---|---|
| Alloy | 4318 (OTLP HTTP), 12345 (UI) | Collects logs, scrapes metrics, receives traces |
| Loki | 3100 | Log storage |
| Prometheus | 9090 | Metrics storage |
| Tempo | 3200 (API), 4317/4318 (OTLP) | Trace storage |
| Grafana | 3000 | Unified visualization (all 3 datasources auto-provisioned) |

### Config files

```
observability/
├── alloy-config.alloy                        # Alloy pipeline configuration
├── loki.yml                                  # Loki configuration
├── prometheus.yml                            # Prometheus scrape config
├── tempo.yml                                 # Tempo configuration
└── grafana/
    └── provisioning/
        └── datasources/
            └── datasources.yml               # Auto-provision Loki + Prometheus + Tempo
```

### Access

- **Grafana:** http://localhost:3000 (admin/admin)
- **Alloy UI:** http://localhost:12345
- **Prometheus:** http://localhost:9090
- **Loki:** http://localhost:3100
- **Tempo:** http://localhost:3200

---

## AWS Production (ECS on EC2)

### Alloy as ECS daemon service

```hcl
# In ecs-services Terraform module
resource "aws_ecs_service" "alloy" {
  name                = "alloy"
  cluster             = var.cluster_arn
  task_definition     = aws_ecs_task_definition.alloy.arn
  scheduling_strategy = "DAEMON"    # one container per EC2 host
}
```

The Alloy container mounts `/var/run/docker.sock` to read logs from all other containers on the host.

### Disable CloudWatch Logs

In the ECS service container definitions, replace the `awslogs` driver:

```hcl
# BEFORE (current — sends to CloudWatch)
enable_cloudwatch_logging   = true
create_cloudwatch_log_group = true

# AFTER (Alloy collects logs — no CloudWatch cost)
enable_cloudwatch_logging = false
log_configuration = {
  logDriver = "json-file"
  options = {
    "max-size" = "50m"
    "max-file" = "5"
  }
}
```

### Where do Loki / Tempo / Prometheus live?

| Option | Cost | Maintenance |
|---|---|---|
| **Grafana Cloud** (free tier: 50GB logs, 50GB metrics, 50GB traces/month) | Free to start | Zero |
| **Self-hosted** on ECS | EC2 cost only | You manage it |

---

## Infrastructure Metrics

Application metrics (HTTP requests, custom counters) come from your app's `/metrics` endpoint. Infrastructure metrics (CPU, memory, connections, queue depth) come from the services your app depends on.

### PostgreSQL and Redis — Alloy built-in exporters

Alloy has built-in exporters for PostgreSQL and Redis. No extra containers needed — the same Alloy daemon that collects app logs/metrics/traces also connects to your database and cache to pull infrastructure metrics.

```
App Cluster — EC2 Instance
├── Alloy (daemon)
│     ├── reads Docker logs from app containers          → Loki
│     ├── scrapes /metrics from app containers           → Prometheus
│     ├── receives OTLP traces from app containers       → Tempo
│     ├── built-in postgres exporter → connects to RDS   → Prometheus
│     └── built-in redis exporter → connects to ElastiCache → Prometheus
│
├── posts-service
└── recommender-service
```

| Alloy Component | Connects to | Metrics exposed |
|---|---|---|
| `prometheus.exporter.postgres` | RDS PostgreSQL | Active connections, query duration, rows returned, cache hit ratio, replication lag, dead tuples |
| `prometheus.exporter.redis` | ElastiCache Redis | Memory usage, connected clients, commands/sec, keyspace hits/misses, evictions |

These are configured in the Alloy config file — just point at the RDS/ElastiCache endpoint.

### AWS-managed services (EC2, SQS, ALB, ECS, etc.) — YACE

For metrics that only exist in CloudWatch (EC2 CPU, SQS queue depth, ALB request counts, etc.), we use **YACE (Yet Another CloudWatch Exporter)**.

YACE is a free, open-source Docker container (`ghcr.io/nerdswords/yet-another-cloudwatch-exporter`). It calls the AWS CloudWatch `GetMetricData` API on a schedule, converts the response to Prometheus format, and exposes it on `GET /metrics`.

```
YACE container ── calls CloudWatch API every 5 min ──→ CloudWatch
       │              (GetMetricData)                    (free metrics already collected by AWS)
       │
       └── exposes GET /metrics ──→ Prometheus scrapes this
             aws_ec2_cpuutilization_average{instance_id="i-abc123"} 45.2
             aws_sqs_approximate_number_of_messages_visible{queue_name="posts-stream"} 12
             aws_alb_request_count_sum{load_balancer="hari328-stage"} 1523
```

**Important distinction:**
- AWS **collects** infrastructure metrics to CloudWatch automatically and for free (EC2, RDS, SQS, ALB all do this)
- These are NOT the application CloudWatch Logs we're turning off (those cost $0.50/GB)
- YACE just **reads** these free metrics — the only cost is CloudWatch API calls ($0.01 per 1,000 metrics requested)

**Cost example** (scraping every 5 minutes, ~18 metrics across EC2/ALB/RDS/SQS/ElastiCache):

```
18 metrics × 12 scrapes/hr × 24 hr × 30 days = 155,520 API calls/month
155,520 / 1,000 × $0.01 = ~$1.56/month
```

### Where each component lives

YACE runs in the **base infra cluster** since it monitors AWS-level resources shared across all apps. Alloy runs in **each app's cluster** since it needs Docker socket access on the host.

```
Base Infra Cluster (shared)
├── Loki
├── Prometheus
├── Tempo
├── Grafana
└── YACE              ← pulls CloudWatch metrics for all AWS resources (~$1.56/month)

App Cluster (backend-patterns-ts)
├── Alloy (daemon)    ← app logs/metrics/traces + postgres/redis exporters

App Cluster (banking-app)
├── Alloy (daemon)    ← same
```

### Summary

| Infrastructure | How to monitor | Where it runs |
|---|---|---|
| PostgreSQL (RDS) | Alloy built-in `prometheus.exporter.postgres` | App cluster (Alloy daemon) |
| Redis (ElastiCache) | Alloy built-in `prometheus.exporter.redis` | App cluster (Alloy daemon) |
| SQS | App-level custom metrics via `prom-client` in `@repo/sqs-consumer` | App containers |
| EC2, ALB, ECS, NAT GW | YACE → reads from CloudWatch | Base infra cluster |

---

## Wiring into an app

```typescript
// src/index.ts
import { initTracing } from '@repo/tracing';
initTracing({ serviceName: 'posts-service', otlpEndpoint: 'http://alloy:4318' });

import express from 'express';
import { createLogger } from '@repo/logger';
import { metricsMiddleware, metricsEndpoint } from '@repo/metrics';

const logger = createLogger({ service: 'posts-service' });
const app = express();

app.use(metricsMiddleware());
app.get('/metrics', metricsEndpoint());

app.listen(6001, () => logger.info('Server started'));
```

