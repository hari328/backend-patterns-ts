import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

/**
 * Database configuration
 *
 * Supports two modes:
 * 1. DATABASE_URL - Single connection string (recommended)
 * 2. Individual env vars - DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD
 */
function getDatabaseConfig() {
  // Approach 1: Use DATABASE_URL if provided (recommended)
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }

  // Approach 2: Build connection string from individual env vars
  const host = process.env.DB_HOST || 'localhost';
  const port = process.env.DB_PORT || '7732';
  const database = process.env.DB_NAME || 'social_media_db';
  const user = process.env.DB_USER || 'postgres';
  const password = process.env.DB_PASSWORD || 'postgres';

  return `postgres://${user}:${password}@${host}:${port}/${database}`;
}

// Get database connection string
const connectionString = getDatabaseConfig();

// Create postgres client
const client = postgres(connectionString, {
  max: parseInt(process.env.DB_POOL_MAX || '10'), // Maximum number of connections
  idle_timeout: parseInt(process.env.DB_IDLE_TIMEOUT || '20'), // Close idle connections after N seconds
  connect_timeout: parseInt(process.env.DB_CONNECT_TIMEOUT || '10'), // Connection timeout in seconds
});

// Create drizzle instance
export const db = drizzle(client, { schema });

// Export schema for use in services
export { schema };

// Export types
export type Database = typeof db;

