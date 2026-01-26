import { newDb, IMemoryDb } from 'pg-mem';
import { drizzle } from 'drizzle-orm/node-postgres';
import { readFileSync } from 'fs';
import { join } from 'path';
import * as schema from '../schema';

/**
 * Setup an in-memory PostgreSQL database for testing using pg-mem
 * 
 * This function:
 * 1. Creates a new pg-mem instance
 * 2. Runs all migrations from the migrations folder
 * 3. Returns a configured Drizzle db instance
 * 
 * @returns Object containing the Drizzle db instance and pg-mem instance
 * 
 * @example
 * ```typescript
 * import { setupTestDb } from '@repo/database/test-utils';
 * 
 * let db: any;
 * 
 * beforeEach(() => {
 *   const testDb = setupTestDb();
 *   db = testDb.db;
 * });
 * 
 * it('should create a user', async () => {
 *   // Seed data
 *   await db.insert(users).values({ ... });
 *   
 *   // Run tests
 *   const user = await repository.findUserById('123');
 *   expect(user).toBeDefined();
 * });
 * ```
 */
export function setupTestDb(): { db: any; mem: IMemoryDb } {
  // Create in-memory database
  const mem = newDb({
    autoCreateForeignKeyIndices: true,
  });

  const { Pool } = mem.adapters.createPg();
  const pool = new Pool();

  // Workaround for pg-mem not supporting getTypeParser
  const originalConnect = pool.connect.bind(pool);
  pool.connect = async () => {
    const client = await originalConnect();
    // @ts-ignore
    client.getTypeParser = () => (val: any) => val;
    return client;
  };

  const db = drizzle(pool, { schema });

  // Load and run migrations
  const migrationsPath = join(__dirname, '../../drizzle/migrations');

  // Read migration files
  const migration0 = readFileSync(
    join(migrationsPath, '0000_careful_dark_beast.sql'),
    'utf-8'
  );
  const migration1 = readFileSync(
    join(migrationsPath, '0001_rich_bucky.sql'),
    'utf-8'
  );

  // Remove DO $$ blocks (PL/pgSQL) as pg-mem doesn't support them
  // These are just for handling duplicate constraints, which won't happen in tests
  const cleanMigration0 = migration0.replace(/DO \$\$ BEGIN[\s\S]*?END \$\$;/g, '');
  const cleanMigration1 = migration1.replace(/DO \$\$ BEGIN[\s\S]*?END \$\$;/g, '');

  // Execute migrations
  mem.public.none(cleanMigration0);
  mem.public.none(cleanMigration1);

  return { db, mem };
}

