import dotenv from 'dotenv';
import { z } from 'zod';

// Load .env files based on environment
if (process.env.NODE_ENV === 'development') {
  dotenv.config();
} else if (process.env.NODE_ENV === 'test') {
  dotenv.config({ path: '.env.test' });
}

// Define validation schema with Zod
const envSchema = z.object({
  // Node environment
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  // Server configuration
  PORT: z.coerce.number().positive().default(3000),

  // AWS Configuration
  AWS_REGION: z.string().default('us-east-1'),
  AWS_ENDPOINT: z.string().optional(),
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),

  // SQS Queue URL
  SQS_POSTS_STREAM_QUEUE_URL: z.string().url(),
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

    process.exit(1);
  }
  throw error;
}

// Helper functions for environment checks
export const isProd = () => env.NODE_ENV === 'production';
export const isDev = () => env.NODE_ENV === 'development';
export const isTestEnv = () => env.NODE_ENV === 'test';

// Export the validated environment
export { env };
export default env;

