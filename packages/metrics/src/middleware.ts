import type { Request, Response, NextFunction } from 'express';
import type { MetricsRegistry } from './interfaces';

export function metricsMiddleware(registry: MetricsRegistry) {
  const httpRequestDuration = registry.histogram({
    name: 'http_request_duration_seconds',
    help: 'Duration of HTTP requests in seconds',
    labelNames: ['method', 'route', 'status'],
    buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  });

  const httpRequestsTotal = registry.counter({
    name: 'http_requests_total',
    help: 'Total number of HTTP requests',
    labelNames: ['method', 'route', 'status'],
  });

  return (req: Request, res: Response, next: NextFunction): void => {
    if (req.path === '/metrics') {
      next();
      return;
    }

    const startTime = process.hrtime.bigint();

    res.on('finish', () => {
      const durationNs = Number(process.hrtime.bigint() - startTime);
      const durationSeconds = durationNs / 1e9;
      const route = req.route?.path ?? req.path;
      const labels = {
        method: req.method,
        route,
        status: String(res.statusCode),
      };

      httpRequestDuration.observe(labels, durationSeconds);
      httpRequestsTotal.inc(labels);
    });

    next();
  };
}

