import { describe, expect, it } from 'vitest';
import { createMemoryCache, cacheKeys } from '@/providers/cache';
import { createKeyedLock } from '@/providers/lock';
import { createMemoryRateLimiter, RATE_LIMITS } from '@/providers/rate-limit';
import { createMockJobQueue } from '@/providers/queue';
import { createHarness, idempotencyKey } from '../helpers/harness';

describe('cache provider', () => {
  it('reads through and then serves from cache', async () => {
    const cache = createMemoryCache();
    let calls = 0;
    const load = async () => {
      calls += 1;
      return { value: calls };
    };

    const first = await cache.remember(cacheKeys.lotteryList, 60, load);
    const second = await cache.remember(cacheKeys.lotteryList, 60, load);

    expect(first).toEqual({ value: 1 });
    expect(second).toEqual({ value: 1 });
    expect(calls).toBe(1);
  });

  it('collapses concurrent misses into a single loader call', async () => {
    const cache = createMemoryCache();
    let calls = 0;
    const load = async () => {
      calls += 1;
      await new Promise((resolve) => setTimeout(resolve, 10));
      return calls;
    };

    await Promise.all([
      cache.remember('k', 60, load),
      cache.remember('k', 60, load),
      cache.remember('k', 60, load),
    ]);

    expect(calls).toBe(1);
  });

  it('expires entries and supports prefix invalidation', async () => {
    const cache = createMemoryCache();
    await cache.set('lottery:a', 1, 60);
    await cache.set('lottery:b', 2, 60);
    await cache.set('results:latest', 3, 60);

    expect(await cache.deleteByPrefix('lottery:')).toBe(2);
    expect(await cache.get('lottery:a')).toBeNull();
    expect(await cache.get('results:latest')).toBe(3);

    await cache.set('short', 'x', 0);
    expect(await cache.get('short')).toBeNull();
  });
});

describe('rate limiter', () => {
  it('allows up to the limit then rejects within the window', async () => {
    const limiter = createMemoryRateLimiter();
    const rule = { limit: 3, windowSeconds: 60 };

    const outcomes = [];
    for (let i = 0; i < 5; i++) outcomes.push(await limiter.consume('user:1', rule));

    expect(outcomes.filter((outcome) => outcome.allowed)).toHaveLength(3);
    expect(outcomes[4]?.allowed).toBe(false);
    expect(outcomes[4]?.retryAfterSeconds).toBeGreaterThan(0);
  });

  it('keys are independent', async () => {
    const limiter = createMemoryRateLimiter();
    const rule = { limit: 1, windowSeconds: 60 };
    expect((await limiter.consume('a', rule)).allowed).toBe(true);
    expect((await limiter.consume('b', rule)).allowed).toBe(true);
    expect((await limiter.consume('a', rule)).allowed).toBe(false);
  });

  it('exposes a budget for every protected action', () => {
    for (const rule of Object.values(RATE_LIMITS)) {
      expect(rule.limit).toBeGreaterThan(0);
      expect(rule.windowSeconds).toBeGreaterThan(0);
    }
  });
});

describe('keyed lock', () => {
  it('serialises work for the same key but not across keys', async () => {
    const lock = createKeyedLock();
    const order: string[] = [];

    const slow = async (label: string) => {
      order.push(`${label}:start`);
      await new Promise((resolve) => setTimeout(resolve, 15));
      order.push(`${label}:end`);
    };

    await Promise.all([
      lock.run('same', () => slow('a')),
      lock.run('same', () => slow('b')),
      lock.run('other', () => slow('c')),
    ]);

    // a fully completes before b starts.
    expect(order.indexOf('a:end')).toBeLessThan(order.indexOf('b:start'));
  });
});

describe('job queue', () => {
  it('runs a registered handler and reports completion', async () => {
    const queue = createMockJobQueue();
    const seen: string[] = [];
    queue.register<{ roundId: string }>('settle-round', async (payload) => {
      seen.push(payload.roundId);
    });

    await queue.enqueue('settle-round', { roundId: 'r1' });
    await queue.drain();

    expect(seen).toEqual(['r1']);
    expect(queue.list()[0]?.status).toBe('completed');
  });

  it('deduplicates by jobId', async () => {
    const queue = createMockJobQueue();
    let runs = 0;
    queue.register('settle-round', async () => {
      runs += 1;
    });

    await queue.enqueue('settle-round', { roundId: 'r1' }, { jobId: 'settle:r1' });
    await queue.enqueue('settle-round', { roundId: 'r1' }, { jobId: 'settle:r1' });
    await queue.drain();

    expect(runs).toBe(1);
  });
});

describe('idempotency service', () => {
  it('replays the stored response instead of running twice', async () => {
    const harness = createHarness();
    const key = idempotencyKey();
    let runs = 0;

    const operation = async () => {
      runs += 1;
      return { value: runs };
    };

    const first = await harness.services.idempotency.run(
      { key, scope: 'test', userId: null, payload: { a: 1 } },
      operation,
    );
    const second = await harness.services.idempotency.run(
      { key, scope: 'test', userId: null, payload: { a: 1 } },
      operation,
    );

    expect(first.replayed).toBe(false);
    expect(second.replayed).toBe(true);
    expect(second.data).toEqual({ value: 1 });
    expect(runs).toBe(1);
  });

  it('does not poison the key when the operation fails', async () => {
    const harness = createHarness();
    const key = idempotencyKey();

    await expect(
      harness.services.idempotency.run({ key, scope: 'test', userId: null, payload: {} }, async () => {
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');

    const retry = await harness.services.idempotency.run(
      { key, scope: 'test', userId: null, payload: {} },
      async () => 'recovered',
    );
    expect(retry.data).toBe('recovered');
    expect(retry.replayed).toBe(false);
  });

  it('rejects the same key used with a different payload', async () => {
    const harness = createHarness();
    const key = idempotencyKey();

    await harness.services.idempotency.run(
      { key, scope: 'test', userId: null, payload: { amount: 100 } },
      async () => 'first',
    );

    await expect(
      harness.services.idempotency.run(
        { key, scope: 'test', userId: null, payload: { amount: 200 } },
        async () => 'second',
      ),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
  });
});
