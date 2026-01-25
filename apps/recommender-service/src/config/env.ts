import dotenv from 'dotenv';
import { z } from 'zod';
import { createSQSQueueConfig } from '@repo/sqs-consumer';

// Determine application stage
process.env.APP_STAGE = process.env.APP_STAGE || 'dev';

// Load .env files based on environment
if (process.env.APP_STAGE === 'dev') {
  dotenv.config(); // Loads .env
} else if (process.env.APP_STAGE === 'test') {
  dotenv.config({ path: '.env.test' }); // Loads .env.test
}
// In production, use actual environment variables (no .env file loading)

// Define validation schema with Zod
const envSchema = z.object({
  // Node environment
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  APP_STAGE: z.enum(['dev', 'production', 'test']).default('dev'),

  // Server configuration
  PORT: z.coerce.number().positive().default(6000),

  // AWS Configuration
  AWS_REGION: z.string().default('us-east-1'),
  AWS_ENDPOINT: z.string().optional(),
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
});

// Type inference from schema
export type Env = z.infer<typeof envSchema>;

// Parse and validate environment variables
let env: Env;

try {
  env = envSchema.parse(process.env);
} catch (error) {
  if (error instanceof z.ZodError) {
    console.error('❌ Invalid environment variables:');

    // Detailed error messages
    error.issues.forEach((err) => {
      const path = err.path.join('.');
      console.error(`  ${path}: ${err.message}`);
    });

    process.exit(1); // Exit with error code
  }
  throw error;
}

// Helper functions for environment checks
export const isProd = () => env.NODE_ENV === 'production';
export const isDev = () => env.NODE_ENV === 'development';
export const isTestEnv = () => env.NODE_ENV === 'test';

// SQS Queue Configurations using the shared validator
export const postsStreamQueueConfig = createSQSQueueConfig(process.env, 'SQS_POSTS_STREAM');

// Export the validated environment
export { env };
export default env;

