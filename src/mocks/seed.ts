import { addDays, addMinutes } from '@/lib/datetime';
import { id, reference, ulid } from '@/lib/ids';
import { applyRate, bahtToSatang, type Satang } from '@/lib/money';
import { hashPasswordWithSalt } from '@/lib/password';
import { isWinningNumber, randomNumber } from '@/lib/lottery-rules';
import { mulberry32 } from '@/lib/utils';
import type {
  AuditLog,
  Bet,
  BetItem,
  BetType,
  Deposit,
  Lottery,
  LotteryResult,
  LotteryRound,
  LoginEvent,
  Notification,
  PayoutRate,
  RoleName,
  User,
  Wallet,
  WalletTransaction,
  WalletTxType,
  Withdrawal,
} from '@/types/domain';
import {
  BET_TYPE_SEEDS,
  betTypeFromSeed,
  defaultRateMilli,
  LOTTERY_SEEDS,
  lotteryFromSeed,
} from './catalog';
import { FAMILY_NAMES, GIVEN_NAMES, LATIN_HANDLES, THAI_BANKS } from './names';
import { createEmptyDatabase, type Database } from '@/repositories/memory/store';
import { DEMO_CREDENTIALS, DEMO_INITIAL_BALANCE_BAHT } from '@/config/demo';

export { DEMO_CREDENTIALS };

export const SEED_VERSION = '2026.09.03-1';


const SEED_SALT = '00112233445566778899aabbccddeeff';

/** Number of days of history the seeder generates. */
const HISTORY_DAYS = 12;
const FUTURE_DAYS = 3;

interface Ctx {
  db: Database;
  rng: () => number;
  now: number;
  nowIso: string;
  betTypes: BetType[];
  betTypeByCode: Map<string, BetType>;
}

function pick<T>(rng: () => number, items: readonly T[]): T {
  const index = Math.floor(rng() * items.length);
  return items[Math.min(index, items.length - 1)] as T;
}

function between(rng: () => number, min: number, max: number): number {
  return Math.floor(rng() * (max - min + 1)) + min;
}

function stamp(iso: string) {
  return { createdAt: iso, updatedAt: iso, deletedAt: null };
}

/* ------------------------------------------------------------------ */
/* Ledger writer — the only way seed data touches a balance            */
/* ------------------------------------------------------------------ */

interface LedgerEntry {
  type: WalletTxType;
  amount: Satang;
  description: string;
  referenceId?: string;
  referenceType?: string;
  at: string;
}

function post(ctx: Ctx, wallet: Wallet, entry: LedgerEntry): WalletTransaction {
  const balanceBefore = wallet.balance;
  const balanceAfter = balanceBefore + entry.amount;
  const tx: WalletTransaction = {
    id: id('wtx'),
    walletId: wallet.id,
    userId: wallet.userId,
    type: entry.type,
    amount: entry.amount,
    balanceBefore,
    balanceAfter,
    status: 'completed',
    referenceId: entry.referenceId ?? null,
    referenceType: entry.referenceType ?? null,
    description: entry.description,
    completedAt: entry.at,
    ...stamp(entry.at),
  };
  wallet.balance = balanceAfter;
  wallet.version += 1;
  wallet.updatedAt = entry.at;
  ctx.db.walletTransactions.set(tx.id, tx);
  return tx;
}

/* ------------------------------------------------------------------ */
/* Catalogue                                                           */
/* ------------------------------------------------------------------ */

function seedCatalogue(ctx: Ctx): void {
  const createdAt = addDays(ctx.nowIso, -180);

  for (const seed of BET_TYPE_SEEDS) {
    const betType: BetType = {
      id: id('btp'),
      ...betTypeFromSeed(seed),
      ...stamp(createdAt),
    };
    ctx.db.betTypes.set(betType.id, betType);
    ctx.betTypes.push(betType);
    ctx.betTypeByCode.set(betType.code, betType);

    const rate: PayoutRate = {
      id: id('rat'),
      betTypeCode: seed.code,
      lotteryId: null,
      rateMilli: defaultRateMilli(seed),
      effectiveFrom: createdAt,
      effectiveTo: null,
      isActive: true,
      ...stamp(createdAt),
    };
    ctx.db.payoutRates.set(rate.id, rate);
  }

  for (const seed of LOTTERY_SEEDS) {
    const lottery: Lottery = {
      id: id('lot'),
      ...lotteryFromSeed(seed),
      ...stamp(createdAt),
    };
    ctx.db.lotteries.set(lottery.id, lottery);
  }
}

