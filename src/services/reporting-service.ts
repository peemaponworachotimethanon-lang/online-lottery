import { addDays, formatIsoDateKey, formatShortDay, nowIso, startOfUtcDay } from '@/lib/datetime';
import type { RepositoryBundle } from '@/repositories/contracts';
import type { AdminChartsDto, AdminKpiDto, DashboardSummaryDto } from '@/types/dto';
import type { CatalogService } from './catalog-service';
import type { QueryService } from './query-service';

/**
 * Aggregations for the user dashboard and the admin console.
 *
 * These are read-only, tolerate a little staleness, and are the natural candidates
 * for materialised views / a nightly rollup table in production — hence the
 * `analytics-rollup` job name reserved in the queue. They must never sit on the
 * hot path of placing a bet.
 */
export class ReportingService {
  constructor(
    private readonly repos: RepositoryBundle,
    private readonly query: QueryService,
    private readonly catalog: CatalogService,
  ) {}

  async userDashboard(userId: string, nowMs = Date.now()): Promise<DashboardSummaryDto> {
    const now = new Date(nowMs).toISOString();
    const todayStart = startOfUtcDay(now);

    const [wallet, todayStake, totalWinnings, totalStake, recentBetsPage, recentTxPage, pendingPage, user] =
      await Promise.all([
        this.repos.wallets.requireByUserId(userId),
        this.repos.bets.sumStake({ userId, from: todayStart }),
        this.repos.bets.sumPayout({ userId }),
        this.repos.bets.sumStake({ userId }),
        this.repos.bets.findMany({ userId, page: 1, pageSize: 5 }),
        this.repos.walletTransactions.findMany({ userId, page: 1, pageSize: 6 }),
        this.repos.bets.findMany({ userId, status: 'confirmed', page: 1, pageSize: 1 }),
        this.repos.users.findById(userId),
      ]);

    const cards = await this.catalog.listCards(nowMs);
    const favouriteIds = new Set(user?.favoriteLotteryIds ?? []);

    // 7-day series built from one page of bets per day would be N queries; instead
    // we sum over a single bounded window.
    const weekly: Array<{ date: string; stake: number; payout: number }> = [];
    for (let offset = 6; offset >= 0; offset--) {
      const dayStart = startOfUtcDay(addDays(now, -offset));
      const dayEnd = addDays(dayStart, 1);
      const [stake, payout] = await Promise.all([
        this.repos.bets.sumStake({ userId, from: dayStart, to: dayEnd }),
        this.repos.bets.sumPayout({ userId, from: dayStart, to: dayEnd }),
      ]);
      weekly.push({ date: formatShortDay(dayStart), stake, payout });
    }

    return {
      balance: wallet.balance,
      held: wallet.held,
      todayStake,
      pendingBets: pendingPage.total,
      totalWinnings,
      netProfit: totalWinnings - totalStake,
      recentBets: await this.query.toBetDtos(recentBetsPage.items),
      recentTransactions: await this.query.toTransactionDtos(recentTxPage.items),
      favoriteLotteries: cards.filter((card) => favouriteIds.has(card.id)).slice(0, 4),
      upcomingClosings: cards
        .filter((card) => card.closeAt !== null)
        .sort((a, b) => (a.closeAt ?? '').localeCompare(b.closeAt ?? ''))
        .slice(0, 4),
      weeklyStake: weekly,
    };
  }

