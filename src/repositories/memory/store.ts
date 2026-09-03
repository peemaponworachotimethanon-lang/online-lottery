import type {
  AuditLog,
  Bet,
  BetType,
  Deposit,
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
  Withdrawal,
} from '@/types/domain';

/**
 * The in-memory demo database.
 *
 * Shape mirrors the PostgreSQL schema one table per Map so the repository
 * implementations read almost identically to their future Prisma counterparts.
 *
 * PRODUCTION NOTE: this provider exists only for `NEXT_PUBLIC_APP_MODE=mock`.
 * Data lives in the process, so it resets whenever the serverless instance is
 * recycled and is NOT shared between instances. See README § Known limitations.
 */
export interface Database {
  users: Map<string, User>;
  wallets: Map<string, Wallet>;
  walletsByUser: Map<string, string>;
  walletTransactions: Map<string, WalletTransaction>;
  lotteries: Map<string, Lottery>;
  rounds: Map<string, LotteryRound>;
  betTypes: Map<string, BetType>;
  payoutRates: Map<string, PayoutRate>;
  bets: Map<string, Bet>;
  results: Map<string, LotteryResult>;
  resultByRound: Map<string, string>;
  deposits: Map<string, Deposit>;
  withdrawals: Map<string, Withdrawal>;
  notifications: Map<string, Notification>;
  auditLogs: Map<string, AuditLog>;
  idempotency: Map<string, IdempotencyRecord>;
  loginEvents: Map<string, LoginEvent>;
  /** Round ids whose settlement has completed — the idempotency guard. */
  settledRounds: Set<string>;
  meta: { seededAt: string; seedVersion: string };
}

export function createEmptyDatabase(): Database {
  return {
    users: new Map(),
    wallets: new Map(),
    walletsByUser: new Map(),
    walletTransactions: new Map(),
    lotteries: new Map(),
    rounds: new Map(),
    betTypes: new Map(),
    payoutRates: new Map(),
    bets: new Map(),
    results: new Map(),
    resultByRound: new Map(),
    deposits: new Map(),
    withdrawals: new Map(),
    notifications: new Map(),
    auditLogs: new Map(),
    idempotency: new Map(),
    loginEvents: new Map(),
    settledRounds: new Set(),
    meta: { seededAt: new Date(0).toISOString(), seedVersion: '0' },
  };
}
