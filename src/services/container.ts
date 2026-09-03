import { getQueue } from '@/providers/queue';
import { getRepositories, type RepositoryBundle } from '@/repositories';
import { AuditService } from './audit-service';
import { AuthService } from './auth-service';
import { BetService } from './bet-service';
import { CashierService } from './cashier-service';
import { CatalogService } from './catalog-service';
import { IdempotencyService } from './idempotency-service';
import { NotificationService } from './notification-service';
import { QueryService } from './query-service';
import { ReportingService } from './reporting-service';
import { SettlementService } from './settlement-service';
import { WalletService } from './wallet-service';

/**
 * Composition root.
 *
 * Services receive their dependencies through the constructor, so tests build a
 * container over an isolated in-memory database with one call and never touch
 * the process-wide singleton.
 */
export interface ServiceContainer {
  repos: RepositoryBundle;
  audit: AuditService;
  auth: AuthService;
  wallet: WalletService;
  idempotency: IdempotencyService;
  notifications: NotificationService;
  bets: BetService;
  settlement: SettlementService;
  cashier: CashierService;
  catalog: CatalogService;
  query: QueryService;
  reporting: ReportingService;
}

export function createServices(repos: RepositoryBundle): ServiceContainer {
  const audit = new AuditService(repos);
  const wallet = new WalletService(repos);
  const idempotency = new IdempotencyService(repos);
  const notifications = new NotificationService(repos);
  const auth = new AuthService(repos, wallet, notifications, audit);
  const bets = new BetService(repos, wallet, idempotency, notifications, audit);
  const settlement = new SettlementService(repos, wallet, notifications, audit);
  const cashier = new CashierService(repos, wallet, idempotency, notifications, audit);
  const catalog = new CatalogService(repos);
  const query = new QueryService(repos);
  const reporting = new ReportingService(repos, query, catalog);

  return {
    repos,
    audit,
    auth,
    wallet,
    idempotency,
    notifications,
    bets,
    settlement,
    cashier,
    catalog,
    query,
    reporting,
  };
}

const GLOBAL_KEY = Symbol.for('elp.services');

interface GlobalWithServices {
  [GLOBAL_KEY]?: ServiceContainer;
}

export function getServices(): ServiceContainer {
  const container = globalThis as unknown as GlobalWithServices;
  const existing = container[GLOBAL_KEY];
  if (existing) return existing;

  const created = createServices(getRepositories());
  container[GLOBAL_KEY] = created;
  registerJobHandlers(created);
  return created;
}

export function resetServices(): void {
  const container = globalThis as unknown as GlobalWithServices;
  delete container[GLOBAL_KEY];
}

/**
 * Wiring for background work. In production these same names are consumed by a
 * separate worker process; here the mock queue runs them in-process.
 */
function registerJobHandlers(services: ServiceContainer): void {
  const queue = getQueue();

  queue.register<{ roundId: string; actorId: string | null }>('settle-round', async (payload) => {
    await services.settlement.settleLotteryRound(payload.roundId, {
      actorId: payload.actorId,
      actorRole: 'system',
      ip: 'internal',
      userAgent: 'job:settle-round',
    });
  });

  queue.register<{ userIds: string[]; title: string; body: string; type: 'system' | 'promotion' }>(
    'broadcast-notification',
    async (payload) => {
      await services.notifications.pushMany(
        payload.userIds.map((userId) => ({
          userId,
          type: payload.type,
          title: payload.title,
          body: payload.body,
        })),
      );
    },
  );

  queue.register<Record<string, never>>('analytics-rollup', async () => {
    await services.idempotency.purge();
  });
}
