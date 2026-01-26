# Project Guidelines

---

## Bash Commands

- `npm run build --workspace=@repo/database` - Build the database package
- `npm run db:migrate --workspace=@repo/database` - Run database migrations
- `npm run db:seed --workspace=@repo/database` - Seed the database
- `npm run test:run --workspace=<service-name>` - Run tests for a service (omit -i flag)
- `docker-compose up -d postgres` - Start PostgreSQL (port 7732)

---

## Database

- **PostgreSQL Port**: 7732 (not default 5432)
- **ID Strategy**: Snowflake IDs - BIGINT in database (8 bytes), string in TypeScript
- **Migrations**: Forward-only (Drizzle doesn't support down migrations)
- **ORM**: Drizzle ORM (TypeScript-first)

---

## Architecture

### Repository Layer
- Simple, reusable CRUD operations
- NO business logic - keep it "dumb" and generic
- Use Drizzle ORM, not raw SQL
- For complex queries, use Drizzle QueryBuilder

### Service Layer
- All business logic lives here
- Orchestrates repository calls
- Mock repository layer in tests

### Controller Layer
- HTTP request/response handling
- Minimal logic - parse input, return JSON

---

## Code Style

- Follow ESLint conventions in this repository
- Use `Boolean()` over `!!`
- No single-letter variables
- Precise method names
- Use `date-fns` for all date manipulations (not lodash, moment, or dayjs)
- Use logger from `/packages/database/src/shared/utils/contextual-logger.ts`
- **NO comments above methods** - Write clear, self-documenting code with precise names
- **Comments only for critical info** - Reserve comments for non-obvious business logic or important warnings

---

## Testing

- **Repository tests**: SKIPPED for now (pg-mem incompatible with Drizzle ORM)
- **Service tests**: Mock the repository layer, test business logic
- **Test location**: Next to code (e.g., `posts.service.spec.ts` next to `posts.service.ts`)
- **Test only public methods**: Private methods tested indirectly
- **Omit `-i` flag**: When running tests with vitest

---

## Package Management

**IMPORTANT:** ALWAYS use package managers (npm, yarn, pnpm) for dependencies.

- ✅ DO: `npm install <package> --workspace=<workspace>`
- ❌ DON'T: Manually edit package.json

---

## Workflow

**IMPORTANT:** When asked to write code, follow this process:

1. **Discuss tests first** - Propose minimum unit tests needed (don't write code yet)
2. **Get approval** - Wait for confirmation on test approach
3. **Write tests** - Implement the agreed-upon tests
4. **Write code** - Make tests pass
5. **Refactor** - Remove duplication, add clarity (Kent Beck's rules)

---

## Design Principles

**Kent Beck's 4 Simple Rules of Design** (apply during refactoring):

1. Passes the tests
2. Reveals intention (clear, expressive code)
3. No duplication (DRY)
4. Fewest elements (keep it simple)

---

## PR Review Checklist

1. **DRY**: Am I duplicating access checks or QB filter blocks? Extract helpers.
2. **Queries**: Could this be `repository.find/findOneBy`? Remove manual `deletedAt` checks.
3. **Style**: Use `Boolean()` over `!!`; no single-letter vars; precise method names.
4. **Tests**: Assert seeded IDs, not counts; don't carry pg-mem workarounds into prod.
