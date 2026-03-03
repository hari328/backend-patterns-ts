import { describe, it, expect, beforeEach } from 'vitest';
import { createMetricsRegistry } from '@repo/metrics';
import {
  registerPoolMetrics,
  incrementActive,
  decrementActive,
  _resetForTest,
} from './pool-metrics';

describe('registerPoolMetrics', () => {
  beforeEach(() => {
    _resetForTest();
  });

  it('registers db_pool_max gauge set to the configured max', async () => {
    const registry = createMetricsRegistry({ collectDefaultMetrics: false });
    registerPoolMetrics(registry, 10);
    const output = await registry.getMetrics();
    expect(output).toContain('db_pool_max 10');
  });

  it('registers db_pool_active gauge starting at 0', async () => {
    const registry = createMetricsRegistry({ collectDefaultMetrics: false });
    registerPoolMetrics(registry, 10);
    const output = await registry.getMetrics();
    expect(output).toContain('db_pool_active 0');
  });
});

describe('incrementActive / decrementActive', () => {
  beforeEach(() => {
    _resetForTest();
  });

  it('reflects increments in the active gauge', async () => {
    const registry = createMetricsRegistry({ collectDefaultMetrics: false });
    registerPoolMetrics(registry, 10);

    incrementActive();
    incrementActive();

    const output = await registry.getMetrics();
    expect(output).toContain('db_pool_active 2');
  });

  it('reflects decrements in the active gauge', async () => {
    const registry = createMetricsRegistry({ collectDefaultMetrics: false });
    registerPoolMetrics(registry, 10);

    incrementActive();
    incrementActive();
    decrementActive();

    const output = await registry.getMetrics();
    expect(output).toContain('db_pool_active 1');
  });

  it('does not throw when called before registerPoolMetrics', () => {
    expect(() => incrementActive()).not.toThrow();
    expect(() => decrementActive()).not.toThrow();
  });
});
