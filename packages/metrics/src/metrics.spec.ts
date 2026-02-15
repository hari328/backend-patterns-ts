import { describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import { createMetricsRegistry } from './registry';
import { metricsMiddleware } from './middleware';
import { metricsEndpoint } from './metrics-endpoint';
import type { MetricsRegistry } from './interfaces';

function createTestApp(registry: MetricsRegistry) {
  const app = express();
  app.use(metricsMiddleware(registry));
  app.get('/posts', (_req, res) => res.status(200).json({ posts: [] }));
  app.post('/posts', (_req, res) => res.status(201).json({ id: '1' }));
  app.get('/metrics', metricsEndpoint(registry));
  return app;
}

async function makeRequest(
  app: express.Express,
  method: 'get' | 'post',
  path: string,
): Promise<void> {
  return new Promise((resolve) => {
    const server = app.listen(0, () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      fetch(`http://127.0.0.1:${port}${path}`, { method: method.toUpperCase() })
        .then(() => {
          server.close();
          resolve();
        });
    });
  });
}

async function getMetricsOutput(app: express.Express): Promise<{ body: string; contentType: string }> {
  return new Promise((resolve) => {
    const server = app.listen(0, () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      fetch(`http://127.0.0.1:${port}/metrics`)
        .then(async (res) => {
          const body = await res.text();
          const contentType = res.headers.get('content-type') ?? '';
          server.close();
          resolve({ body, contentType });
        });
    });
  });
}

describe('createMetricsRegistry', () => {
  let registry: MetricsRegistry;

  beforeEach(() => {
    registry = createMetricsRegistry();
  });

  it('collects default system metrics (cpu, memory, event loop)', async () => {
    const output = await registry.getMetrics();
    expect(output).toContain('process_cpu');
    expect(output).toContain('nodejs_eventloop_lag');
  });

  it('skips default metrics when collectDefaultMetrics is false', async () => {
    const noDefaultsRegistry = createMetricsRegistry({ collectDefaultMetrics: false });
    const output = await noDefaultsRegistry.getMetrics();
    expect(output).not.toContain('process_cpu');
  });

  it('applies prefix to default metrics', async () => {
    const prefixedRegistry = createMetricsRegistry({ prefix: 'myapp_' });
    const output = await prefixedRegistry.getMetrics();
    expect(output).toContain('myapp_process_cpu');
  });

  it('applies default labels to all metrics', async () => {
    const labeledRegistry = createMetricsRegistry({
      defaultLabels: { service: 'posts-service' },
    });
    const counter = labeledRegistry.counter({ name: 'test_counter', help: 'test' });
    counter.inc();
    const output = await labeledRegistry.getMetrics();
    expect(output).toContain('service="posts-service"');
  });
});

describe('custom metrics', () => {
  let registry: MetricsRegistry;

  beforeEach(() => {
    registry = createMetricsRegistry({ collectDefaultMetrics: false });
  });

  it('creates and increments a counter visible in metrics output', async () => {
    const counter = registry.counter({
      name: 'posts_created_total',
      help: 'Total posts created',
    });
    counter.inc();
    counter.inc();
    const output = await registry.getMetrics();
    expect(output).toContain('posts_created_total 2');
  });

  it('creates a histogram that records observed values', async () => {
    const histogram = registry.histogram({
      name: 'request_duration_seconds',
      help: 'Request duration',
      buckets: [0.1, 0.5, 1],
    });
    histogram.observe(0.25);
    const output = await registry.getMetrics();
    expect(output).toContain('request_duration_seconds_bucket{le="0.1"} 0');
    expect(output).toContain('request_duration_seconds_bucket{le="0.5"} 1');
    expect(output).toContain('request_duration_seconds_count 1');
  });

  it('creates a gauge that can go up and down', async () => {
    const gauge = registry.gauge({
      name: 'active_connections',
      help: 'Current active connections',
    });
    gauge.set(5);
    gauge.inc();
    gauge.dec(2);
    const output = await registry.getMetrics();
    expect(output).toContain('active_connections 4');
  });
});

describe('metricsMiddleware', () => {
  let registry: MetricsRegistry;
  let app: express.Express;

  beforeEach(() => {
    registry = createMetricsRegistry({ collectDefaultMetrics: false });
    app = createTestApp(registry);
  });

  it('records http_request_duration_seconds histogram on request', async () => {
    await makeRequest(app, 'get', '/posts');
    const output = await registry.getMetrics();
    expect(output).toContain('http_request_duration_seconds');
    expect(output).toMatch(/method="GET"/);
    expect(output).toMatch(/status="200"/);
  });

  it('increments http_requests_total counter on request', async () => {
    await makeRequest(app, 'get', '/posts');
    const output = await registry.getMetrics();
    expect(output).toContain('http_requests_total');
    expect(output).toMatch(/method="GET".*status="200"/);
  });

  it('produces separate series for different methods and statuses', async () => {
    await makeRequest(app, 'get', '/posts');
    await makeRequest(app, 'post', '/posts');
    const output = await registry.getMetrics();
    expect(output).toMatch(/http_requests_total\{.*method="GET".*status="200".*\} 1/);
    expect(output).toMatch(/http_requests_total\{.*method="POST".*status="201".*\} 1/);
  });
});

describe('metricsEndpoint', () => {
  let registry: MetricsRegistry;
  let app: express.Express;

  beforeEach(() => {
    registry = createMetricsRegistry({ collectDefaultMetrics: false });
    app = createTestApp(registry);
  });

  it('returns Prometheus text format with correct content-type', async () => {
    const { contentType } = await getMetricsOutput(app);
    expect(contentType).toContain('text/plain');
  });

  it('returns metrics content in the response body', async () => {
    const counter = registry.counter({ name: 'test_total', help: 'test' });
    counter.inc();
    const { body } = await getMetricsOutput(app);
    expect(body).toContain('test_total 1');
  });
});

