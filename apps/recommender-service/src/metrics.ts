import { createMetricsRegistry } from '@repo/metrics';
import { env } from './config/env';

export const registry = createMetricsRegistry({
  prefix: 'recommender_service_',
  defaultLabels: {
    service: 'recommender-service',
    environment: env.NODE_ENV,
  },
});

