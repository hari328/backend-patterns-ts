# Deployment Retrospective — Stage Environment

## Timeline of Issues

### 1. Docker build failure
- **Problem:** `npm run build` in the Dockerfile only built the service, not shared workspace packages (`@repo/database`, etc.)
- **Fix:** Changed to `npx turbo build --filter=<service-name>` so Turborepo builds all dependencies

### 2. Build workflow not triggering
- **Problem:** Changes to `.github/workflows/**` didn't trigger the build
- **Fix:** Added `.github/workflows/**` to the `paths` filter in the workflow

### 3. drizzle-kit mkdir crash (misdiagnosed)
- **Problem:** `drizzle-kit migrate` tried to create `/root/.local/share/drizzle-studio` and failed with `ENOENT`
- **What we thought:** Parent directory `/root/.local/share` didn't exist. Added `mkdir -p` to Dockerfile and migration command override
- **Actual root cause:** `readonlyRootFilesystem: true` — a default from the `terraform-aws-modules/ecs` community module. No amount of `mkdir` works on a read-only filesystem
- **Lesson:** We spent multiple deploy cycles on `mkdir` workarounds when the real issue was a Terraform module default

### 4. Old image used for migration
- **Problem:** Workflow ran migration using the old task definition (old image) instead of the newly built one
- **Fix:** Restructured workflow to register the new task definition before running the migration task

### 5. Shell quoting / JSON issues in workflow
- **Problem:** Multiple failures from shell quoting when building JSON for `aws ecs register-task-definition` and command overrides
- **Fix:** Rewrote the entire workflow using official AWS GitHub Actions (`amazon-ecs-render-task-definition@v1` + `amazon-ecs-deploy-task-definition@v2`), cutting from 191 lines to 99

### 6. readonlyRootFilesystem: true (real root cause of #3)
- **Problem:** The `terraform-aws-modules/ecs` community module defaults `readonlyRootFilesystem` to `true`
- **Fix:** Added `readonly_root_filesystem = false` in `terraform/modules/ecs-services/main.tf`
- **Lesson:** Always check module defaults — we were debugging a symptom (`mkdir` failing) instead of the cause (read-only filesystem)

### 7. SSL — no encryption rejected
- **Problem:** After filesystem fix, migration connected to RDS without SSL. RDS requires encrypted connections
- **Error:** `no pg_hba.conf entry for host... no encryption`
- **Fix:** Added `?sslmode=require` to `DATABASE_URL` in SSM parameter `/app/db-readwrite-url`

### 8. SSL — self-signed certificate
- **Problem:** `sslmode=require` made the `pg` driver do full certificate verification. RDS uses Amazon's CA which Node.js doesn't trust by default
- **Error:** `SELF_SIGNED_CERT_IN_CHAIN`
- **Fix:** Changed to `?sslmode=no-verify` — encrypts connection but skips cert verification

### 9. ALB routing — paths not matching
- **Problem:** ALB path pattern `/api/posts/*` requires at least one character after the slash. `POST /api/posts` (exact) returned ALB 404. `/api/users` and `/health` had no rules at all
- **Fix:** Updated path patterns to include both exact and wildcard: `["/api/posts", "/api/posts/*", "/api/users", "/api/users/*", "/health"]`

### 10. postgres.js doesn't understand sslmode=no-verify
- **Problem:** `drizzle-kit` (pg driver) handles `sslmode=no-verify` fine. But the app runtime uses `postgres` (postgres.js) which does NOT parse `sslmode` from the URL. Running services got `SELF_SIGNED_CERT_IN_CHAIN` on every DB query, returning 500 on all endpoints
- **Fix:** Added `NODE_TLS_REJECT_UNAUTHORIZED=0` as environment variable in task definition via Terraform

### 11. Terraform plan vs apply confusion
- **Problem:** After adding the env var to `terragrunt.hcl`, the first `terragrunt apply` only showed a plan (not confirmed). We force-deployed ECS thinking it was applied, but old task definition (without env var) kept running
- **Fix:** Actually confirmed the apply, creating new task definition revisions, and ECS rolled out new tasks automatically

## Key Takeaways

1. **Check module defaults** — the `readonlyRootFilesystem: true` default cost us the most time
2. **Different libraries handle SSL differently** — `drizzle-kit` (pg driver) vs `postgres.js` have different SSL behaviors with the same connection string
3. **ALB wildcard `*` means "one or more"** — not "zero or more", so exact paths need separate rules
4. **Always verify Terraform actually applied** — a plan is not an apply

