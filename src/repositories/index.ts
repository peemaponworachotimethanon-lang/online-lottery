import { appConfig } from '@/config/app';
import type { RepositoryBundle } from './contracts';
import { getDatabase } from './memory/db';
import { createMemoryRepositories } from './memory';

/**
 * Repository provider factory.
 *
 * This is the single seam between "the application" and "where data lives".
 * Switching the demo to PostgreSQL means implementing `createPrismaRepositories`
 * against `RepositoryBundle` and returning it here — nothing else changes.
 */
const GLOBAL_KEY = Symbol.for('elp.repositories');

interface GlobalWithRepos {
  [GLOBAL_KEY]?: RepositoryBundle;
}

function build(): RepositoryBundle {
  if (appConfig.mode === 'live') {
    // Intentionally explicit: fail loudly rather than silently serving demo data
    // from a deployment that believes it is talking to a real database.
    throw new Error(
      'NEXT_PUBLIC_APP_MODE=live requires a persistent repository provider. ' +
        'Implement createPrismaRepositories() in src/repositories/prisma and wire it here.',
    );
  }
  return createMemoryRepositories(getDatabase());
}

export function getRepositories(): RepositoryBundle {
  const container = globalThis as unknown as GlobalWithRepos;
  const existing = container[GLOBAL_KEY];
  if (existing) return existing;
  const created = build();
  container[GLOBAL_KEY] = created;
  return created;
}

/** Rebinds the bundle after a demo-data reset. */
export function refreshRepositories(): RepositoryBundle {
  const container = globalThis as unknown as GlobalWithRepos;
  const created = build();
  container[GLOBAL_KEY] = created;
  return created;
}

export type { RepositoryBundle } from './contracts';
