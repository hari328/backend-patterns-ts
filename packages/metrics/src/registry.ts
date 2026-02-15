import {
  Registry,
  Counter,
  Histogram,
  Gauge,
  collectDefaultMetrics,
} from 'prom-client';
import type { MetricsConfig, MetricsRegistry } from './interfaces';

export function createMetricsRegistry(config?: MetricsConfig): MetricsRegistry {
  const registry = new Registry();

  if (config?.defaultLabels) {
    registry.setDefaultLabels(config.defaultLabels);
  }

  const shouldCollectDefaults = config?.collectDefaultMetrics !== false;

  if (shouldCollectDefaults) {
    collectDefaultMetrics({
      register: registry,
      prefix: config?.prefix,
    });
  }

  return {
    counter(counterConfig) {
      return new Counter({
        name: `${config?.prefix ?? ''}${counterConfig.name}`,
        help: counterConfig.help,
        labelNames: counterConfig.labelNames ?? [],
        registers: [registry],
      });
    },

    histogram(histogramConfig) {
      return new Histogram({
        name: `${config?.prefix ?? ''}${histogramConfig.name}`,
        help: histogramConfig.help,
        labelNames: histogramConfig.labelNames ?? [],
        buckets: histogramConfig.buckets,
        registers: [registry],
      });
    },

    gauge(gaugeConfig) {
      return new Gauge({
        name: `${config?.prefix ?? ''}${gaugeConfig.name}`,
        help: gaugeConfig.help,
        labelNames: gaugeConfig.labelNames ?? [],
        registers: [registry],
      });
    },

    getPrometheusRegistry() {
      return registry;
    },

    async getMetrics() {
      return registry.metrics();
    },

    getContentType() {
      return registry.contentType;
    },
  };
}

