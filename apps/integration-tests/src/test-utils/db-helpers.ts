import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { eq } from 'drizzle-orm';
import * as schema from '@repo/database/schema';
import { posts, hashtags, postsHashtags, users } from '@repo/database/schema';

let pool: Pool | null = null;
let db: any = null;

/**
 * Connect to PostgreSQL running in Docker Compose or CI
 * Uses environment variables for configuration, with defaults for local development
 */
export async function connectToDockerDB() {
  if (db) return db;

  pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: Number.parseInt(process.env.DB_PORT || '7732', 10),
    database: process.env.DB_NAME || 'social_media_db',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
  });

  db = drizzle(pool, { schema });
  return db;
}

/**
 * Clean test data between tests
 * Note: We DON'T delete users (they come from seeds)
 */
export async function cleanTestData(db: any) {
  await db.delete(postsHashtags);
  await db.delete(hashtags);
  await db.delete(posts);
}

/**
 * Close database connection
 */
export async function closeDB() {
  if (pool) {
    await pool.end();
    pool = null;
    db = null;
  }
}

/**
 * Get a test user from seeds
 */
export async function getTestUser(db: any) {
  const user = await db.query.users.findFirst({
    where: eq(users.username, 'john_doe'),
  });
  
  if (!user) {
    throw new Error('Test user not found. Did you run seeds?');
  }
  
  return user;
}