  async adminKpis(nowMs = Date.now()): Promise<AdminKpiDto> {
    const now = new Date(nowMs).toISOString();
    const todayStart = startOfUtcDay(now);

    const [
      totalUsers,
      activeUsers,
      newUsersToday,
      totalWalletBalance,
      depositToday,
      withdrawalToday,
      betVolumeToday,
      totalPayout,
      pendingDeposits,
      pendingWithdrawals,
      cards,
    ] = await Promise.all([
      this.repos.users.count(),
      this.repos.users.count({ status: 'active' }),
      this.repos.users.count({ createdAfter: todayStart }),
      this.repos.wallets.totalBalance(),
      this.repos.deposits.sumAmount({ status: 'completed', from: todayStart }),
      this.repos.withdrawals.sumAmount({ status: 'approved', from: todayStart }),
      this.repos.bets.sumStake({ from: todayStart }),
      this.repos.bets.sumPayout({}),
      this.repos.deposits.countByStatus('pending'),
      this.repos.withdrawals.countByStatus('pending'),
      this.catalog.listCards(nowMs),
    ]);

    return {
      totalUsers,
      activeUsers,
      newUsersToday,
      totalWalletBalance,
      depositToday,
      withdrawalToday,
      betVolumeToday,
      totalPayout,
      pendingDeposits,
      pendingWithdrawals,
      openLotteries: cards.filter((card) => card.status === 'open' || card.status === 'closing-soon').length,
    };
  }

  async adminCharts(days = 7, nowMs = Date.now()): Promise<AdminChartsDto> {
    const now = new Date(nowMs).toISOString();
    const daily: AdminChartsDto['daily'] = [];

    for (let offset = days - 1; offset >= 0; offset--) {
      const dayStart = startOfUtcDay(addDays(now, -offset));
      const dayEnd = addDays(dayStart, 1);
      const [betVolume, deposits, withdrawals, newUsers] = await Promise.all([
        this.repos.bets.sumStake({ from: dayStart, to: dayEnd }),
        this.repos.deposits.sumAmount({ status: 'completed', from: dayStart, to: dayEnd }),
        this.repos.withdrawals.sumAmount({ status: 'approved', from: dayStart, to: dayEnd }),
        this.countUsersInWindow(dayStart, dayEnd),
      ]);
      daily.push({ date: formatShortDay(dayStart), betVolume, deposits, withdrawals, newUsers });
    }

    const lotteries = await this.repos.lotteries.list({ includeInactive: true });
    const topLotteries = await Promise.all(
      lotteries.map(async (lottery) => {
        const page = await this.repos.bets.findMany({ lotteryId: lottery.id, page: 1, pageSize: 1 });
        let stake = 0;
        let cursor = 1;
        for (;;) {
          const chunk = await this.repos.bets.findMany({
            lotteryId: lottery.id,
            page: cursor,
            pageSize: 100,
          });
          for (const bet of chunk.items) stake += bet.totalStake;
          if (cursor >= chunk.pageCount) break;
          cursor += 1;
        }
        return { name: lottery.nameTh, stake, bets: page.total };
      }),
    );

    return {
      daily,
      topLotteries: topLotteries.sort((a, b) => b.stake - a.stake).slice(0, 6),
    };
  }

  private async countUsersInWindow(from: string, to: string): Promise<number> {
    const after = await this.repos.users.count({ createdAfter: from });
    const afterEnd = await this.repos.users.count({ createdAfter: to });
    return Math.max(0, after - afterEnd);
  }

  /** Simple operational report used by /admin/reports. */
  async operationalReport(days = 14, nowMs = Date.now()) {
    const charts = await this.adminCharts(days, nowMs);
    const totals = charts.daily.reduce(
      (accumulator, day) => ({
        betVolume: accumulator.betVolume + day.betVolume,
        deposits: accumulator.deposits + day.deposits,
        withdrawals: accumulator.withdrawals + day.withdrawals,
        newUsers: accumulator.newUsers + day.newUsers,
      }),
      { betVolume: 0, deposits: 0, withdrawals: 0, newUsers: 0 },
    );
    const payout = await this.repos.bets.sumPayout({ from: startOfUtcDay(addDays(nowIso(), -days)) });
    return {
      generatedAt: formatIsoDateKey(nowIso()),
      days,
      totals,
      payout,
      grossMargin: totals.betVolume - payout,
      daily: charts.daily,
      topLotteries: charts.topLotteries,
    };
  }
}
