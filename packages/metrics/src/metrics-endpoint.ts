import type { Request, Response } from 'express';
import type { MetricsRegistry } from './interfaces';

export function metricsEndpoint(registry: MetricsRegistry) {
  return async (_req: Request, res: Response): Promise<void> => {
    res.set('Content-Type', registry.getContentType());
    const metrics = await registry.getMetrics();
    res.end(metrics);
  };
}

