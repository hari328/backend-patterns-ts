# Integration Tests

Cross-service integration tests for the backend monorepo.

## Prerequisites

1. **Docker Compose services must be running:**
   ```bash
   docker-compose up -d
   ```

2. **Database must be seeded:**
   ```bash
   npm run db:seed --workspace=@repo/database
   ```

3. **Verify services are healthy:**
   ```bash
   docker-compose ps
   ```

## Running Tests

```bash
# From root
npm run test:integration --workspace=integration-tests

# Or from this directory
npm run test
```

## What These Tests Do

- Test full flow across multiple services
- Use real PostgreSQL, LocalStack SQS, Redis
- Verify end-to-end functionality

## Test Flow

1. Create posts via HTTP API (posts-service on localhost:6001)
2. Message sent to SQS (LocalStack)
3. Recommender service consumes message
4. Hashtags extracted and saved to database
5. Test verifies database state

## Test Structure

```
src/
├── test-utils/
│   ├── db-helpers.ts       # Database connection & cleanup
│   └── wait-helpers.ts     # Polling utilities
└── posts-hashtags-flow.integration.spec.ts
```

## Troubleshooting

### Tests timeout
- Check if recommender-service is running: `docker-compose ps`
- Check logs: `docker-compose logs recommender-service`
- Check SQS queue: `docker-compose logs localstack`

### User not found error
- Run seeds: `npm run db:seed --workspace=@repo/database`
- Verify user exists: Connect to PostgreSQL and check `users` table

### Connection refused
- Ensure PostgreSQL is running on port 7732
- Ensure posts-service is running on port 6001
- Check: `docker-compose ps`

## Adding New Integration Tests

1. Create a new file: `src/{feature}-flow.integration.spec.ts`
2. Follow the same pattern:
   - `beforeAll`: Connect to DB
   - `beforeEach`: Clean test data
   - Test: Create → Wait → Verify
   - `afterAll`: Close connection

