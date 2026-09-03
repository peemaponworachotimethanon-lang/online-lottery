import type { Satang } from '@/lib/money';

/** Every entity carries audit timestamps and optional soft deletion. */
export interface BaseEntity {
  id: string;
  /** UTC ISO-8601. */
  createdAt: string;
  /** UTC ISO-8601. */
  updatedAt: string;
  /** UTC ISO-8601 when soft-deleted, otherwise null. */
  deletedAt: string | null;
}

/* ------------------------------------------------------------------ */
/* Identity                                                            */
/* ------------------------------------------------------------------ */

export const ROLES = ['user', 'support', 'finance', 'admin', 'superadmin'] as const;
export type RoleName = (typeof ROLES)[number];

export const PERMISSIONS = [
  'user.view',
  'user.edit',
  'wallet.view',
  'wallet.adjust',
  'deposit.approve',
  'withdrawal.approve',
  'lottery.manage',
  'result.manage',
  'report.view',
  'settings.manage',
  'audit.view',
  'bet.view',
] as const;
export type PermissionName = (typeof PERMISSIONS)[number];

export type UserStatus = 'active' | 'suspended' | 'pending' | 'closed';

export interface Role extends BaseEntity {
  name: RoleName;
  label: string;
  description: string;
}

export interface Permission extends BaseEntity {
  name: PermissionName;
  description: string;
}

export interface UserRole {
  userId: string;
  roleName: RoleName;
  assignedAt: string;
}

export interface User extends BaseEntity {
  username: string;
  email: string;
  phone: string;
  displayName: string;
  /** scrypt hash; never leaves the server. */
  passwordHash: string;
  status: UserStatus;
  roles: RoleName[];
  lastLoginAt: string | null;
  bankAccountName: string | null;
  bankAccountNumber: string | null;
  bankName: string | null;
  favoriteLotteryIds: string[];
  twoFactorEnabled: boolean;
  marketingOptIn: boolean;
}

/** The safe projection that may cross the network. */
export interface PublicUser {
  id: string;
  username: string;
  email: string;
  phone: string;
  displayName: string;
  status: UserStatus;
  roles: RoleName[];
  createdAt: string;
  lastLoginAt: string | null;
  bankAccountName: string | null;
  bankAccountNumber: string | null;
  bankName: string | null;
  favoriteLotteryIds: string[];
  twoFactorEnabled: boolean;
  marketingOptIn: boolean;
}

export interface LoginEvent {
  id: string;
  userId: string;
  ip: string;
  userAgent: string;
  success: boolean;
  createdAt: string;
}

/* ------------------------------------------------------------------ */
/* Wallet                                                              */
/* ------------------------------------------------------------------ */

export interface Wallet extends BaseEntity {
  userId: string;
  /** Spendable balance in satang. Derived from — and always equal to — the ledger. */
  balance: Satang;
  /** Funds reserved for pending withdrawals; not spendable. */
  held: Satang;
  currency: 'THB';
  /** Optimistic-concurrency guard. Incremented on every mutation. */
  version: number;
}

export const WALLET_TX_TYPES = [
  'deposit',
  'withdraw',
  'bet',
  'win',
  'refund',
  'adjustment',
  'hold',
  'release',
] as const;
export type WalletTxType = (typeof WALLET_TX_TYPES)[number];

export const WALLET_TX_STATUSES = ['pending', 'completed', 'failed', 'cancelled'] as const;
export type WalletTxStatus = (typeof WALLET_TX_STATUSES)[number];

export interface WalletTransaction extends BaseEntity {
  walletId: string;
  userId: string;
  type: WalletTxType;
  /** Signed: positive credits the wallet, negative debits it. */
  amount: Satang;
  balanceBefore: Satang;
  balanceAfter: Satang;
  status: WalletTxStatus;
  /** Foreign key into the originating aggregate (betId, depositId, ...). */
  referenceId: string | null;
  referenceType: string | null;
  description: string;
  completedAt: string | null;
}

/* ------------------------------------------------------------------ */
/* Lottery                                                             */
/* ------------------------------------------------------------------ */

export type LotteryStatus = 'active' | 'inactive';

export interface Lottery extends BaseEntity {
  name: string;
  nameTh: string;
  slug: string;
  country: string;
  countryCode: string;
  timezone: string;
  description: string;
  status: LotteryStatus;
  /** Ordering weight for the public list. */
  sortOrder: number;
  /** Bet type codes this lottery accepts. */
  betTypeCodes: string[];
}

export const ROUND_STATUSES = [
  'scheduled',
  'open',
  'closed',
  'resulted',
  'settled',
  'cancelled',
] as const;
export type RoundStatus = (typeof ROUND_STATUSES)[number];

export interface LotteryRound extends BaseEntity {
  lotteryId: string;
  roundCode: string;
  /** UTC ISO-8601. */
  openAt: string;
  closeAt: string;
  resultAt: string;
  status: RoundStatus;
  settledAt: string | null;
}

/** Derived, server-time-aware status shown in the UI. */
export type DisplayRoundStatus = 'open' | 'closing-soon' | 'closed' | 'resulted' | 'settled' | 'scheduled' | 'cancelled';

/* ------------------------------------------------------------------ */
/* Bet types and rates                                                 */
/* ------------------------------------------------------------------ */

/**
 * How a bet item's number is matched against a round result.
 * Adding a new matching strategy is the only code change required to support a
 * new bet type; everything else (name, digits, limits, rates) is data.
 */