/* ------------------------------------------------------------------ */
/* Rounds and results                                                  */
/* ------------------------------------------------------------------ */

/**
 * Rounds are generated relative to "now" so the demo always has genuinely open,
 * closing-soon, and historical rounds no matter when it is started.
 */
function seedRounds(ctx: Ctx): void {
  const lotteries = [...ctx.db.lotteries.values()];
  const dayMs = 86_400_000;
  const todayStart = Math.floor(ctx.now / dayMs) * dayMs;

  for (const lottery of lotteries) {
    const seed = LOTTERY_SEEDS.find((candidate) => candidate.slug === lottery.slug);
    const perDay = seed?.roundsPerDay ?? 1;

    for (let dayOffset = -HISTORY_DAYS; dayOffset <= FUTURE_DAYS; dayOffset++) {
      for (let slot = 0; slot < perDay; slot++) {
        // Spread rounds through the day and stagger lotteries so the "closing
        // soon" rail is never empty.
        const baseHour = 6 + slot * 7 + (lottery.sortOrder / 10) * 1.5;
        const closeMs = todayStart + dayOffset * dayMs + baseHour * 3_600_000;
        const closeAt = new Date(closeMs).toISOString();
        const openAt = addDays(closeAt, -1);
        const resultAt = addMinutes(closeAt, 45);

        const isPast = closeMs < ctx.now;
        const round: LotteryRound = {
          id: id('rnd', closeMs),
          lotteryId: lottery.id,
          roundCode: `${lottery.slug.toUpperCase().slice(0, 6)}-${new Date(closeMs)
            .toISOString()
            .slice(0, 10)
            .replace(/-/g, '')}-${slot + 1}`,
          openAt,
          closeAt,
          resultAt,
          status: isPast ? 'settled' : closeMs - ctx.now < dayMs ? 'open' : 'scheduled',
          settledAt: isPast ? resultAt : null,
          ...stamp(openAt),
        };
        ctx.db.rounds.set(round.id, round);

        if (isPast && ctx.now >= new Date(resultAt).getTime()) {
          const top3 = randomNumber(3, ctx.rng);
          const result: LotteryResult = {
            id: id('res', closeMs),
            lotteryId: lottery.id,
            roundId: round.id,
            top3,
            top2: top3.slice(1),
            bottom2: randomNumber(2, ctx.rng),
            announcedAt: resultAt,
            enteredByUserId: null,
            isFinal: true,
            ...stamp(resultAt),
          };
          ctx.db.results.set(result.id, result);
          ctx.db.resultByRound.set(round.id, result.id);
          ctx.db.settledRounds.add(round.id);
        } else if (isPast) {
          round.status = 'closed';
          round.settledAt = null;
        }
      }
    }
  }
}

/* ------------------------------------------------------------------ */
/* Users                                                               */
/* ------------------------------------------------------------------ */

interface SeededUser {
  user: User;
  wallet: Wallet;
}

function createUser(
  ctx: Ctx,
  options: {
    username: string;
    email: string;
    phone: string;
    displayName: string;
    passwordHash: string;
    roles: RoleName[];
    createdAt: string;
    status?: User['status'];
  },
): SeededUser {
  const user: User = {
    id: id('usr'),
    username: options.username,
    email: options.email,
    phone: options.phone,
    displayName: options.displayName,
    passwordHash: options.passwordHash,
    status: options.status ?? 'active',
    roles: options.roles,
    lastLoginAt: addMinutes(ctx.nowIso, -between(ctx.rng, 5, 4000)),
    bankName: pick(ctx.rng, THAI_BANKS),
    bankAccountName: options.displayName,
    bankAccountNumber: `${between(ctx.rng, 100, 999)}-${between(ctx.rng, 100000, 999999)}-${between(ctx.rng, 1, 9)}`,
    favoriteLotteryIds: [],
    twoFactorEnabled: false,
    marketingOptIn: ctx.rng() > 0.5,
    ...stamp(options.createdAt),
  };

  const wallet: Wallet = {
    id: id('wal'),
    userId: user.id,
    balance: 0,
    held: 0,
    currency: 'THB',
    version: 0,
    ...stamp(options.createdAt),
  };

  ctx.db.users.set(user.id, user);
  ctx.db.wallets.set(wallet.id, wallet);
  ctx.db.walletsByUser.set(user.id, wallet.id);
  return { user, wallet };
}

