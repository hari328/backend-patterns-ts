import { customType } from 'drizzle-orm/pg-core';

/**
 * Custom Drizzle column type for Snowflake IDs
 * 
 * Database: BIGINT (8 bytes - efficient)
 * TypeScript: string (JSON-compatible)
 * 
 * This allows us to store IDs as BIGINT in PostgreSQL for efficiency
 * while working with them as strings in TypeScript for JSON compatibility.
 */
export const snowflakeId = customType<{ data: string; driverData: string }>({
  dataType() {
    return 'bigint';
  },
  toDriver(value: string): string {
    return value;
  },
  fromDriver(value: string): string {
    return value;
  },
});

