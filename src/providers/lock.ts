/**
 * Per-key mutual exclusion.
 *
 * The wallet service serialises every mutation for one wallet through this lock.
 * It is a *latency* optimisation, not the correctness mechanism: correctness comes
 * from the optimistic `version` compare-and-set in the repository, which holds
 * across processes. The lock simply avoids burning retries when two requests for
 * the same wallet land on the same instance.
 *
 * PRODUCTION: either keep relying on the CAS retry loop (recommended — it is
 * already correct across instances), or add `SELECT ... FOR UPDATE` on the wallet
 * row inside the transaction. A Redis lock is NOT required and would add a
 * failure mode without adding safety.
 */
export interface KeyedLock {
  run<T>(key: string, fn: () => Promise<T>): Promise<T>;
}

export function createKeyedLock(): KeyedLock {
  const chains = new Map<string, Promise<unknown>>();

  return {
    async run<T>(key: string, fn: () => Promise<T>): Promise<T> {
      const previous = chains.get(key) ?? Promise.resolve();
      let release!: () => void;
      const gate = new Promise<void>((resolve) => {
        release = resolve;
      });
      const chain = previous.then(() => gate);
      chains.set(key, chain);

      await previous.catch(() => undefined);
      try {
        return await fn();
      } finally {
        release();
        // Only the last waiter clears the entry, so the map stays bounded.
        if (chains.get(key) === chain) chains.delete(key);
      }
    },
  };
}

const GLOBAL_KEY = Symbol.for('elp.walletLock');

interface GlobalWithLock {
  [GLOBAL_KEY]?: KeyedLock;
}

export function getWalletLock(): KeyedLock {
  const container = globalThis as unknown as GlobalWithLock;
  const existing = container[GLOBAL_KEY];
  if (existing) return existing;
  const created = createKeyedLock();
  container[GLOBAL_KEY] = created;
  return created;
}
