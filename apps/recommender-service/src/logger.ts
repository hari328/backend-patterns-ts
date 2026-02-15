import { createLogger } from '@repo/logger';
import { env } from './config/env';

export const logger = createLogger({
  service: 'recommender-service',
  environment: env.NODE_ENV,
  level: env.NODE_ENV === 'production' ? 'info' : 'debug',
});

