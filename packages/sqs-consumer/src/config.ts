import { z } from 'zod';


export const doubleBufferConfigSchema = z.object({
  enabled: z.boolean().default(false),
  flushIntervalMs: z.coerce.number().positive().default(10000), // 10 seconds
  maxBufferSize: z.coerce.number().positive().optional(),
});

export type DoubleBufferConfigType = z.infer<typeof doubleBufferConfigSchema>;

export const retryConfigSchema = z.object({
  enabled: z.boolean().default(true),
  strategy: z.enum(['exponential', 'fixed']).default('exponential'),
  maxRetries: z.coerce.number().min(0).default(3),
  baseDelayMs: z.coerce.number().positive().default(1000), // 1 second
});

export type RetryConfigType = z.infer<typeof retryConfigSchema>;

export const idempotencyConfigSchema = z.object({
  enabled: z.boolean().default(false),
  ttlSeconds: z.coerce.number().positive().default(86400), // 24 hours
});

export type IdempotencyConfigType = z.infer<typeof idempotencyConfigSchema>;


export const deadLetterQueueConfigSchema = z.object({
  enabled: z.boolean().default(false),
  queueUrl: z.string().optional(),
});

export type DeadLetterQueueConfigType = z.infer<typeof deadLetterQueueConfigSchema>;

export const sqsQueueConfigSchema = z.object({
  // Basic SQS settings
  queueUrl: z.string().url(),
  maxNumberOfMessages: z.coerce.number().min(1).max(10).default(10),
  waitTimeSeconds: z.coerce.number().min(0).max(20).default(20),
  visibilityTimeout: z.coerce.number().min(0).default(30),

  // Processing settings
  processingMode: z.enum(['parallel', 'serial']).default('serial'),

  // Optional feature configurations
  doubleBuffer: doubleBufferConfigSchema.optional(),
  retry: retryConfigSchema.optional(),
  idempotency: idempotencyConfigSchema.optional(),
  deadLetterQueue: deadLetterQueueConfigSchema.optional(),
});

export type SQSQueueConfig = z.infer<typeof sqsQueueConfigSchema>;


export function createSQSQueueConfig(
  envVars: Record<string, string | undefined>,
  prefix: string
): SQSQueueConfig {
  const getEnvVar = (key: string): string | undefined => {
    return envVars[`${prefix}_${key}`];
  };

  // Build config object from env vars
  const config = {
    // Basic SQS settings
    queueUrl: getEnvVar('QUEUE_URL'),
    maxNumberOfMessages: getEnvVar('MAX_MESSAGES'),
    waitTimeSeconds: getEnvVar('WAIT_TIME_SECONDS'),
    visibilityTimeout: getEnvVar('VISIBILITY_TIMEOUT'),
    processingMode: getEnvVar('PROCESSING_MODE'),

    // Double buffer config
    doubleBuffer: getEnvVar('DOUBLE_BUFFER_ENABLED') ? {
      enabled: getEnvVar('DOUBLE_BUFFER_ENABLED'),
      flushIntervalMs: getEnvVar('DOUBLE_BUFFER_FLUSH_INTERVAL_MS'),
      maxBufferSize: getEnvVar('DOUBLE_BUFFER_MAX_SIZE'),
    } : undefined,

    // Retry config
    retry: getEnvVar('RETRY_ENABLED') ? {
      enabled: getEnvVar('RETRY_ENABLED'),
      strategy: getEnvVar('RETRY_STRATEGY'),
      maxRetries: getEnvVar('RETRY_MAX_RETRIES'),
      baseDelayMs: getEnvVar('RETRY_BASE_DELAY_MS'),
    } : undefined,

    // Idempotency config
    idempotency: getEnvVar('IDEMPOTENCY_ENABLED') ? {
      enabled: getEnvVar('IDEMPOTENCY_ENABLED'),
      ttlSeconds: getEnvVar('IDEMPOTENCY_TTL_SECONDS'),
    } : undefined,

    // Dead letter queue config
    deadLetterQueue: getEnvVar('DLQ_ENABLED') ? {
      enabled: getEnvVar('DLQ_ENABLED'),
      queueUrl: getEnvVar('DLQ_QUEUE_URL'),
    } : undefined,
  };

  
  try {
    return sqsQueueConfigSchema.parse(config);
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error(`❌ Invalid SQS queue configuration for prefix '${prefix}':`);
      error.issues.forEach((err) => {
        const path = err.path.join('.');
        console.error(`  ${path}: ${err.message}`);
      });
      throw new Error(`Invalid SQS configuration for ${prefix}`);
    }
    throw error;
  }
}

