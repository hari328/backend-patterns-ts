import { createMetricsRegistry } from '@repo/metrics';
import { registerPoolMetrics, DB_POOL_MAX } from '@repo/database';
import { env } from './config/env';

export const registry = createMetricsRegistry({
  prefix: 'recommender_service_',
  defaultLabels: {
    service: 'recommender-service',
    environment: env.NODE_ENV,
  },
});

registerPoolMetrics(registry, DB_POOL_MAX);