function seedLoginEvents(ctx: Ctx, user: User, count: number): void {
  for (let i = 0; i < count; i++) {
    const at = addMinutes(ctx.nowIso, -between(ctx.rng, 10, 20_000));
    const event: LoginEvent = {
      id: id('lge'),
      userId: user.id,
      ip: `171.${between(ctx.rng, 1, 254)}.${between(ctx.rng, 1, 254)}.${between(ctx.rng, 1, 254)}`,
      userAgent:
        ctx.rng() > 0.5
          ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15'
          : 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0',
      success: ctx.rng() > 0.08,
      createdAt: at,
    };
    ctx.db.loginEvents.set(event.id, event);
  }
}

/* ------------------------------------------------------------------ */
/* Bets                                                                */
/* ------------------------------------------------------------------ */

function rateForCode(ctx: Ctx, code: string): number {
  for (const rate of ctx.db.payoutRates.values()) {
    if (rate.betTypeCode === code && rate.isActive && rate.lotteryId === null) return rate.rateMilli;
  }
  return 1000;
}

function createBetForRound(
  ctx: Ctx,
  seeded: SeededUser,
  round: LotteryRound,
  lottery: Lottery,
): Bet | null {
  const allowed = ctx.betTypes.filter((betType) => lottery.betTypeCodes.includes(betType.code));
  if (allowed.length === 0) return null;

  const placedAt = new Date(
    Math.min(
      new Date(round.closeAt).getTime() - between(ctx.rng, 5, 600) * 60_000,
      ctx.now - 60_000,
    ),
  ).toISOString();

  const itemCount = between(ctx.rng, 1, 5);
  const betId = id('bet');
  const items: BetItem[] = [];
  let totalStake = 0;
  let totalPotential = 0;

  for (let i = 0; i < itemCount; i++) {
    const betType = pick(ctx.rng, allowed);
    const stake = bahtToSatang(pick(ctx.rng, [10, 20, 50, 100, 200, 500]));
    const rateMilli = rateForCode(ctx, betType.code);
    const potential = applyRate(stake, rateMilli);
    items.push({
      id: id('bit'),
      betId,
      betTypeCode: betType.code,
      number: randomNumber(betType.digitLength, ctx.rng),
      stake,
      rateAtBet: rateMilli,
      potentialPayout: potential,
      status: 'confirmed',
      payout: 0,
      createdAt: placedAt,
    });
    totalStake += stake;
    totalPotential += potential;
  }

  if (seeded.wallet.balance < totalStake) return null;

  const bet: Bet = {
    id: betId,
    reference: reference('BET'),
    userId: seeded.user.id,
    lotteryId: lottery.id,
    roundId: round.id,
    status: 'confirmed',
    totalStake,
    totalPotentialPayout: totalPotential,
    totalPayout: 0,
    items,
    settledAt: null,
    idempotencyKey: null,
    ...stamp(placedAt),
  };

  post(ctx, seeded.wallet, {
    type: 'bet',
    amount: -totalStake,
    description: `แทงหวย ${lottery.nameTh} งวด ${round.roundCode}`,
    referenceId: bet.id,
    referenceType: 'bet',
    at: placedAt,
  });

  ctx.db.bets.set(bet.id, bet);
  return bet;
}

/** Applies the seeded round result to a seeded bet, mirroring SettlementService. */
function settleSeedBet(ctx: Ctx, seeded: SeededUser, bet: Bet): void {
  const resultId = ctx.db.resultByRound.get(bet.roundId);
  const result = resultId ? ctx.db.results.get(resultId) : undefined;
  const round = ctx.db.rounds.get(bet.roundId);
  if (!result || !round) return;

  let payout = 0;
  for (const item of bet.items) {
    const betType = ctx.betTypeByCode.get(item.betTypeCode);
    if (!betType) continue;
    const won = isWinningNumber(betType.matchStrategy, item.number, result);
    item.status = won ? 'won' : 'lost';
    item.payout = won ? item.potentialPayout : 0;
    payout += item.payout;
  }

  bet.status = payout > 0 ? 'won' : 'lost';
  bet.totalPayout = payout;
  bet.settledAt = round.resultAt;
  bet.updatedAt = round.resultAt;

  if (payout > 0) {
    const lottery = ctx.db.lotteries.get(bet.lotteryId);
    post(ctx, seeded.wallet, {
      type: 'win',
      amount: payout,
      description: `รางวัล ${lottery?.nameTh ?? ''} งวด ${round.roundCode}`,
      referenceId: bet.id,
      referenceType: 'bet',
      at: round.resultAt,
    });
    notify(ctx, seeded.user.id, {
      type: 'result',
      title: 'ยินดีด้วย คุณถูกรางวัล',
      body: `บิล ${bet.reference} ได้รับรางวัลรวม`,
      href: `/account/bets`,
      at: round.resultAt,
    });
  }
}

