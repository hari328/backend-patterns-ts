import type { MetricsRegistry } from '@repo/metrics';

type Gauge = ReturnType<MetricsRegistry['gauge']>;

let activeGauge: Gauge | null = null;

export function registerPoolMetrics(registry: MetricsRegistry, poolMax: number): void {
  const maxGauge = registry.gauge({
    name: 'db_pool_max',
    help: 'Maximum database connection pool size',
  });
  maxGauge.set(poolMax);

  activeGauge = registry.gauge({
    name: 'db_pool_active',
    help: 'Number of database queries currently executing',
  });
}

export function incrementActive(): void {
  activeGauge?.inc();
}

export function decrementActive(): void {
  activeGauge?.dec();
}

export function _resetForTest(): void {
  activeGauge = null;
}
