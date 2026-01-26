import { Snowflake } from '@sapphire/snowflake';


const EPOCH = new Date('2024-01-01T00:00:00.000Z');

export const snowflake = new Snowflake(EPOCH.getTime());

snowflake.workerId = BigInt(process.env.WORKER_ID || 0);

/**
 * Generate a new Snowflake ID
 *
 * Returns a string representation of the Snowflake ID for JSON compatibility.
 * The ID is stored as BIGINT (8 bytes) in the database but handled as string
 * in application code to avoid JSON serialization issues.
 *
 * @returns Snowflake ID as string
 * @example
 * const id = generateSnowflakeId();
 * // => "175928847299117063"
 */
export function generateSnowflakeId(): string {
  return snowflake.generate().toString();
}

/**
 * Decode a Snowflake ID to extract timestamp
 * @param id - Snowflake ID as string
 * @returns Date when the ID was generated
 * @example
 * const createdAt = decodeSnowflakeId("175928847299117063");
 * // => Date object
 */
export function decodeSnowflakeId(id: string): Date {
  const deconstructed = snowflake.deconstruct(BigInt(id));
  return new Date(Number(deconstructed.timestamp));
}

/**
 * Get the worker ID from a Snowflake ID
 * @param id - Snowflake ID as string
 * @returns Worker ID (0-31)
 */
export function getWorkerIdFromSnowflake(id: string): bigint {
  const deconstructed = snowflake.deconstruct(BigInt(id));
  return deconstructed.workerId;
}

/**
 * Get the sequence number from a Snowflake ID
 * @param id - Snowflake ID as string
 * @returns Sequence number (0-4095)
 */
export function getSequenceFromSnowflake(id: string): bigint {
  const deconstructed = snowflake.deconstruct(BigInt(id));
  return deconstructed.increment;
}

