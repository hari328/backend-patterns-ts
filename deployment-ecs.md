# ECS Services — Deep Dive

This document explains everything the ECS module does, how containers get their config, and how CI/CD deploys new code.

---

## 1. What Terraform Creates (per service)

Each service in the `services` map gets these 8 resources:

| # | Resource | What It Does |
|---|----------|-------------|
| 1 | **CloudWatch Log Group** | `/ecs/hari328-stage/posts-service` — container stdout/stderr goes here |
| 2 | **IAM Execution Role** | Used by the **ECS agent** (not your code) to pull images, write logs, read SSM |
| 3 | **IAM Task Role** | Used by **your container code** — SQS permissions, etc. |
| 4 | **Security Group** | Network rules: who can talk to the container, what the container can reach |
| 5 | **Target Group** | ALB sends traffic here, health checks `/health` every 30s |
| 6 | **ALB Listener Rule** | Path match: `/api/posts/*` → posts-service target group |
| 7 | **Task Definition** | Blueprint: which image, CPU/mem, env vars, secrets, ports, log config |
| 8 | **ECS Service** | Runs N copies of the task definition, handles rolling deploys |

---

## 2. Two IAM Roles — Why?

```
ECS Agent (AWS-managed)          Your Container Code
        |                                |
  Execution Role                    Task Role
        |                                |
  ┌─────┴─────┐                  ┌───────┴────────┐
  │ Pull ECR   │                  │ SQS Send/Recv  │
  │ Write Logs │                  │ (nothing else)  │
  │ Read SSM   │                  └────────────────┘
  └────────────┘
```

**Execution Role** (shared, same for all services):
- `ecr:GetAuthorizationToken` + `ecr:BatchGetImage` — pull Docker images
- `logs:CreateLogStream` + `logs:PutLogEvents` — write container logs
- `ssm:GetParameters` — fetch secrets referenced in task definition

**Task Role** (per service, different permissions):

| Service | Permissions | Why |
|---------|-------------|-----|
| posts-service | `sqs:SendMessage` | Publishes POST_CREATED events |
| recommender-service | `sqs:ReceiveMessage`, `sqs:DeleteMessage`, `sqs:ChangeMessageVisibility` | Consumes POST_CREATED events |

Your app code uses the AWS SDK with **no credentials configured** — on ECS, the SDK automatically picks up the Task Role via the container metadata endpoint.

---

## 3. How Env Vars Get Into Containers

Two mechanisms in the task definition:

### Plain values (`environment`) — non-sensitive, visible in console

```json
{ "name": "NODE_ENV", "value": "production" },
{ "name": "PORT",     "value": "3000" },
{ "name": "AWS_REGION", "value": "us-east-1" }
```

### SSM references (`secrets`) — resolved at container start, never visible in task def

```json
{ "name": "DATABASE_URL",              "valueFrom": "/app/db-readwrite-url" },
{ "name": "SQS_POSTS_STREAM_QUEUE_URL", "valueFrom": "/app/sqs-posts-stream-url" },
{ "name": "REDIS_URL",                  "valueFrom": "/app/redis-url" }
```

The ECS agent fetches the actual values from SSM Parameter Store when starting the container. Your code just reads `process.env.DATABASE_URL` as normal.

### Per-service env var map

| Env Var | posts-service | recommender-service | Source |
|---------|:---:|:---:|--------|
| `NODE_ENV` | `production` | `production` | plain |
| `PORT` | `3000` | `6000` | plain |
| `AWS_REGION` | `us-east-1` | `us-east-1` | plain |
| `DATABASE_URL` | ✅ | ✅ | SSM `/app/db-readwrite-url` |
| `SQS_POSTS_STREAM_QUEUE_URL` | ✅ | ✅ | SSM `/app/sqs-posts-stream-url` |
| `REDIS_URL` | — | ✅ | SSM `/app/redis-url` |

---

## 4. Network Flow (Security Groups)

```
Internet
    ↓
ALB (Layer 1 SG)
    ↓ inbound on container port (3000 or 6000)
ECS Task SG ←── allows ingress from ALB SG only
    ↓ outbound to:
    ├── RDS SG (port 5432)     ← DATABASE_URL
    ├── Redis SG (port 6379)   ← REDIS_URL
    └── 0.0.0.0/0 via NAT GW  ← SQS API calls (HTTPS to AWS endpoints)
```

The ECS tasks run in **private subnets**. They reach the internet (for SQS API) through the NAT Gateway from Layer 1.

---

## 5. ALB Routing

Layer 1 created the ALB with an HTTPS listener (default action: 404).

The ECS module adds **listener rules** on that existing listener:

