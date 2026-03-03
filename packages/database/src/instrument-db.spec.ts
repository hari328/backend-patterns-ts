import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMetricsRegistry } from '@repo/metrics';
import { instrumentDb } from './instrument-db';
import { registerPoolMetrics, _resetForTest } from './pool-metrics';

function createMockSession(executeImpl: () => unknown) {
  const execute = vi.fn().mockImplementation(executeImpl);
  const prepareQuery = vi.fn().mockReturnValue({ execute });
  return { session: { prepareQuery }, execute };
}

describe('instrumentDb pool tracking', () => {
  beforeEach(() => {
    _resetForTest();
  });

  it('increments active while query is in-flight and decrements after resolve', async () => {
    const registry = createMetricsRegistry({ collectDefaultMetrics: false });
    registerPoolMetrics(registry, 10);

    let resolveQuery!: () => void;
    const { session } = createMockSession(
      () => new Promise((resolve) => { resolveQuery = () => resolve([]); }),
    );
    instrumentDb({ session });

    const prepared = session.prepareQuery({});
    const queryPromise = prepared.execute();

    const duringOutput = await registry.getMetrics();
    expect(duringOutput).toContain('db_pool_active 1');

    resolveQuery();
    await queryPromise;

    const afterOutput = await registry.getMetrics();
    expect(afterOutput).toContain('db_pool_active 0');
  });

  it('decrements active after execute rejects', async () => {
    const registry = createMetricsRegistry({ collectDefaultMetrics: false });
    registerPoolMetrics(registry, 10);

    const { session } = createMockSession(() =>
      Promise.reject(new Error('query failed')),
    );
    instrumentDb({ session });

    const prepared = session.prepareQuery({});
    await expect(prepared.execute()).rejects.toThrow('query failed');

    const output = await registry.getMetrics();
    expect(output).toContain('db_pool_active 0');
  });

  it('tracks pool metrics even when there is no active trace span', async () => {
    const registry = createMetricsRegistry({ collectDefaultMetrics: false });
    registerPoolMetrics(registry, 10);

    const { session } = createMockSession(() => Promise.resolve([]));
    instrumentDb({ session });

    const prepared = session.prepareQuery({});
    await prepared.execute();

    const output = await registry.getMetrics();
    expect(output).toContain('db_pool_active 0');
  });
});
