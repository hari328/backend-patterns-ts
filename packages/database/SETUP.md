# Database Setup Guide

## 🚀 Quick Start

Follow these steps to set up the database with Snowflake IDs and seed data.

---

## Step 1: Install Dependencies

```bash
# From the root of the monorepo
npm install

# Or specifically for the database package
npm install --workspace=@repo/database
```

---

## Step 2: Start PostgreSQL

```bash
# Start PostgreSQL using Docker Compose
docker-compose up -d postgres

# Verify it's running
docker ps | grep postgres
```

---

## Step 3: Generate New Migration

Our schemas now use Snowflake IDs (BIGINT), so we need to generate a new migration:

```bash
# Generate migration for Snowflake ID changes
npm run db:generate --workspace=@repo/database
```

When prompted for a migration name, enter: `add-snowflake-ids`

---

## Step 4: Run Migrations

```bash
# Apply migrations to the database
npm run db:migrate --workspace=@repo/database

# OR use push for development (skips migration files)
npm run db:push --workspace=@repo/database
```

---

## Step 5: Seed the Database

```bash
# Insert 20 test users
npm run db:seed --workspace=@repo/database
```

You should see output like:

```
🌱 Seeding database...

🗑️  Clearing existing users...
✅ Cleared existing users

👥 Inserting 20 users...
   ✓ Created user: john_doe (175928847299117063)
   ✓ Created user: jane_smith (175928847299117064)
   ...

✅ Successfully seeded 20 users!

📊 Summary:
   Total users: 20
   Verified users: 10
   Regular users: 10

🎉 Seeding completed successfully!
```

---

## Step 6: Verify Data

```bash
# Open Drizzle Studio to view the data
npm run db:studio --workspace=@repo/database
```

Open your browser to `https://local.drizzle.studio` to see the seeded users.

---

## 📋 Available Scripts

| Script | Command | Description |
|--------|---------|-------------|
| Generate Migration | `npm run db:generate --workspace=@repo/database` | Create new migration file |
| Run Migrations | `npm run db:migrate --workspace=@repo/database` | Apply migrations to DB |
| Push Schema | `npm run db:push --workspace=@repo/database` | Push schema directly (dev only) |
| Seed Database | `npm run db:seed --workspace=@repo/database` | Insert test data |
| Drizzle Studio | `npm run db:studio --workspace=@repo/database` | Open database GUI |

---

## 🔧 Environment Variables

Create a `.env` file in `packages/database/`:

```bash
# Copy the example
cp packages/database/.env.example packages/database/.env

# Edit if needed (default values work for local development)
DATABASE_URL=postgres://postgres:postgres@localhost:7732/social_media_db
```

---

## 🎯 Next Steps

After seeding, you can:

1. **Build the posts service** - Use the seeded users to create posts
2. **Test queries** - Query users from your services
3. **Add more seed data** - Extend `src/seed.ts` to add posts, comments, etc.

---

## 🐛 Troubleshooting

### Database connection error

```bash
# Check if PostgreSQL is running
docker ps | grep postgres

# Check logs
docker logs <postgres-container-id>

# Restart PostgreSQL
docker-compose restart postgres
```

### Migration conflicts

```bash
# Reset database (WARNING: Deletes all data)
docker-compose down -v postgres
docker-compose up -d postgres

# Re-run migrations
npm run db:push --workspace=@repo/database
npm run db:seed --workspace=@repo/database
```

### TypeScript errors

```bash
# Rebuild the package
npm run build --workspace=@repo/database

# Check types
npm run check-types --workspace=@repo/database
```

---

## ✅ Success Checklist

- [ ] PostgreSQL is running
- [ ] Dependencies installed
- [ ] Migration generated and applied
- [ ] Database seeded with 20 users
- [ ] Drizzle Studio shows the data

You're ready to build the posts service! 🎉

