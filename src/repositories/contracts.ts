import type {
  AuditLog,
  Bet,
  BetStatus,
  BetType,
  Deposit,
  DepositStatus,
  IdempotencyRecord,
  LoginEvent,
  Lottery,
  LotteryResult,
  LotteryRound,
  Notification,
  Page,
  PageQuery,
  PayoutRate,
  RoleName,
  RoundStatus,
  User,
  UserStatus,
  Wallet,
  WalletTransaction,
  WalletTxType,
  Withdrawal,
  WithdrawalStatus,
} from '@/types/domain';

/**
 * Repository contracts.
 *
 * Services depend on these interfaces only. The demo binds them to the in-memory
 * provider; production binds the same interfaces to Prisma. No component, page,
 * or service imports a concrete provider or a mock array.
 *
 * Query methods take explicit filter objects rather than accepting arbitrary
 * predicates, so a SQL implementation can translate them into indexed WHERE
 * clauses instead of loading the table.
 */

export interface UserFilter extends PageQuery {
  search?: string;
  status?: UserStatus | 'all';
  role?: RoleName | 'all';
  sortBy?: 'createdAt' | 'lastLoginAt' | 'username';
  sortDir?: 'asc' | 'desc';
}

export interface UserRepository {
  findById(userId: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  findByUsername(username: string): Promise<User | null>;
  findByPhone(phone: string): Promise<User | null>;
  findMany(filter: UserFilter): Promise<Page<User>>;
  findByIds(ids: readonly string[]): Promise<User[]>;
  count(filter?: { status?: UserStatus; createdAfter?: string }): Promise<number>;
  create(user: User): Promise<User>;
  update(userId: string, patch: Partial<User>): Promise<User>;
}

export interface LoginEventRepository {
  record(event: LoginEvent): Promise<void>;
  listByUser(userId: string, limit: number): Promise<LoginEvent[]>;
}

export interface WalletRepository {
  findByUserId(userId: string): Promise<Wallet | null>;
  requireByUserId(userId: string): Promise<Wallet>;
  create(wallet: Wallet): Promise<Wallet>;
  /**
   * Compare-and-set on `version`. Returns null when another writer won the race,
   * which is the caller's signal to reload and retry.
   */
  updateBalance(
    walletId: string,
    expectedVersion: number,
    patch: { balance?: number; held?: number },
  ): Promise<Wallet | null>;
  totalBalance(): Promise<number>;
}

export interface TransactionFilter extends PageQuery {
  userId?: string;
  type?: WalletTxType | 'all';
  status?: 'pending' | 'completed' | 'failed' | 'cancelled' | 'all';
  from?: string;
  to?: string;
  search?: string;
}

export interface WalletTransactionRepository {
  append(transaction: WalletTransaction): Promise<WalletTransaction>;
  findMany(filter: TransactionFilter): Promise<Page<WalletTransaction>>;
  findByReference(referenceType: string, referenceId: string): Promise<WalletTransaction[]>;
  sumByType(type: WalletTxType, from?: string, to?: string): Promise<number>;
  /** Sum of every completed row — used by the ledger-integrity check. */
  sumAllCompleted(userId?: string): Promise<number>;
}

export interface LotteryRepository {
  list(options?: { includeInactive?: boolean }): Promise<Lottery[]>;
  findById(lotteryId: string): Promise<Lottery | null>;
  findBySlug(slug: string): Promise<Lottery | null>;
  create(lottery: Lottery): Promise<Lottery>;
  update(lotteryId: string, patch: Partial<Lottery>): Promise<Lottery>;
  softDelete(lotteryId: string): Promise<void>;
}

export interface RoundFilter extends PageQuery {
  lotteryId?: string;
  status?: RoundStatus | 'all';
  from?: string;
  to?: string;
}

export interface RoundRepository {
  findById(roundId: string): Promise<LotteryRound | null>;
  findMany(filter: RoundFilter): Promise<Page<LotteryRound>>;
  /** The round currently accepting bets for a lottery, or the next scheduled one. */
  findCurrentForLottery(lotteryId: string, nowMs: number): Promise<LotteryRound | null>;
  findCurrentForLotteries(
    lotteryIds: readonly string[],
    nowMs: number,
  ): Promise<Map<string, LotteryRound>>;
  findRecentForLottery(lotteryId: string, limit: number): Promise<LotteryRound[]>;
  create(round: LotteryRound): Promise<LotteryRound>;
  update(roundId: string, patch: Partial<LotteryRound>): Promise<LotteryRound>;
}

export interface BetTypeRepository {
  list(options?: { includeInactive?: boolean }): Promise<BetType[]>;
  findByCode(code: string): Promise<BetType | null>;
  findByCodes(codes: readonly string[]): Promise<BetType[]>;
  create(betType: BetType): Promise<BetType>;
  update(betTypeId: string, patch: Partial<BetType>): Promise<BetType>;
}

export interface PayoutRateRepository {
  list(): Promise<PayoutRate[]>;
  /** Most specific active rate: lottery-scoped wins over the platform default. */
  resolve(betTypeCode: string, lotteryId: string, atIso: string): Promise<PayoutRate | null>;
  resolveMany(
    betTypeCodes: readonly string[],
    lotteryId: string,
    atIso: string,
  ): Promise<Map<string, PayoutRate>>;
  upsert(rate: PayoutRate): Promise<PayoutRate>;
  update(rateId: string, patch: Partial<PayoutRate>): Promise<PayoutRate>;
}

export interface BetFilter extends PageQuery {
  userId?: string;
  lotteryId?: string;
  roundId?: string;
  status?: BetStatus | 'all';
  from?: string;
  to?: string;
  search?: string;
}

export interface BetRepository {
  findById(betId: string): Promise<Bet | null>;
  findMany(filter: BetFilter): Promise<Page<Bet>>;
  /** Settlement input: confirmed bets for a round, paged for batch processing. */
  findConfirmedForRound(roundId: string, cursor: number, limit: number): Promise<Bet[]>;
  countForRound(roundId: string): Promise<number>;
  create(bet: Bet): Promise<Bet>;
  update(betId: string, patch: Partial<Bet>): Promise<Bet>;
  sumStake(filter: { userId?: string; from?: string; to?: string }): Promise<number>;
  sumPayout(filter: { userId?: string; from?: string; to?: string }): Promise<number>;
  /** Total stake this user already has on one number for one bet type in a round. */
  sumStakeOnNumber(
    userId: string,
    roundId: string,
    betTypeCode: string,
    numbers: readonly string[],
  ): Promise<Map<string, number>>;
}

export interface ResultRepository {
  findByRoundId(roundId: string): Promise<LotteryResult | null>;
  findManyByRoundIds(roundIds: readonly string[]): Promise<Map<string, LotteryResult>>;
  findLatest(limit: number, lotteryId?: string): Promise<LotteryResult[]>;
  findMany(filter: {
    lotteryId?: string;
    dateKey?: string;
    page?: number;
    pageSize?: number;
  }): Promise<Page<LotteryResult>>;
  create(result: LotteryResult): Promise<LotteryResult>;
}

export interface DepositFilter extends PageQuery {
  userId?: string;
  status?: DepositStatus | 'all';
  from?: string;
  to?: string;
  search?: string;
}

export interface DepositRepository {
  findById(depositId: string): Promise<Deposit | null>;
  findMany(filter: DepositFilter): Promise<Page<Deposit>>;
  create(deposit: Deposit): Promise<Deposit>;
  update(depositId: string, patch: Partial<Deposit>): Promise<Deposit>;
  sumAmount(filter: { status?: DepositStatus; from?: string; to?: string }): Promise<number>;
  countByStatus(status: DepositStatus): Promise<number>;
}

export interface WithdrawalFilter extends PageQuery {
  userId?: string;
  status?: WithdrawalStatus | 'all';
  from?: string;
  to?: string;
  search?: string;
}

export interface WithdrawalRepository {
  findById(withdrawalId: string): Promise<Withdrawal | null>;
  findMany(filter: WithdrawalFilter): Promise<Page<Withdrawal>>;
  create(withdrawal: Withdrawal): Promise<Withdrawal>;
  update(withdrawalId: string, patch: Partial<Withdrawal>): Promise<Withdrawal>;
  sumAmount(filter: { status?: WithdrawalStatus; from?: string; to?: string }): Promise<number>;
  countByStatus(status: WithdrawalStatus): Promise<number>;
}

export interface NotificationRepository {
  listByUser(userId: string, options?: { limit?: number; unreadOnly?: boolean }): Promise<Notification[]>;
  countUnread(userId: string): Promise<number>;
  create(notification: Notification): Promise<Notification>;
  createMany(notifications: readonly Notification[]): Promise<void>;
  markRead(notificationId: string, userId: string): Promise<void>;
  markAllRead(userId: string): Promise<number>;
}

export interface AuditFilter extends PageQuery {
  actorId?: string;
  action?: string;
  resource?: string;
  from?: string;
  to?: string;
  search?: string;
}

export interface AuditRepository {
  record(log: AuditLog): Promise<void>;
  findMany(filter: AuditFilter): Promise<Page<AuditLog>>;
}

export interface IdempotencyRepository {
  /**
   * Atomically claims `key`. Returns `{ claimed: true }` for the first caller and
   * the stored record for every later caller.
   */
  claim(record: IdempotencyRecord): Promise<{ claimed: boolean; existing: IdempotencyRecord | null }>;
  complete(key: string, responseJson: string): Promise<void>;
  release(key: string): Promise<void>;
  get(key: string): Promise<IdempotencyRecord | null>;
  purgeExpired(nowIso: string): Promise<number>;
}

export interface SettlementLockRepository {
  /** Returns false when the round has already been settled. */
  tryLock(roundId: string): Promise<boolean>;
  isSettled(roundId: string): Promise<boolean>;
  unlock(roundId: string): Promise<void>;
}

export interface RepositoryBundle {
  users: UserRepository;
  loginEvents: LoginEventRepository;
  wallets: WalletRepository;
  walletTransactions: WalletTransactionRepository;
  lotteries: LotteryRepository;
  rounds: RoundRepository;
  betTypes: BetTypeRepository;
  payoutRates: PayoutRateRepository;
  bets: BetRepository;
  results: ResultRepository;
  deposits: DepositRepository;
  withdrawals: WithdrawalRepository;
  notifications: NotificationRepository;
  audit: AuditRepository;
  idempotency: IdempotencyRepository;
  settlementLocks: SettlementLockRepository;
}
