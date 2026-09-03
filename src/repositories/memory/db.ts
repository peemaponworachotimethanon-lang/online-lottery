import { buildSeededDatabase } from '@/mocks/seed';
import type { Database } from './store';

/**
 * Process-wide singleton for the demo database.
 *
 * Stored on `globalThis` so Next.js dev-server hot reloads do not wipe state and
 * every route handler / server action in the same instance shares one store.
 *
 * Tests never touch this singleton — they call `buildSeededDatabase()` and
 * `createMemoryRepositories()` directly to get an isolated store per test.
 */
const GLOBAL_KEY = Symbol.for('elp.memory.database');

interface GlobalWithDb {
  [GLOBAL_KEY]?: Database;
}

export function getDatabase(): Database {
  const container = globalThis as unknown as GlobalWithDb;
  const existing = container[GLOBAL_KEY];
  if (existing) return existing;
  const created = buildSeededDatabase();
  container[GLOBAL_KEY] = created;
  return created;
}

/** Re-seeds the demo store. Exposed through the admin "reset demo data" action. */
export function resetDatabase(nowMs: number = Date.now()): Database {
  const container = globalThis as unknown as GlobalWithDb;
  const created = buildSeededDatabase(nowMs);
  container[GLOBAL_KEY] = created;
  return created;
}
