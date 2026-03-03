import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { instrumentDb } from './instrument-db';
import * as schema from './schema';

function getDatabaseConfig() {
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }

  const host = process.env.DB_HOST || 'localhost';
  const port = process.env.DB_PORT || '7732';
  const database = process.env.DB_NAME || 'social_media_db';
  const user = process.env.DB_USER || 'postgres';
  const password = process.env.DB_PASSWORD || 'postgres';

  return `postgres://${user}:${password}@${host}:${port}/${database}`;
}

const connectionString = getDatabaseConfig();

export const DB_POOL_MAX = parseInt(process.env.DB_POOL_MAX || '10');

const client = postgres(connectionString, {
  max: DB_POOL_MAX,
  idle_timeout: parseInt(process.env.DB_IDLE_TIMEOUT || '20'),
  connect_timeout: parseInt(process.env.DB_CONNECT_TIMEOUT || '10'),
});

export const db = drizzle(client, { schema });
instrumentDb(db);

export { schema };
export type Database = typeof db;