```
HTTPS :443 (existing listener from Layer 1)
    │
    ├── Priority 100: /api/posts/*     → posts-service target group (port 3000)
    ├── Priority 200: /api/hashtags/*  → recommender-service target group (port 6000)
    │
    └── Default: 404 (from Layer 1)
```

Each target group health-checks `/health` on the container port.

---

## 6. CI/CD — What Happens When You Merge a PR

```
PR merged to main
       │
       ▼
┌──────────────────────────────────────────────────────┐
│  GitHub Actions Workflow                              │
│                                                       │
│  Step 1: Authenticate                                 │
│    └── OIDC → Assume IAM role in 550933156245         │
│                                                       │
│  Step 2: Build Docker images                          │
│    ├── docker build -f apps/posts-service/Dockerfile  │
│    └── docker build -f apps/recommender-service/...   │
│                                                       │
│  Step 3: Push to ECR                                  │
│    ├── tag: git SHA (abc1234) + latest                │
│    ├── 550933156245.dkr.ecr...../posts-service:abc1234│
│    └── 550933156245.dkr.ecr.../recommender-svc:abc1234│
│                                                       │
│  Step 4: Run DB migrations                            │
│    └── aws ecs run-task (one-shot)                    │
│        CMD override: npm run db:migrate               │
│        Waits for task to finish before continuing      │
│                                                       │
│  Step 5: Deploy services                              │
│    ├── Register new task definition (new image tag)   │
│    └── aws ecs update-service --force-new-deployment  │
│                                                       │
│  Step 6: ECS rolling deployment (automatic)           │
│    ├── Start new tasks with new image                 │
│    ├── ALB health check passes on /health             │
│    ├── Old tasks drain connections                    │
│    └── Old tasks stop — zero downtime                 │
└──────────────────────────────────────────────────────┘
```

### Key point: CI/CD never touches Terraform

Terraform creates the **infrastructure** once (task def, service, target group, IAM roles, etc.).

CI/CD only does **application deployments**:
1. Build new image → push to existing ECR repo
2. Register new task definition revision (same config, new image tag)
3. Tell ECS to deploy it

---

## 7. DB Migrations

Uses **ECS run-task** with a CMD override — no extra infrastructure needed:

```
aws ecs run-task \
  --cluster hari328-stage \
  --task-definition hari328-stage-posts-service \
  --overrides '{"containerOverrides": [{
    "name": "posts-service",
    "command": ["sh", "-c", "npm run db:migrate --workspace=@repo/database"]
  }]}' \
  --network-configuration '{...same private subnets and SG...}'
```

This runs the posts-service image but replaces the CMD. It has the same `DATABASE_URL` from SSM, same VPC access. The CI pipeline waits for this task to complete before deploying new service versions.

---

## 8. Terraform Module Dependencies

```
base-data ──→ vpc_id, private_subnet_ids, cluster_name, cluster_arn,
              alb_listener_arn, alb_security_group_id

ecr ────────→ repository_urls (map: service → ECR URL)

rds ────────→ db_readwrite_ssm_arn, db_readwrite_ssm_name
              db_security_group_id

sqs ────────→ queue_arn (for IAM policies)
              queue_ssm_url_arn (for execution role SSM read)

elasticache ─→ redis_url_ssm_arn, redis_url_ssm_name
               redis_security_group_id
```

All of these flow into the ECS module via Terragrunt `dependency` blocks.

---

## 9. First Deploy — Chicken and Egg

The ECS task definition needs an **image URI**, but on first `terragrunt apply` there's no image in ECR yet.

Solution: Set `desired_count = 0` initially. Terraform creates all the infrastructure but doesn't try to start any containers. The first CI/CD run pushes an image and sets `desired_count = 1`.

Alternatively: Push a dummy image to ECR before running the ECS module.

---

## 10. Deployed Outputs (from Batch 1)

These are the resources the ECS module will reference:

**RDS:**
- Endpoint: `hari328-stage.cqjkg6qq4hb9.us-east-1.rds.amazonaws.com`
- SG: `sg-0c27661f349032347`
- SSM: `/app/db-readwrite-url` (SecureString)

**SQS:**
- Queue ARN: `arn:aws:sqs:us-east-1:550933156245:hari328-stage-posts-stream`
- SSM: `/app/sqs-posts-stream-url`

**ElastiCache:**
- Endpoint: `hari328-stage.bhdzum.0001.use1.cache.amazonaws.com`
- SG: `sg-0b16def02e62f557a`
- SSM: `/app/redis-url`

**ECR:**
- posts-service: `550933156245.dkr.ecr.us-east-1.amazonaws.com/hari328-stage-posts-service`
- recommender-service: `550933156245.dkr.ecr.us-east-1.amazonaws.com/hari328-stage-recommender-service`

