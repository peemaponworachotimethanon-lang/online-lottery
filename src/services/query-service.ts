import { formatRate } from '@/lib/money';
import type {
  BetFilter,
  DepositFilter,
  RepositoryBundle,
  TransactionFilter,
  UserFilter,
  WithdrawalFilter,
} from '@/repositories/contracts';
import type { Bet, BetType, Deposit, Page, User, WalletTransaction, Withdrawal } from '@/types/domain';
import type {
  AdminUserDto,
  BetDto,
  DepositDto,
  TransactionDto,
  WithdrawalDto,
} from '@/types/dto';

/**
 * Read-side query service.
 *
 * Every list endpoint goes through here so that:
 *   - pagination is always server-side (no "fetch everything and slice in React"),
 *   - rows are projected to DTOs before crossing the network,
 *   - related entities are hydrated in ONE batched lookup per relation, which is
 *     the in-memory equivalent of avoiding an N+1 join.
 */
export class QueryService {
  constructor(private readonly repos: RepositoryBundle) {}

  private async usernameMap(userIds: readonly string[]): Promise<Map<string, string>> {
    const unique = [...new Set(userIds)];
    if (unique.length === 0) return new Map();
    const users = await this.repos.users.findByIds(unique);
    return new Map(users.map((user) => [user.id, user.username]));
  }

  private async betTypeNames(): Promise<Map<string, BetType>> {
    const betTypes = await this.repos.betTypes.list({ includeInactive: true });
    return new Map(betTypes.map((betType) => [betType.code, betType]));
  }

  async toBetDtos(bets: readonly Bet[]): Promise<BetDto[]> {
    if (bets.length === 0) return [];
    const [usernames, betTypes, lotteries] = await Promise.all([
      this.usernameMap(bets.map((bet) => bet.userId)),
      this.betTypeNames(),
      this.repos.lotteries.list({ includeInactive: true }),
    ]);
    const lotteryById = new Map(lotteries.map((lottery) => [lottery.id, lottery]));

    const roundIds = [...new Set(bets.map((bet) => bet.roundId))];
    const rounds = await Promise.all(roundIds.map((roundId) => this.repos.rounds.findById(roundId)));
    const roundById = new Map(
      rounds.filter((round) => round !== null).map((round) => [round.id, round]),
    );

    return bets.map((bet) => ({
      id: bet.id,
      reference: bet.reference,
      userId: bet.userId,
      username: usernames.get(bet.userId) ?? '—',
      lotteryName: lotteryById.get(bet.lotteryId)?.nameTh ?? '—',
      roundCode: roundById.get(bet.roundId)?.roundCode ?? '—',
      status: bet.status,
      totalStake: bet.totalStake,
      totalPotentialPayout: bet.totalPotentialPayout,
      totalPayout: bet.totalPayout,
      itemCount: bet.items.length,
      items: bet.items.map((item) => ({
        id: item.id,
        betTypeCode: item.betTypeCode,
        betTypeName: betTypes.get(item.betTypeCode)?.nameTh ?? item.betTypeCode,
        number: item.number,
        stake: item.stake,
        rateMilli: item.rateAtBet,
        potentialPayout: item.potentialPayout,
        payout: item.payout,
        status: item.status,
      })),
      createdAt: bet.createdAt,
      settledAt: bet.settledAt,
    }));
  }

  async findBets(filter: BetFilter): Promise<Page<BetDto>> {
    const page = await this.repos.bets.findMany(filter);
    return { ...page, items: await this.toBetDtos(page.items) };
  }

  async toTransactionDtos(rows: readonly WalletTransaction[]): Promise<TransactionDto[]> {
    const usernames = await this.usernameMap(rows.map((row) => row.userId));
    return rows.map((row) => ({
      id: row.id,
      userId: row.userId,
      username: usernames.get(row.userId) ?? '—',
      type: row.type,
      amount: row.amount,
      balanceBefore: row.balanceBefore,
      balanceAfter: row.balanceAfter,
      status: row.status,
      referenceId: row.referenceId,
      description: row.description,
      createdAt: row.createdAt,
    }));
  }

  async findTransactions(filter: TransactionFilter): Promise<Page<TransactionDto>> {
    const page = await this.repos.walletTransactions.findMany(filter);
    return { ...page, items: await this.toTransactionDtos(page.items) };
  }

