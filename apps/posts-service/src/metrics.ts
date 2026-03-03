import { createMetricsRegistry } from '@repo/metrics';
import { registerPoolMetrics, DB_POOL_MAX } from '@repo/database';
import { env } from './config/env';

export const registry = createMetricsRegistry({
  prefix: 'posts_service_',
  defaultLabels: {
    service: 'posts-service',
    environment: env.NODE_ENV,
  },
});

registerPoolMetrics(registry, DB_POOL_MAX);