/* ------------------------------------------------------------------ */
/* Cashier + notifications + audit                                     */
/* ------------------------------------------------------------------ */

function notify(
  ctx: Ctx,
  userId: string,
  options: { type: Notification['type']; title: string; body: string; href?: string; at: string },
): void {
  const notification: Notification = {
    id: id('ntf'),
    userId,
    type: options.type,
    title: options.title,
    body: options.body,
    href: options.href ?? null,
    readAt: ctx.rng() > 0.6 ? options.at : null,
    ...stamp(options.at),
  };
  ctx.db.notifications.set(notification.id, notification);
}

function audit(
  ctx: Ctx,
  entry: Omit<AuditLog, 'id' | 'createdAt' | 'ip' | 'userAgent'> & { at: string },
): void {
  const log: AuditLog = {
    id: id('aud'),
    actorId: entry.actorId,
    actorRole: entry.actorRole,
    action: entry.action,
    resource: entry.resource,
    resourceId: entry.resourceId,
    before: entry.before,
    after: entry.after,
    ip: `10.0.${between(ctx.rng, 0, 255)}.${between(ctx.rng, 1, 254)}`,
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/126.0',
    createdAt: entry.at,
  };
  ctx.db.auditLogs.set(log.id, log);
}

function seedDeposit(
  ctx: Ctx,
  seeded: SeededUser,
  amountBaht: number,
  at: string,
  status: Deposit['status'] = 'completed',
): Deposit {
  const amount = bahtToSatang(amountBaht);
  const deposit: Deposit = {
    id: id('dep'),
    reference: reference('DEP'),
    userId: seeded.user.id,
    amount,
    method: ctx.rng() > 0.4 ? 'qr' : 'bank-transfer',
    status,
    walletTransactionId: null,
    reviewedByUserId: null,
    reviewedAt: status === 'completed' ? at : null,
    note: null,
    idempotencyKey: null,
    ...stamp(at),
  };

  if (status === 'completed') {
    const tx = post(ctx, seeded.wallet, {
      type: 'deposit',
      amount,
      description: `ฝากเงินผ่าน ${deposit.method === 'qr' ? 'QR Payment' : 'โอนผ่านธนาคาร'}`,
      referenceId: deposit.id,
      referenceType: 'deposit',
      at,
    });
    deposit.walletTransactionId = tx.id;
  }

  ctx.db.deposits.set(deposit.id, deposit);
  return deposit;
}

