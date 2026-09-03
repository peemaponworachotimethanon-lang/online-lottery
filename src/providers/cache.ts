/**
 * Cache abstraction.
 *
 * The demo uses an in-process TTL map. Production swaps in Redis by implementing
 * this same interface — see PERFORMANCE.md § Cache for key design, TTLs, and the
 * invalidation contract.
 *
 * HARD RULE: the cache never holds authoritative financial state. Wallet
 * balances, ledger rows, bets, and settlement status are always read from the
 * source of truth. Only public, reconstructible data is cached.
 */
export interface CacheProvider {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttlSeconds: number): Promise<void>;
  delete(key: string): Promise<void>;
  /** Deletes every key beginning with `prefix`. Redis: SCAN + UNLINK. */
  deleteByPrefix(prefix: string): Promise<number>;
  /** Read-through helper: the only method application code should normally use. */
  remember<T>(key: string, ttlSeconds: number, loader: () => Promise<T>): Promise<T>;
}

interface Entry {
  value: unknown;
  expiresAt: number;
}

export function createMemoryCache(): CacheProvider {
  const store = new Map<string, Entry>();
  /** Collapses concurrent misses for the same key into one loader call. */
  const inflight = new Map<string, Promise<unknown>>();

  function read(key: string): Entry | null {
    const entry = store.get(key);
    if (!entry) return null;
    if (entry.expiresAt <= Date.now()) {
      store.delete(key);
      return null;
    }
    return entry;
  }

  return {
    async get<T>(key: string) {
      const entry = read(key);
      return entry ? (entry.value as T) : null;
    },
    async set<T>(key: string, value: T, ttlSeconds: number) {
      store.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
    },
    async delete(key: string) {
      store.delete(key);
    },
    async deleteByPrefix(prefix: string) {
      let removed = 0;
      for (const key of store.keys()) {
        if (key.startsWith(prefix)) {
          store.delete(key);
          removed += 1;
        }
      }
      return removed;
    },
    async remember<T>(key: string, ttlSeconds: number, loader: () => Promise<T>) {
      const entry = read(key);
      if (entry) return entry.value as T;

      const pending = inflight.get(key);
      if (pending) return (await pending) as T;

      const promise = loader()
        .then((value) => {
          store.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
          return value as unknown;
        })
        .finally(() => inflight.delete(key));

      inflight.set(key, promise);
      return (await promise) as T;
    },
  };
}

/**
 * Cache key registry. Keys are versioned (`:v1`) so a shape change is a rename,
 * never a stale-read bug.
 */
export const cacheKeys = {
  lotteryList: 'lottery:list:v1',
  lotteryCurrentRound: (lotteryId: string) => `lottery:${lotteryId}:round:current:v1`,
  lotteryRates: (lotteryId: string) => `lottery:${lotteryId}:rates:v1`,
  latestResults: 'results:latest:v1',
  betTypes: 'bettype:list:v1',
  publicStats: 'stats:public:v1',
} as const;

/** TTLs in seconds, chosen against how fast each dataset actually changes. */
export const cacheTtl = {
  /** Catalogue changes are admin-driven and explicitly invalidated. */
  lotteryList: 300,
  /** Bounded staleness: the countdown is recomputed client-side from closeAt. */
  currentRound: 15,
  rates: 120,
  latestResults: 30,
  publicStats: 60,
} as const;

const GLOBAL_KEY = Symbol.for('elp.cache');

interface GlobalWithCache {
  [GLOBAL_KEY]?: CacheProvider;
}

export function getCache(): CacheProvider {
  const container = globalThis as unknown as GlobalWithCache;
  const existing = container[GLOBAL_KEY];
  if (existing) return existing;
  const created = createMemoryCache();
  container[GLOBAL_KEY] = created;
  return created;
}

/**
 * Invalidation contract — every admin mutation calls exactly one of these.
 * Keeping them in one place is what stops "which keys do I clear?" bugs.
 */
export async function invalidateCatalogue(): Promise<void> {
  const cache = getCache();
  await cache.delete(cacheKeys.lotteryList);
  await cache.delete(cacheKeys.betTypes);
  await cache.deleteByPrefix('lottery:');
}

export async function invalidateRates(lotteryId?: string): Promise<void> {
  const cache = getCache();
  if (lotteryId) await cache.delete(cacheKeys.lotteryRates(lotteryId));
  else await cache.deleteByPrefix('lottery:');
}

export async function invalidateResults(): Promise<void> {
  const cache = getCache();
  await cache.delete(cacheKeys.latestResults);
  await cache.delete(cacheKeys.publicStats);
}

export async function invalidateRounds(): Promise<void> {
  const cache = getCache();
  await cache.deleteByPrefix('lottery:');
  await cache.delete(cacheKeys.publicStats);
}
