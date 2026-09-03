import { nowIso } from '@/lib/datetime';
import { notFound } from '@/lib/errors';
import type {
  AuditLog,
  Bet,
  BetType,
  Deposit,
  DepositStatus,
  IdempotencyRecord,
  LoginEvent,
  Lottery,
  LotteryResult,
  LotteryRound,
  Notification,
  PayoutRate,
  User,
  Wallet,
  WalletTransaction,
  WalletTxType,
  Withdrawal,
  WithdrawalStatus,
} from '@/types/domain';
import type { RepositoryBundle } from '../contracts';
import { byCreatedAtDesc, clone, matches, notDeleted, paginate, withinRange } from './helpers';
import type { Database } from './store';

/**
 * In-memory implementation of every repository contract.
 *
 * Two rules keep this honest as a stand-in for SQL:
 *   1. Reads return deep clones, so no caller can mutate stored state by holding
 *      a reference — the same isolation a database gives you for free.
 *   2. Filters mirror the indexes declared in prisma/schema.prisma, so switching
 *      to Prisma is a translation, not a redesign.
 */
export function createMemoryRepositories(db: Database): RepositoryBundle {
  const users: RepositoryBundle['users'] = {
    async findById(userId) {
      const user = db.users.get(userId);
      return user && notDeleted(user) ? clone(user) : null;
    },
    async findByEmail(email) {
      const needle = email.trim().toLowerCase();
      for (const user of db.users.values()) {
        if (notDeleted(user) && user.email === needle) return clone(user);
      }
      return null;
    },
    async findByUsername(username) {
      const needle = username.trim().toLowerCase();
      for (const user of db.users.values()) {
        if (notDeleted(user) && user.username.toLowerCase() === needle) return clone(user);
      }
      return null;
    },
    async findByPhone(phone) {
      for (const user of db.users.values()) {
        if (notDeleted(user) && user.phone === phone) return clone(user);
      }
      return null;
    },
    async findByIds(ids) {
      const wanted = new Set(ids);
      return [...db.users.values()].filter((user) => wanted.has(user.id)).map(clone);
    },
    async findMany(filter) {
      const sortBy = filter.sortBy ?? 'createdAt';
      const dir = filter.sortDir ?? 'desc';
      const rows = [...db.users.values()]
        .filter(notDeleted)
        .filter((user) => (filter.status && filter.status !== 'all' ? user.status === filter.status : true))
        .filter((user) => (filter.role && filter.role !== 'all' ? user.roles.includes(filter.role) : true))
        .filter((user) =>
          filter.search
            ? matches([user.username, user.email, user.phone, user.displayName, user.id], filter.search)
            : true,
        )
        .sort((a, b) => {
          const left = String(a[sortBy] ?? '');
          const right = String(b[sortBy] ?? '');
          return dir === 'asc' ? left.localeCompare(right) : right.localeCompare(left);
        })
        .map(clone);
      return paginate(rows, filter.page, filter.pageSize);
    },
    async count(filter) {
      let total = 0;
      for (const user of db.users.values()) {
        if (!notDeleted(user)) continue;
        if (filter?.status && user.status !== filter.status) continue;
        if (filter?.createdAfter && user.createdAt < filter.createdAfter) continue;
        total += 1;
      }
      return total;
    },
    async create(user) {
      db.users.set(user.id, clone(user));
      return clone(user);
    },
    async update(userId, patch) {
      const existing = db.users.get(userId);
      if (!existing) throw notFound('ไม่พบผู้ใช้งาน');
      const next: User = { ...existing, ...patch, id: existing.id, updatedAt: nowIso() };
      db.users.set(userId, next);
      return clone(next);
    },
  };

  const loginEvents: RepositoryBundle['loginEvents'] = {
    async record(event: LoginEvent) {
      db.loginEvents.set(event.id, clone(event));
    },
    async listByUser(userId, limit) {
      return [...db.loginEvents.values()]
        .filter((event) => event.userId === userId)
        .sort(byCreatedAtDesc)
        .slice(0, limit)
        .map(clone);
    },
  };

  const wallets: RepositoryBundle['wallets'] = {
    async findByUserId(userId) {
      const walletId = db.walletsByUser.get(userId);
      const wallet = walletId ? db.wallets.get(walletId) : undefined;
      return wallet ? clone(wallet) : null;
    },
    async requireByUserId(userId) {
      const wallet = await wallets.findByUserId(userId);
      if (!wallet) throw notFound('ไม่พบกระเป๋าเงินของผู้ใช้');
      return wallet;
    },
    async create(wallet: Wallet) {
      db.wallets.set(wallet.id, clone(wallet));
      db.walletsByUser.set(wallet.userId, wallet.id);
      return clone(wallet);
    },
    async updateBalance(walletId, expectedVersion, patch) {
      const wallet = db.wallets.get(walletId);
      if (!wallet) throw notFound('ไม่พบกระเป๋าเงิน');
      // Compare-and-set: the in-memory analogue of
      // UPDATE wallets SET ... WHERE id = $1 AND version = $2
      if (wallet.version !== expectedVersion) return null;
      const next: Wallet = {
        ...wallet,
        ...(patch.balance === undefined ? {} : { balance: patch.balance }),
        ...(patch.held === undefined ? {} : { held: patch.held }),
        version: wallet.version + 1,
        updatedAt: nowIso(),
      };
      db.wallets.set(walletId, next);
      return clone(next);
    },
    async totalBalance() {
      let total = 0;
      for (const wallet of db.wallets.values()) total += wallet.balance + wallet.held;
      return total;
    },
  };

  const walletTransactions: RepositoryBundle['walletTransactions'] = {
    async append(transaction: WalletTransaction) {
      db.walletTransactions.set(transaction.id, clone(transaction));
      return clone(transaction);
    },
    async findMany(filter) {
      const rows = [...db.walletTransactions.values()]
        .filter((tx) => (filter.userId ? tx.userId === filter.userId : true))
        .filter((tx) => (filter.type && filter.type !== 'all' ? tx.type === filter.type : true))
        .filter((tx) => (filter.status && filter.status !== 'all' ? tx.status === filter.status : true))
        .filter((tx) => withinRange(tx.createdAt, filter.from, filter.to))
        .filter((tx) =>
          filter.search ? matches([tx.id, tx.description, tx.referenceId, tx.userId], filter.search) : true,
        )
        .sort(byCreatedAtDesc)
        .map(clone);
      return paginate(rows, filter.page, filter.pageSize);
    },
    async findByReference(referenceType, referenceId) {
      return [...db.walletTransactions.values()]
        .filter((tx) => tx.referenceType === referenceType && tx.referenceId === referenceId)
        .sort(byCreatedAtDesc)
        .map(clone);
    },
    async sumByType(type: WalletTxType, from, to) {
      let total = 0;
      for (const tx of db.walletTransactions.values()) {
        if (tx.type !== type || tx.status !== 'completed') continue;
        if (!withinRange(tx.createdAt, from, to)) continue;
        total += tx.amount;
      }
      return total;
    },
    async sumAllCompleted(userId) {
      let total = 0;
      for (const tx of db.walletTransactions.values()) {
        if (tx.status !== 'completed') continue;
        if (userId && tx.userId !== userId) continue;
        total += tx.amount;
      }
      return total;
    },
  };

  const lotteries: RepositoryBundle['lotteries'] = {
    async list(options) {
      return [...db.lotteries.values()]
        .filter(notDeleted)
        .filter((lottery) => (options?.includeInactive ? true : lottery.status === 'active'))
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map(clone);
    },
    async findById(lotteryId) {
      const lottery = db.lotteries.get(lotteryId);
      return lottery && notDeleted(lottery) ? clone(lottery) : null;
    },
    async findBySlug(slug) {
      for (const lottery of db.lotteries.values()) {
        if (notDeleted(lottery) && lottery.slug === slug) return clone(lottery);
      }
      return null;
    },
    async create(lottery: Lottery) {
      db.lotteries.set(lottery.id, clone(lottery));
      return clone(lottery);
    },
    async update(lotteryId, patch) {
      const existing = db.lotteries.get(lotteryId);
      if (!existing) throw notFound('ไม่พบหวย');
      const next: Lottery = { ...existing, ...patch, id: existing.id, updatedAt: nowIso() };
      db.lotteries.set(lotteryId, next);
      return clone(next);
    },
    async softDelete(lotteryId) {
      const existing = db.lotteries.get(lotteryId);
      if (!existing) return;
      db.lotteries.set(lotteryId, { ...existing, deletedAt: nowIso(), updatedAt: nowIso() });
    },
  };

  const rounds: RepositoryBundle['rounds'] = {
    async findById(roundId) {
      const round = db.rounds.get(roundId);
      return round && notDeleted(round) ? clone(round) : null;
    },
    async findMany(filter) {
      const rows = [...db.rounds.values()]
        .filter(notDeleted)
        .filter((round) => (filter.lotteryId ? round.lotteryId === filter.lotteryId : true))
        .filter((round) => (filter.status && filter.status !== 'all' ? round.status === filter.status : true))
        .filter((round) => withinRange(round.closeAt, filter.from, filter.to))
        .sort((a, b) => b.closeAt.localeCompare(a.closeAt))
        .map(clone);
      return paginate(rows, filter.page, filter.pageSize);
    },
    async findCurrentForLottery(lotteryId, nowMs) {
      const candidates = [...db.rounds.values()]
        .filter(notDeleted)
        .filter((round) => round.lotteryId === lotteryId)
        .filter((round) => round.status !== 'cancelled')
        .filter((round) => new Date(round.closeAt).getTime() > nowMs)
        .sort((a, b) => a.closeAt.localeCompare(b.closeAt));
      const next = candidates[0];
      return next ? clone(next) : null;
    },
    async findCurrentForLotteries(lotteryIds, nowMs) {
      // Single pass over rounds instead of one query per lottery — the in-memory
      // equivalent of avoiding an N+1.
      const wanted = new Set(lotteryIds);
      const best = new Map<string, LotteryRound>();
      for (const round of db.rounds.values()) {
        if (!notDeleted(round) || !wanted.has(round.lotteryId)) continue;
        if (round.status === 'cancelled') continue;
        if (new Date(round.closeAt).getTime() <= nowMs) continue;
        const current = best.get(round.lotteryId);
        if (!current || round.closeAt < current.closeAt) best.set(round.lotteryId, round);
      }
      return new Map([...best].map(([key, value]) => [key, clone(value)]));
    },
    async findRecentForLottery(lotteryId, limit) {
      return [...db.rounds.values()]
        .filter(notDeleted)
        .filter((round) => round.lotteryId === lotteryId)
        .sort((a, b) => b.closeAt.localeCompare(a.closeAt))
        .slice(0, limit)
        .map(clone);
    },
    async create(round: LotteryRound) {
      db.rounds.set(round.id, clone(round));
      return clone(round);
    },
    async update(roundId, patch) {
      const existing = db.rounds.get(roundId);
      if (!existing) throw notFound('ไม่พบงวดหวย');
      const next: LotteryRound = { ...existing, ...patch, id: existing.id, updatedAt: nowIso() };
      db.rounds.set(roundId, next);
      return clone(next);
    },
  };

  const betTypes: RepositoryBundle['betTypes'] = {
    async list(options) {
      return [...db.betTypes.values()]
        .filter(notDeleted)
        .filter((betType) => (options?.includeInactive ? true : betType.isActive))
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map(clone);
    },
    async findByCode(code) {
      for (const betType of db.betTypes.values()) {
        if (notDeleted(betType) && betType.code === code) return clone(betType);
      }
      return null;
    },
    async findByCodes(codes) {
      const wanted = new Set(codes);
      return [...db.betTypes.values()]
        .filter((betType) => notDeleted(betType) && wanted.has(betType.code))
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map(clone);
    },
    async create(betType: BetType) {
      db.betTypes.set(betType.id, clone(betType));
      return clone(betType);
    },
    async update(betTypeId, patch) {
      const existing = db.betTypes.get(betTypeId);
      if (!existing) throw notFound('ไม่พบประเภทการแทง');
      const next: BetType = { ...existing, ...patch, id: existing.id, updatedAt: nowIso() };
      db.betTypes.set(betTypeId, next);
      return clone(next);
    },
  };

  function activeRatesFor(betTypeCode: string, lotteryId: string, atIso: string): PayoutRate[] {
    return [...db.payoutRates.values()].filter((rate) => {
      if (!notDeleted(rate) || !rate.isActive) return false;
      if (rate.betTypeCode !== betTypeCode) return false;
      if (rate.lotteryId !== null && rate.lotteryId !== lotteryId) return false;
      if (rate.effectiveFrom > atIso) return false;
      if (rate.effectiveTo && rate.effectiveTo <= atIso) return false;
      return true;
    });
  }

  function mostSpecific(candidates: PayoutRate[]): PayoutRate | null {
    if (candidates.length === 0) return null;
    const sorted = [...candidates].sort((a, b) => {
      // Lottery-scoped rate beats the platform default; newest effectiveFrom wins.
      if ((a.lotteryId === null) !== (b.lotteryId === null)) return a.lotteryId === null ? 1 : -1;
      return b.effectiveFrom.localeCompare(a.effectiveFrom);
    });
    return sorted[0] ?? null;
  }

  const payoutRates: RepositoryBundle['payoutRates'] = {
    async list() {
      return [...db.payoutRates.values()].filter(notDeleted).map(clone);
    },
    async resolve(betTypeCode, lotteryId, atIso) {
      const winner = mostSpecific(activeRatesFor(betTypeCode, lotteryId, atIso));
      return winner ? clone(winner) : null;
    },
    async resolveMany(betTypeCodes, lotteryId, atIso) {
      const out = new Map<string, PayoutRate>();
      for (const code of new Set(betTypeCodes)) {
        const winner = mostSpecific(activeRatesFor(code, lotteryId, atIso));
        if (winner) out.set(code, clone(winner));
      }
      return out;
    },
    async upsert(rate: PayoutRate) {
      db.payoutRates.set(rate.id, clone(rate));
      return clone(rate);
    },
    async update(rateId, patch) {
      const existing = db.payoutRates.get(rateId);
      if (!existing) throw notFound('ไม่พบอัตราจ่าย');
      const next: PayoutRate = { ...existing, ...patch, id: existing.id, updatedAt: nowIso() };
      db.payoutRates.set(rateId, next);
      return clone(next);
    },
  };

  const bets: RepositoryBundle['bets'] = {
    async findById(betId) {
      const bet = db.bets.get(betId);
      return bet && notDeleted(bet) ? clone(bet) : null;
    },
    async findMany(filter) {
      const rows = [...db.bets.values()]
        .filter(notDeleted)
        .filter((bet) => (filter.userId ? bet.userId === filter.userId : true))
        .filter((bet) => (filter.lotteryId ? bet.lotteryId === filter.lotteryId : true))
        .filter((bet) => (filter.roundId ? bet.roundId === filter.roundId : true))
        .filter((bet) => (filter.status && filter.status !== 'all' ? bet.status === filter.status : true))
        .filter((bet) => withinRange(bet.createdAt, filter.from, filter.to))
        .filter((bet) => (filter.search ? matches([bet.id, bet.reference, bet.userId], filter.search) : true))
        .sort(byCreatedAtDesc)
        .map(clone);
      return paginate(rows, filter.page, filter.pageSize);
    },
    async findConfirmedForRound(roundId, cursor, limit) {
      return [...db.bets.values()]
        .filter((bet) => notDeleted(bet) && bet.roundId === roundId && bet.status === 'confirmed')
        .sort((a, b) => a.id.localeCompare(b.id))
        .slice(cursor, cursor + limit)
        .map(clone);
    },
    async countForRound(roundId) {
      let total = 0;
      for (const bet of db.bets.values()) {
        if (notDeleted(bet) && bet.roundId === roundId) total += 1;
      }
      return total;
    },
    async create(bet: Bet) {
      db.bets.set(bet.id, clone(bet));
      return clone(bet);
    },
    async update(betId, patch) {
      const existing = db.bets.get(betId);
      if (!existing) throw notFound('ไม่พบบิลแทง');
      const next: Bet = { ...existing, ...patch, id: existing.id, updatedAt: nowIso() };
      db.bets.set(betId, next);
      return clone(next);
    },
    async sumStake(filter) {
      let total = 0;
      for (const bet of db.bets.values()) {
        if (!notDeleted(bet)) continue;
        if (filter.userId && bet.userId !== filter.userId) continue;
        if (!withinRange(bet.createdAt, filter.from, filter.to)) continue;
        if (bet.status === 'cancelled' || bet.status === 'void') continue;
        total += bet.totalStake;
      }
      return total;
    },
    async sumPayout(filter) {
      let total = 0;
      for (const bet of db.bets.values()) {
        if (!notDeleted(bet)) continue;
        if (filter.userId && bet.userId !== filter.userId) continue;
        if (!withinRange(bet.createdAt, filter.from, filter.to)) continue;
        total += bet.totalPayout;
      }
      return total;
    },
    async sumStakeOnNumber(userId, roundId, betTypeCode, numbers) {
      const wanted = new Set(numbers);
      const out = new Map<string, number>();
      for (const number of wanted) out.set(number, 0);
      for (const bet of db.bets.values()) {
        if (bet.userId !== userId || bet.roundId !== roundId) continue;
        if (bet.status === 'cancelled' || bet.status === 'void') continue;
        for (const item of bet.items) {
          if (item.betTypeCode !== betTypeCode || !wanted.has(item.number)) continue;
          out.set(item.number, (out.get(item.number) ?? 0) + item.stake);
        }
      }
      return out;
    },
  };

  const results: RepositoryBundle['results'] = {
    async findByRoundId(roundId) {
      const resultId = db.resultByRound.get(roundId);
      const result = resultId ? db.results.get(resultId) : undefined;
      return result ? clone(result) : null;
    },
    async findManyByRoundIds(roundIds) {
      const out = new Map<string, LotteryResult>();
      for (const roundId of roundIds) {
        const resultId = db.resultByRound.get(roundId);
        const result = resultId ? db.results.get(resultId) : undefined;
        if (result) out.set(roundId, clone(result));
      }
      return out;
    },
    async findLatest(limit, lotteryId) {
      return [...db.results.values()]
        .filter(notDeleted)
        .filter((result) => (lotteryId ? result.lotteryId === lotteryId : true))
        .sort((a, b) => b.announcedAt.localeCompare(a.announcedAt))
        .slice(0, limit)
        .map(clone);
    },
    async findMany(filter) {
      const rows = [...db.results.values()]
        .filter(notDeleted)
        .filter((result) => (filter.lotteryId ? result.lotteryId === filter.lotteryId : true))
        .filter((result) => (filter.dateKey ? result.announcedAt.slice(0, 10) === filter.dateKey : true))
        .sort((a, b) => b.announcedAt.localeCompare(a.announcedAt))
        .map(clone);
      return paginate(rows, filter.page, filter.pageSize);
    },
    async create(result: LotteryResult) {
      db.results.set(result.id, clone(result));
      db.resultByRound.set(result.roundId, result.id);
      return clone(result);
    },
  };

  const deposits: RepositoryBundle['deposits'] = {
    async findById(depositId) {
      const deposit = db.deposits.get(depositId);
      return deposit && notDeleted(deposit) ? clone(deposit) : null;
    },
    async findMany(filter) {
      const rows = [...db.deposits.values()]
        .filter(notDeleted)
        .filter((deposit) => (filter.userId ? deposit.userId === filter.userId : true))
        .filter((deposit) => (filter.status && filter.status !== 'all' ? deposit.status === filter.status : true))
        .filter((deposit) => withinRange(deposit.createdAt, filter.from, filter.to))
        .filter((deposit) =>
          filter.search ? matches([deposit.id, deposit.reference, deposit.userId], filter.search) : true,
        )
        .sort(byCreatedAtDesc)
        .map(clone);
      return paginate(rows, filter.page, filter.pageSize);
    },
    async create(deposit: Deposit) {
      db.deposits.set(deposit.id, clone(deposit));
      return clone(deposit);
    },
    async update(depositId, patch) {
      const existing = db.deposits.get(depositId);
      if (!existing) throw notFound('ไม่พบรายการฝากเงิน');
      const next: Deposit = { ...existing, ...patch, id: existing.id, updatedAt: nowIso() };
      db.deposits.set(depositId, next);
      return clone(next);
    },
    async sumAmount(filter) {
      let total = 0;
      for (const deposit of db.deposits.values()) {
        if (!notDeleted(deposit)) continue;
        if (filter.status && deposit.status !== filter.status) continue;
        if (!withinRange(deposit.createdAt, filter.from, filter.to)) continue;
        total += deposit.amount;
      }
      return total;
    },
    async countByStatus(status: DepositStatus) {
      let total = 0;
      for (const deposit of db.deposits.values()) {
        if (notDeleted(deposit) && deposit.status === status) total += 1;
      }
      return total;
    },
  };

  const withdrawals: RepositoryBundle['withdrawals'] = {
    async findById(withdrawalId) {
      const withdrawal = db.withdrawals.get(withdrawalId);
      return withdrawal && notDeleted(withdrawal) ? clone(withdrawal) : null;
    },
    async findMany(filter) {
      const rows = [...db.withdrawals.values()]
        .filter(notDeleted)
        .filter((row) => (filter.userId ? row.userId === filter.userId : true))
        .filter((row) => (filter.status && filter.status !== 'all' ? row.status === filter.status : true))
        .filter((row) => withinRange(row.createdAt, filter.from, filter.to))
        .filter((row) => (filter.search ? matches([row.id, row.reference, row.userId], filter.search) : true))
        .sort(byCreatedAtDesc)
        .map(clone);
      return paginate(rows, filter.page, filter.pageSize);
    },
    async create(withdrawal: Withdrawal) {
      db.withdrawals.set(withdrawal.id, clone(withdrawal));
      return clone(withdrawal);
    },
    async update(withdrawalId, patch) {
      const existing = db.withdrawals.get(withdrawalId);
      if (!existing) throw notFound('ไม่พบรายการถอนเงิน');
      const next: Withdrawal = { ...existing, ...patch, id: existing.id, updatedAt: nowIso() };
      db.withdrawals.set(withdrawalId, next);
      return clone(next);
    },
    async sumAmount(filter) {
      let total = 0;
      for (const row of db.withdrawals.values()) {
        if (!notDeleted(row)) continue;
        if (filter.status && row.status !== filter.status) continue;
        if (!withinRange(row.createdAt, filter.from, filter.to)) continue;
        total += row.amount;
      }
      return total;
    },
    async countByStatus(status: WithdrawalStatus) {
      let total = 0;
      for (const row of db.withdrawals.values()) {
        if (notDeleted(row) && row.status === status) total += 1;
      }
      return total;
    },
  };

  const notifications: RepositoryBundle['notifications'] = {
    async listByUser(userId, options) {
      return [...db.notifications.values()]
        .filter(notDeleted)
        .filter((row) => row.userId === userId)
        .filter((row) => (options?.unreadOnly ? row.readAt === null : true))
        .sort(byCreatedAtDesc)
        .slice(0, options?.limit ?? 50)
        .map(clone);
    },
    async countUnread(userId) {
      let total = 0;
      for (const row of db.notifications.values()) {
        if (notDeleted(row) && row.userId === userId && row.readAt === null) total += 1;
      }
      return total;
    },
    async create(notification: Notification) {
      db.notifications.set(notification.id, clone(notification));
      return clone(notification);
    },
    async createMany(rows) {
      for (const row of rows) db.notifications.set(row.id, clone(row));
    },
    async markRead(notificationId, userId) {
      const existing = db.notifications.get(notificationId);
      if (!existing || existing.userId !== userId || existing.readAt) return;
      db.notifications.set(notificationId, { ...existing, readAt: nowIso(), updatedAt: nowIso() });
    },
    async markAllRead(userId) {
      let changed = 0;
      const at = nowIso();
      for (const [key, row] of db.notifications) {
        if (row.userId !== userId || row.readAt) continue;
        db.notifications.set(key, { ...row, readAt: at, updatedAt: at });
        changed += 1;
      }
      return changed;
    },
  };

  const audit: RepositoryBundle['audit'] = {
    async record(log: AuditLog) {
      db.auditLogs.set(log.id, clone(log));
    },
    async findMany(filter) {
      const rows = [...db.auditLogs.values()]
        .filter((row) => (filter.actorId ? row.actorId === filter.actorId : true))
        .filter((row) => (filter.action ? row.action === filter.action : true))
        .filter((row) => (filter.resource ? row.resource === filter.resource : true))
        .filter((row) => withinRange(row.createdAt, filter.from, filter.to))
        .filter((row) =>
          filter.search ? matches([row.id, row.action, row.resource, row.resourceId, row.actorId], filter.search) : true,
        )
        .sort(byCreatedAtDesc)
        .map(clone);
      return paginate(rows, filter.page, filter.pageSize);
    },
  };

  const idempotency: RepositoryBundle['idempotency'] = {
    async claim(record: IdempotencyRecord) {
      const existing = db.idempotency.get(record.key);
      if (existing) {
        if (existing.expiresAt > nowIso()) return { claimed: false, existing: clone(existing) };
        db.idempotency.delete(record.key);
      }
      // Single-threaded JS between awaits makes this check-and-set atomic here;
      // in PostgreSQL it becomes INSERT ... ON CONFLICT DO NOTHING.
      db.idempotency.set(record.key, clone(record));
      return { claimed: true, existing: null };
    },
    async complete(key, responseJson) {
      const existing = db.idempotency.get(key);
      if (!existing) return;
      db.idempotency.set(key, {
        ...existing,
        status: 'completed',
        responseJson,
        completedAt: nowIso(),
      });
    },
    async release(key) {
      db.idempotency.delete(key);
    },
    async get(key) {
      const existing = db.idempotency.get(key);
      return existing ? clone(existing) : null;
    },
    async purgeExpired(at) {
      let removed = 0;
      for (const [key, record] of db.idempotency) {
        if (record.expiresAt <= at) {
          db.idempotency.delete(key);
          removed += 1;
        }
      }
      return removed;
    },
  };

  const settlementLocks: RepositoryBundle['settlementLocks'] = {
    async tryLock(roundId) {
      if (db.settledRounds.has(roundId)) return false;
      db.settledRounds.add(roundId);
      return true;
    },
    async isSettled(roundId) {
      return db.settledRounds.has(roundId);
    },
    async unlock(roundId) {
      db.settledRounds.delete(roundId);
    },
  };

  return {
    users,
    loginEvents,
    wallets,
    walletTransactions,
    lotteries,
    rounds,
    betTypes,
    payoutRates,
    bets,
    results,
    deposits,
    withdrawals,
    notifications,
    audit,
    idempotency,
    settlementLocks,
  };
}
