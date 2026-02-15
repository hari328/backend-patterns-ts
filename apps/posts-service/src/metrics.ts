import { createMetricsRegistry } from '@repo/metrics';
import { env } from './config/env';

export const registry = createMetricsRegistry({
  prefix: 'posts_service_',
  defaultLabels: {
    service: 'posts-service',
    environment: env.NODE_ENV,
  },
});