  private async toDepositDtos(rows: readonly Deposit[]): Promise<DepositDto[]> {
    const usernames = await this.usernameMap(rows.map((row) => row.userId));
    return rows.map((row) => ({
      id: row.id,
      reference: row.reference,
      userId: row.userId,
      username: usernames.get(row.userId) ?? '—',
      amount: row.amount,
      method: row.method === 'qr' ? 'QR Payment' : 'โอนผ่านธนาคาร',
      status: row.status,
      createdAt: row.createdAt,
      reviewedAt: row.reviewedAt,
      note: row.note,
    }));
  }

  async findDeposits(filter: DepositFilter): Promise<Page<DepositDto>> {
    const page = await this.repos.deposits.findMany(filter);
    return { ...page, items: await this.toDepositDtos(page.items) };
  }

  private async toWithdrawalDtos(rows: readonly Withdrawal[]): Promise<WithdrawalDto[]> {
    const usernames = await this.usernameMap(rows.map((row) => row.userId));
    return rows.map((row) => ({
      id: row.id,
      reference: row.reference,
      userId: row.userId,
      username: usernames.get(row.userId) ?? '—',
      amount: row.amount,
      bankName: row.bankName,
      bankAccountNumber: row.bankAccountNumber,
      bankAccountName: row.bankAccountName,
      status: row.status,
      createdAt: row.createdAt,
      reviewedAt: row.reviewedAt,
      note: row.note,
    }));
  }

  async findWithdrawals(filter: WithdrawalFilter): Promise<Page<WithdrawalDto>> {
    const page = await this.repos.withdrawals.findMany(filter);
    return { ...page, items: await this.toWithdrawalDtos(page.items) };
  }

  private async toAdminUserDtos(users: readonly User[]): Promise<AdminUserDto[]> {
    const wallets = await Promise.all(users.map((user) => this.repos.wallets.findByUserId(user.id)));
    return users.map((user, index) => {
      const wallet = wallets[index];
      return {
        id: user.id,
        username: user.username,
        email: user.email,
        phone: user.phone,
        displayName: user.displayName,
        balance: wallet?.balance ?? 0,
        held: wallet?.held ?? 0,
        roles: user.roles,
        status: user.status,
        createdAt: user.createdAt,
        lastLoginAt: user.lastLoginAt,
      };
    });
  }

  async findUsers(filter: UserFilter): Promise<Page<AdminUserDto>> {
    const page = await this.repos.users.findMany(filter);
    return { ...page, items: await this.toAdminUserDtos(page.items) };
  }

  async getUserDetail(userId: string) {
    const user = await this.repos.users.findById(userId);
    if (!user) return null;
    const [wallet, bets, transactions, loginEvents, audit] = await Promise.all([
      this.repos.wallets.findByUserId(userId),
      this.repos.bets.findMany({ userId, page: 1, pageSize: 10 }),
      this.repos.walletTransactions.findMany({ userId, page: 1, pageSize: 10 }),
      this.repos.loginEvents.listByUser(userId, 10),
      this.repos.audit.findMany({ actorId: userId, page: 1, pageSize: 10 }),
    ]);

    const [profile] = await this.toAdminUserDtos([user]);
    return {
      profile,
      wallet,
      bets: await this.toBetDtos(bets.items),
      transactions: await this.toTransactionDtos(transactions.items),
      loginEvents,
      audit: audit.items,
    };
  }

  /** Payout-rate table for the admin console, joined with bet type names. */
  async listPayoutRates() {
    const [rates, betTypes, lotteries] = await Promise.all([
      this.repos.payoutRates.list(),
      this.repos.betTypes.list({ includeInactive: true }),
      this.repos.lotteries.list({ includeInactive: true }),
    ]);
    const betTypeByCode = new Map(betTypes.map((betType) => [betType.code, betType]));
    const lotteryById = new Map(lotteries.map((lottery) => [lottery.id, lottery]));

    return rates
      .map((rate) => ({
        id: rate.id,
        betTypeCode: rate.betTypeCode,
        betTypeName: betTypeByCode.get(rate.betTypeCode)?.nameTh ?? rate.betTypeCode,
        lotteryId: rate.lotteryId,
        lotteryName: rate.lotteryId ? (lotteryById.get(rate.lotteryId)?.nameTh ?? '—') : 'ทุกหวย (ค่าเริ่มต้น)',
        rateMilli: rate.rateMilli,
        rateLabel: `x${formatRate(rate.rateMilli)}`,
        isActive: rate.isActive,
        effectiveFrom: rate.effectiveFrom,
      }))
      .sort((a, b) => a.betTypeName.localeCompare(b.betTypeName));
  }
}