function seedWithdrawal(
  ctx: Ctx,
  seeded: SeededUser,
  amountBaht: number,
  at: string,
  status: Withdrawal['status'],
): Withdrawal | null {
  const amount = bahtToSatang(amountBaht);
  if (seeded.wallet.balance < amount) return null;

  const withdrawal: Withdrawal = {
    id: id('wdr'),
    reference: reference('WDR'),
    userId: seeded.user.id,
    amount,
    bankName: seeded.user.bankName ?? THAI_BANKS[0],
    bankAccountNumber: seeded.user.bankAccountNumber ?? '000-000000-0',
    bankAccountName: seeded.user.bankAccountName ?? seeded.user.displayName,
    status: 'pending',
    holdTransactionId: null,
    settlementTransactionId: null,
    reviewedByUserId: null,
    reviewedAt: null,
    note: null,
    idempotencyKey: null,
    ...stamp(at),
  };

  // Hold: move funds out of the spendable balance into `held`.
  const hold = post(ctx, seeded.wallet, {
    type: 'hold',
    amount: -amount,
    description: `กันวงเงินสำหรับคำขอถอน ${withdrawal.reference}`,
    referenceId: withdrawal.id,
    referenceType: 'withdrawal',
    at,
  });
  seeded.wallet.held += amount;
  withdrawal.holdTransactionId = hold.id;

  if (status === 'approved') {
    const settledAt = addMinutes(at, between(ctx.rng, 10, 600));
    seeded.wallet.held -= amount;
    const tx = post(ctx, seeded.wallet, {
      type: 'withdraw',
      amount: 0,
      description: `ถอนเงินสำเร็จ ${withdrawal.reference}`,
      referenceId: withdrawal.id,
      referenceType: 'withdrawal',
      at: settledAt,
    });
    withdrawal.settlementTransactionId = tx.id;
    withdrawal.status = 'approved';
    withdrawal.reviewedAt = settledAt;
    withdrawal.updatedAt = settledAt;
  } else if (status === 'rejected') {
    const settledAt = addMinutes(at, between(ctx.rng, 10, 600));
    seeded.wallet.held -= amount;
    const tx = post(ctx, seeded.wallet, {
      type: 'release',
      amount,
      description: `คืนวงเงินจากคำขอถอนที่ถูกปฏิเสธ ${withdrawal.reference}`,
      referenceId: withdrawal.id,
      referenceType: 'withdrawal',
      at: settledAt,
    });
    withdrawal.settlementTransactionId = tx.id;
    withdrawal.status = 'rejected';
    withdrawal.note = 'ข้อมูลบัญชีไม่ตรงกับชื่อผู้ใช้';
    withdrawal.reviewedAt = settledAt;
    withdrawal.updatedAt = settledAt;
  }

  ctx.db.withdrawals.set(withdrawal.id, withdrawal);
  return withdrawal;
}

/* ------------------------------------------------------------------ */
/* Entry point                                                         */
/* ------------------------------------------------------------------ */

