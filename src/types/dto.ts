import type { Satang } from '@/lib/money';
import type {
  BetStatus,
  DepositStatus,
  DisplayRoundStatus,
  MatchStrategy,
  NotificationType,
  RoleName,
  UserStatus,
  WalletTxStatus,
  WalletTxType,
  WithdrawalStatus,
} from './domain';

/**
 * Data-transfer objects.
 *
 * Pages and components consume DTOs, never entities. This keeps payloads small
 * (no password hashes, no unused columns) and gives us an explicit contract that
 * a SQL `SELECT` projection can satisfy directly.
 */

export interface LotteryCardDto {
  id: string;
  slug: string;
  name: string;
  nameTh: string;
  country: string;
  countryCode: string;
  status: DisplayRoundStatus;
  roundId: string | null;
  roundCode: string | null;
  /** UTC ISO — the client renders the countdown from this. */
  closeAt: string | null;
  resultAt: string | null;
  betTypeCount: number;
}

export interface BetTypeDto {
  code: string;
  name: string;
  nameTh: string;
  digitLength: number;
  matchStrategy: MatchStrategy;
  minBet: Satang;
  maxBet: Satang;
  maxPerNumber: Satang;
  rateMilli: number;
  description: string;
}

export interface RoundDto {
  id: string;
  roundCode: string;
  openAt: string;
  closeAt: string;
  resultAt: string;
  status: DisplayRoundStatus;
}

export interface LotteryDetailDto {
  id: string;
  slug: string;
  name: string;
  nameTh: string;
  country: string;
  countryCode: string;
  timezone: string;
  description: string;
  currentRound: RoundDto | null;
  betTypes: BetTypeDto[];
  recentResults: ResultDto[];
}

export interface ResultDto {
  id: string;
  lotteryId: string;
  lotteryName: string;
  lotteryNameTh: string;
  roundId: string;
  roundCode: string;
  top3: string;
  top2: string;
  bottom2: string;
  announcedAt: string;
}

export interface BetItemDto {
  id: string;
  betTypeCode: string;
  betTypeName: string;
  number: string;
  stake: Satang;
  rateMilli: number;
  potentialPayout: Satang;
  payout: Satang;
  status: string;
}

export interface BetDto {
  id: string;
  reference: string;
  userId: string;
  username: string;
  lotteryName: string;
  roundCode: string;
  status: BetStatus;
  totalStake: Satang;
  totalPotentialPayout: Satang;
  totalPayout: Satang;
  itemCount: number;
  items: BetItemDto[];
  createdAt: string;
  settledAt: string | null;
}

export interface TransactionDto {
  id: string;
  userId: string;
  username: string;
  type: WalletTxType;
  amount: Satang;
  balanceBefore: Satang;
  balanceAfter: Satang;
  status: WalletTxStatus;
  referenceId: string | null;
  description: string;
  createdAt: string;
}

export interface DepositDto {
  id: string;
  reference: string;
  userId: string;
  username: string;
  amount: Satang;
  method: string;
  status: DepositStatus;
  createdAt: string;
  reviewedAt: string | null;
  note: string | null;
}

export interface WithdrawalDto {
  id: string;
  reference: string;
  userId: string;
  username: string;
  amount: Satang;
  bankName: string;
  bankAccountNumber: string;
  bankAccountName: string;
  status: WithdrawalStatus;
  createdAt: string;
  reviewedAt: string | null;
  note: string | null;
}

export interface AdminUserDto {
  id: string;
  username: string;
  email: string;
  phone: string;
  displayName: string;
  balance: Satang;
  held: Satang;
  roles: RoleName[];
  status: UserStatus;
  createdAt: string;
  lastLoginAt: string | null;
}

export interface NotificationDto {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  href: string | null;
  readAt: string | null;
  createdAt: string;
}

export interface DashboardSummaryDto {
  balance: Satang;
  held: Satang;
  todayStake: Satang;
  pendingBets: number;
  totalWinnings: Satang;
  netProfit: Satang;
  recentBets: BetDto[];
  recentTransactions: TransactionDto[];
  favoriteLotteries: LotteryCardDto[];
  upcomingClosings: LotteryCardDto[];
  weeklyStake: Array<{ date: string; stake: number; payout: number }>;
}

export interface AdminKpiDto {
  totalUsers: number;
  activeUsers: number;
  newUsersToday: number;
  totalWalletBalance: Satang;
  depositToday: Satang;
  withdrawalToday: Satang;
  betVolumeToday: Satang;
  totalPayout: Satang;
  pendingDeposits: number;
  pendingWithdrawals: number;
  openLotteries: number;
}

export interface AdminChartsDto {
  daily: Array<{
    date: string;
    betVolume: number;
    deposits: number;
    withdrawals: number;
    newUsers: number;
  }>;
  topLotteries: Array<{ name: string; stake: number; bets: number }>;
}