export const MATCH_STRATEGIES = [
  'exact-top-3',
  'permutation-top-3',
  'exact-top-2',
  'exact-bottom-2',
  'running-top',
  'running-bottom',
] as const;
export type MatchStrategy = (typeof MATCH_STRATEGIES)[number];

export interface BetType extends BaseEntity {
  name: string;
  nameTh: string;
  code: string;
  digitLength: number;
  matchStrategy: MatchStrategy;
  minBet: Satang;
  maxBet: Satang;
  /** Maximum total stake a single user may place on one number in one round. */
  maxPerNumber: Satang;
  isActive: boolean;
  sortOrder: number;
  description: string;
}

export interface PayoutRate extends BaseEntity {
  betTypeCode: string;
  /** `null` = default rate for every lottery. */
  lotteryId: string | null;
  /** Payout multiple x1000 so fractional rates stay integral. x850 -> 850000. */
  rateMilli: number;
  effectiveFrom: string;
  effectiveTo: string | null;
  isActive: boolean;
}

/* ------------------------------------------------------------------ */
/* Bets                                                                */
/* ------------------------------------------------------------------ */

export const BET_STATUSES = ['pending', 'confirmed', 'won', 'lost', 'cancelled', 'void'] as const;
export type BetStatus = (typeof BET_STATUSES)[number];

export interface BetItem {
  id: string;
  betId: string;
  betTypeCode: string;
  number: string;
  stake: Satang;
  /** Rate captured at placement time — never re-read from configuration later. */
  rateAtBet: number;
  potentialPayout: Satang;
  status: Exclude<BetStatus, 'pending'> | 'confirmed';
  payout: Satang;
  createdAt: string;
}

export interface Bet extends BaseEntity {
  reference: string;
  userId: string;
  lotteryId: string;
  roundId: string;
  status: BetStatus;
  totalStake: Satang;
  totalPotentialPayout: Satang;
  totalPayout: Satang;
  items: BetItem[];
  settledAt: string | null;
  idempotencyKey: string | null;
}

/* ------------------------------------------------------------------ */
/* Results and settlement                                              */
/* ------------------------------------------------------------------ */

export interface LotteryResult extends BaseEntity {
  lotteryId: string;
  roundId: string;
  /** 3 digits, e.g. "123". */
  top3: string;
  /** 2 digits, e.g. "23". Derived from top3 by convention but stored explicitly. */
  top2: string;
  /** 2 digits, e.g. "45". */
  bottom2: string;
  announcedAt: string;
  enteredByUserId: string | null;
  isFinal: boolean;
}

export interface SettlementSummary {
  roundId: string;
  betsEvaluated: number;
  betsWon: number;
  betsLost: number;
  totalPayout: Satang;
  alreadySettled: boolean;
  durationMs: number;
}

/* ------------------------------------------------------------------ */
/* Cashier                                                             */
/* ------------------------------------------------------------------ */

export const DEPOSIT_METHODS = ['qr', 'bank-transfer'] as const;
export type DepositMethod = (typeof DEPOSIT_METHODS)[number];

export const DEPOSIT_STATUSES = ['pending', 'completed', 'rejected', 'cancelled'] as const;
export type DepositStatus = (typeof DEPOSIT_STATUSES)[number];

export interface Deposit extends BaseEntity {
  reference: string;
  userId: string;
  amount: Satang;
  method: DepositMethod;
  status: DepositStatus;
  walletTransactionId: string | null;
  reviewedByUserId: string | null;
  reviewedAt: string | null;
  note: string | null;
  idempotencyKey: string | null;
}

export const WITHDRAWAL_STATUSES = [
  'pending',
  'approved',
  'rejected',
  'cancelled',
] as const;
export type WithdrawalStatus = (typeof WITHDRAWAL_STATUSES)[number];

export interface Withdrawal extends BaseEntity {
  reference: string;
  userId: string;
  amount: Satang;
  bankName: string;
  bankAccountNumber: string;
  bankAccountName: string;
  status: WithdrawalStatus;
  /** Ledger row for the hold created at request time. */
  holdTransactionId: string | null;
  /** Ledger row for the final debit (approve) or release (reject). */
  settlementTransactionId: string | null;
  reviewedByUserId: string | null;
  reviewedAt: string | null;
  note: string | null;
  idempotencyKey: string | null;
}

/* ------------------------------------------------------------------ */
/* Notifications and audit                                             */
/* ------------------------------------------------------------------ */

export const NOTIFICATION_TYPES = [
  'system',
  'wallet',
  'deposit',
  'withdrawal',
  'bet',
  'result',
  'promotion',
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export interface Notification extends BaseEntity {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  readAt: string | null;
  href: string | null;
}

export interface AuditLog {
  id: string;
  actorId: string | null;
  actorRole: RoleName | 'system';
  action: string;
  resource: string;
  resourceId: string | null;
  before: unknown;
  after: unknown;
  ip: string;
  userAgent: string;
  createdAt: string;
}

export interface IdempotencyRecord {
  key: string;
  scope: string;
  userId: string | null;
  requestHash: string;
  status: 'in-progress' | 'completed';
  responseJson: string | null;
  createdAt: string;
  completedAt: string | null;
  expiresAt: string;
}

/* ------------------------------------------------------------------ */
/* Shared query shapes                                                 */
/* ------------------------------------------------------------------ */

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

export interface PageQuery {
  page?: number;
  pageSize?: number;
}

export type SortDirection = 'asc' | 'desc';