export function buildSeededDatabase(nowMs: number = Date.now()): Database {
  const db = createEmptyDatabase();
  const ctx: Ctx = {
    db,
    rng: mulberry32(20260903),
    now: nowMs,
    nowIso: new Date(nowMs).toISOString(),
    betTypes: [],
    betTypeByCode: new Map(),
  };

  seedCatalogue(ctx);
  seedRounds(ctx);

  // Three scrypt calls total: staff share one hash per distinct password and
  // generated users share a single hash. Keeps cold start fast.
  const demoHash = hashPasswordWithSalt(DEMO_CREDENTIALS.user.password, SEED_SALT);
  const adminHash = hashPasswordWithSalt(DEMO_CREDENTIALS.admin.password, SEED_SALT);
  const genericHash = hashPasswordWithSalt('Player1234!', SEED_SALT);

  const lotteries = [...db.lotteries.values()];
  const pastRounds = [...db.rounds.values()].filter((round) => db.resultByRound.has(round.id));
  const openRounds = [...db.rounds.values()].filter(
    (round) => new Date(round.closeAt).getTime() > nowMs && new Date(round.openAt).getTime() <= nowMs,
  );

  /* ---- staff -------------------------------------------------------- */
  const staffCreatedAt = addDays(ctx.nowIso, -200);
  const admin = createUser(ctx, {
    username: 'admin',
    email: DEMO_CREDENTIALS.admin.email,
    phone: '0800000001',
    displayName: 'ผู้ดูแลระบบ (Demo)',
    passwordHash: adminHash,
    roles: ['admin', 'superadmin'],
    createdAt: staffCreatedAt,
  });
  const finance = createUser(ctx, {
    username: 'finance',
    email: DEMO_CREDENTIALS.finance.email,
    phone: '0800000002',
    displayName: 'ฝ่ายการเงิน (Demo)',
    passwordHash: hashPasswordWithSalt(DEMO_CREDENTIALS.finance.password, SEED_SALT),
    roles: ['finance'],
    createdAt: staffCreatedAt,
  });
  createUser(ctx, {
    username: 'support',
    email: DEMO_CREDENTIALS.support.email,
    phone: '0800000003',
    displayName: 'ฝ่ายบริการ (Demo)',
    passwordHash: hashPasswordWithSalt(DEMO_CREDENTIALS.support.password, SEED_SALT),
    roles: ['support'],
    createdAt: staffCreatedAt,
  });

  /* ---- demo user: exactly 10,000 THB -------------------------------- */
  const demoCreatedAt = addDays(ctx.nowIso, -45);
  const demo = createUser(ctx, {
    username: 'demoplayer',
    email: DEMO_CREDENTIALS.user.email,
    phone: '0812345678',
    displayName: 'ผู้ใช้ทดลอง (Demo)',
    passwordHash: demoHash,
    roles: ['user'],
    createdAt: demoCreatedAt,
  });
  demo.user.favoriteLotteryIds = lotteries.slice(0, 3).map((lottery) => lottery.id);
  const demoDeposit = seedDeposit(ctx, demo, DEMO_INITIAL_BALANCE_BAHT, addMinutes(ctx.nowIso, -120));
  notify(ctx, demo.user.id, {
    type: 'deposit',
    title: 'ฝากเงินสำเร็จ',
    body: `รายการ ${demoDeposit.reference} เข้าบัญชีเรียบร้อยแล้ว`,
    href: '/account/transactions',
    at: demoDeposit.createdAt,
  });
  notify(ctx, demo.user.id, {
    type: 'system',
    title: 'ยินดีต้อนรับสู่โหมดทดลอง',
    body: 'บัญชีนี้เป็นบัญชีสาธิต ไม่มีการใช้เงินจริงในระบบ',
    href: '/dashboard',
    at: demoCreatedAt,
  });
  seedLoginEvents(ctx, demo.user, 6);

  /* ---- 50 generated players ----------------------------------------- */
  const players: SeededUser[] = [];
  for (let i = 0; i < 50; i++) {
    const handle = LATIN_HANDLES[i % LATIN_HANDLES.length] ?? 'player';
    const given = GIVEN_NAMES[i % GIVEN_NAMES.length] ?? 'ผู้เล่น';
    const family = FAMILY_NAMES[i % FAMILY_NAMES.length] ?? 'ทดสอบ';
    const createdAt = addDays(ctx.nowIso, -between(ctx.rng, 1, 300));
    const status: User['status'] = i % 17 === 0 ? 'suspended' : i % 23 === 0 ? 'pending' : 'active';
    const seeded = createUser(ctx, {
      username: `${handle}${String(i + 1).padStart(2, '0')}`,
      email: `${handle}${i + 1}@example.com`,
      phone: `08${String(10_000_000 + i * 137_911).slice(0, 8)}`,
      displayName: `${given} ${family}`,
      passwordHash: genericHash,
      roles: ['user'],
      createdAt,
      status,
    });
    seeded.user.favoriteLotteryIds = lotteries
      .filter(() => ctx.rng() > 0.75)
      .slice(0, 3)
      .map((lottery) => lottery.id);
    players.push(seeded);
    seedLoginEvents(ctx, seeded.user, between(ctx.rng, 1, 4));
  }

  /* ---- deposits ------------------------------------------------------ */
  for (const player of players) {
    const depositCount = between(ctx.rng, 1, 2);
    for (let i = 0; i < depositCount; i++) {
      seedDeposit(
        ctx,
        player,
        pick(ctx.rng, [300, 500, 1000, 2000, 3000, 5000]),
        addMinutes(ctx.nowIso, -between(ctx.rng, 60, HISTORY_DAYS * 1440)),
      );
    }
  }
  // A handful of pending deposits so the admin queue is not empty.
  for (const player of players.slice(0, 6)) {
    seedDeposit(ctx, player, pick(ctx.rng, [500, 1000, 3000]), addMinutes(ctx.nowIso, -between(ctx.rng, 5, 300)), 'pending');
  }

  /* ---- bets ---------------------------------------------------------- */
  const lotteryById = new Map(lotteries.map((lottery) => [lottery.id, lottery]));
  let placed = 0;
  for (const player of players) {
    const betCount = between(ctx.rng, 1, 5);
    for (let i = 0; i < betCount; i++) {
      const useOpen = ctx.rng() > 0.7 && openRounds.length > 0;
      const pool = useOpen ? openRounds : pastRounds;
      if (pool.length === 0) continue;
      const round = pick(ctx.rng, pool);
      const lottery = lotteryById.get(round.lotteryId);
      if (!lottery) continue;
      const bet = createBetForRound(ctx, player, round, lottery);
      if (!bet) continue;
      placed += 1;
      if (!useOpen) settleSeedBet(ctx, player, bet);
    }
  }

  // Guarantee the "100+ bet slips" floor even if balances constrained the loop.
  while (placed < 110 && pastRounds.length > 0) {
    const player = pick(ctx.rng, players);
    const round = pick(ctx.rng, pastRounds);
    const lottery = lotteryById.get(round.lotteryId);
    if (!lottery) break;
    if (player.wallet.balance < bahtToSatang(500)) {
      seedDeposit(ctx, player, 1000, addMinutes(ctx.nowIso, -between(ctx.rng, 120, 5000)));
    }
    const bet = createBetForRound(ctx, player, round, lottery);
    if (!bet) break;
    settleSeedBet(ctx, player, bet);
    placed += 1;
  }

  /* ---- withdrawals --------------------------------------------------- */
  const withdrawalStatuses: Withdrawal['status'][] = [
    'approved',
    'approved',
    'rejected',
    'pending',
    'pending',
  ];
  let withdrawals = 0;
  for (const player of players) {
    if (withdrawals >= 32) break;
    if (player.wallet.balance < bahtToSatang(1000)) continue;
    const status = pick(ctx.rng, withdrawalStatuses);
    const created = seedWithdrawal(
      ctx,
      player,
      pick(ctx.rng, [100, 300, 500, 1000, 2000]),
      addMinutes(ctx.nowIso, -between(ctx.rng, 30, HISTORY_DAYS * 1440)),
      status,
    );
    if (created) {
      withdrawals += 1;
      notify(ctx, player.user.id, {
        type: 'withdrawal',
        title:
          created.status === 'approved'
            ? 'คำขอถอนเงินได้รับการอนุมัติ'
            : created.status === 'rejected'
              ? 'คำขอถอนเงินถูกปฏิเสธ'
              : 'ได้รับคำขอถอนเงินแล้ว',
        body: `รายการ ${created.reference}`,
        href: '/account/withdrawals',
        at: created.updatedAt,
      });
    }
  }

  // Guarantee the documented floor of 30 withdrawal records even when balances
  // happened to be too low during the first pass.
  for (const player of players) {
    if (withdrawals >= 34) break;
    if (player.wallet.balance < bahtToSatang(600)) {
      seedDeposit(ctx, player, 1000, addMinutes(ctx.nowIso, -between(ctx.rng, 200, 6000)));
    }
    const created = seedWithdrawal(
      ctx,
      player,
      pick(ctx.rng, [100, 300, 500]),
      addMinutes(ctx.nowIso, -between(ctx.rng, 30, HISTORY_DAYS * 1440)),
      pick(ctx.rng, withdrawalStatuses),
    );
    if (created) withdrawals += 1;
  }

  /* ---- broadcast notifications --------------------------------------- */
  for (const player of players.slice(0, 20)) {
    notify(ctx, player.user.id, {
      type: 'promotion',
      title: 'โหมดสาธิต: ยินดีต้อนรับ',
      body: 'ทดลองใช้งานระบบได้เต็มรูปแบบ ไม่มีการใช้เงินจริง',
      href: '/lotteries',
      at: addMinutes(ctx.nowIso, -between(ctx.rng, 60, 10_000)),
    });
  }

  /* ---- audit logs ---------------------------------------------------- */
  const staffActors: Array<{ id: string; role: RoleName }> = [
    { id: admin.user.id, role: 'admin' },
    { id: finance.user.id, role: 'finance' },
  ];
  const auditActions = [
    'ADMIN_APPROVE_WITHDRAWAL',
    'ADMIN_APPROVE_DEPOSIT',
    'ADMIN_UPDATE_RATE',
    'ADMIN_ADJUST_WALLET',
    'ADMIN_CREATE_RESULT',
    'ADMIN_UPDATE_USER_STATUS',
    'ADMIN_SETTLE_ROUND',
  ];
  for (let i = 0; i < 70; i++) {
    const actor = pick(ctx.rng, staffActors);
    audit(ctx, {
      actorId: actor.id,
      actorRole: actor.role,
      action: pick(ctx.rng, auditActions),
      resource: 'demo',
      resourceId: id('ref'),
      before: null,
      after: { note: 'seeded demo audit entry' },
      at: addMinutes(ctx.nowIso, -between(ctx.rng, 10, HISTORY_DAYS * 1440)),
    });
  }
  for (const bet of [...db.bets.values()].slice(0, 40)) {
    audit(ctx, {
      actorId: bet.userId,
      actorRole: 'user',
      action: 'USER_CREATE_BET',
      resource: 'bet',
      resourceId: bet.id,
      before: null,
      after: { reference: bet.reference, totalStake: bet.totalStake },
      at: bet.createdAt,
    });
  }

  db.meta = { seededAt: ctx.nowIso, seedVersion: `${SEED_VERSION}-${ulid(nowMs).slice(0, 6)}` };
  return db;
}
