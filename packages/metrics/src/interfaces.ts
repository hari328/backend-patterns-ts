import type { Registry, Counter, Histogram, Gauge } from 'prom-client';

export interface MetricsConfig {
  prefix?: string;
  defaultLabels?: Record<string, string>;
  collectDefaultMetrics?: boolean;
}

export interface MetricsRegistry {
  counter(config: { name: string; help: string; labelNames?: string[] }): Counter;
  histogram(config: {
    name: string;
    help: string;
    labelNames?: string[];
    buckets?: number[];
  }): Histogram;
  gauge(config: { name: string; help: string; labelNames?: string[] }): Gauge;
  getPrometheusRegistry(): Registry;
  getMetrics(): Promise<string>;
  getContentType(): string;
}

