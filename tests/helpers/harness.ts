import { buildSeededDatabase, DEMO_CREDENTIALS } from '@/mocks/seed';
import { createMemoryRepositories } from '@/repositories/memory';
import { createServices, type ServiceContainer } from '@/services/container';
import type { AuditContext } from '@/services/audit-service';
import type { Database } from '@/repositories/memory/store';

/**
 * Every test gets its own seeded database and its own service container, so tests
 * are order-independent and can run in parallel.
 */
export interface Harness {
  db: Database;
  services: ServiceContainer;
  context: AuditContext;
}

export function createHarness(nowMs: number = Date.UTC(2026, 8, 3, 6, 0, 0)): Harness {
  const db = buildSeededDatabase(nowMs);
  const repos = createMemoryRepositories(db);
  const services = createServices(repos);
  return {
    db,
    services,
    context: { actorId: 'test', actorRole: 'admin', ip: '127.0.0.1', userAgent: 'vitest' },
  };
}

export async function demoUser(harness: Harness) {
  const user = await harness.services.repos.users.findByEmail(DEMO_CREDENTIALS.user.email);
  if (!user) throw new Error('demo user missing from seed');
  return user;
}

export async function adminUser(harness: Harness) {
  const user = await harness.services.repos.users.findByEmail(DEMO_CREDENTIALS.admin.email);
  if (!user) throw new Error('admin user missing from seed');
  return user;
}

/** Finds an open round for the Thai Government Lottery. */
export async function openThaiRound(harness: Harness, nowMs: number) {
  const lottery = await harness.services.repos.lotteries.findBySlug('thai-government');
  if (!lottery) throw new Error('thai-government lottery missing from seed');
  const round = await harness.services.repos.rounds.findCurrentForLottery(lottery.id, nowMs);
  if (!round) throw new Error('no open round for thai-government');
  return { lottery, round };
}

let keyCounter = 0;
export function idempotencyKey(prefix = 'test'): string {
  keyCounter += 1;
  return `${prefix}-key-${keyCounter}-${Math.random().toString(36).slice(2, 10)}`;
}
