import { bahtToSatang, rateFromX } from '@/lib/money';
import type { BetType, Lottery, MatchStrategy } from '@/types/domain';

/**
 * Static catalogue seed input.
 *
 * Bet types and rates are DATA, not code. Adding "4-digit top" later means adding
 * a row here (plus one `MatchStrategy` case) — no UI or service change.
 */

export interface BetTypeSeed {
  code: string;
  name: string;
  nameTh: string;
  digitLength: number;
  matchStrategy: MatchStrategy;
  minBetBaht: number;
  maxBetBaht: number;
  maxPerNumberBaht: number;
  defaultRateX: number;
  description: string;
  sortOrder: number;
}

export const BET_TYPE_SEEDS: readonly BetTypeSeed[] = [
  {
    code: 'three-top',
    name: '3-digit top',
    nameTh: '3 ตัวบน',
    digitLength: 3,
    matchStrategy: 'exact-top-3',
    minBetBaht: 1,
    maxBetBaht: 20_000,
    maxPerNumberBaht: 50_000,
    defaultRateX: 850,
    description: 'ตรงกับเลข 3 ตัวบนของงวด',
    sortOrder: 10,
  },
  {
    code: 'three-tote',
    name: '3-digit permutation',
    nameTh: '3 ตัวโต๊ด',
    digitLength: 3,
    matchStrategy: 'permutation-top-3',
    minBetBaht: 1,
    maxBetBaht: 20_000,
    maxPerNumberBaht: 50_000,
    defaultRateX: 150,
    description: 'ตรงกับเลข 3 ตัวบนแบบสลับตำแหน่งได้',
    sortOrder: 20,
  },
  {
    code: 'two-top',
    name: '2-digit top',
    nameTh: '2 ตัวบน',
    digitLength: 2,
    matchStrategy: 'exact-top-2',
    minBetBaht: 1,
    maxBetBaht: 50_000,
    maxPerNumberBaht: 100_000,
    defaultRateX: 90,
    description: 'ตรงกับเลข 2 ตัวท้ายของรางวัลบน',
    sortOrder: 30,
  },
  {
    code: 'two-bottom',
    name: '2-digit bottom',
    nameTh: '2 ตัวล่าง',
    digitLength: 2,
    matchStrategy: 'exact-bottom-2',
    minBetBaht: 1,
    maxBetBaht: 50_000,
    maxPerNumberBaht: 100_000,
    defaultRateX: 90,
    description: 'ตรงกับเลข 2 ตัวล่างของงวด',
    sortOrder: 40,
  },
  {
    code: 'run-top',
    name: 'Running top',
    nameTh: 'วิ่งบน',
    digitLength: 1,
    matchStrategy: 'running-top',
    minBetBaht: 1,
    maxBetBaht: 50_000,
    maxPerNumberBaht: 200_000,
    defaultRateX: 3.2,
    description: 'เลขที่แทงปรากฏใน 3 ตัวบน',
    sortOrder: 50,
  },
  {
    code: 'run-bottom',
    name: 'Running bottom',
    nameTh: 'วิ่งล่าง',
    digitLength: 1,
    matchStrategy: 'running-bottom',
    minBetBaht: 1,
    maxBetBaht: 50_000,
    maxPerNumberBaht: 200_000,
    defaultRateX: 4.2,
    description: 'เลขที่แทงปรากฏใน 2 ตัวล่าง',
    sortOrder: 60,
  },
];

export type BetTypeSeedFields = Omit<
  BetType,
  'id' | 'createdAt' | 'updatedAt' | 'deletedAt'
>;

export function betTypeFromSeed(seed: BetTypeSeed): BetTypeSeedFields {
  return {
    code: seed.code,
    name: seed.name,
    nameTh: seed.nameTh,
    digitLength: seed.digitLength,
    matchStrategy: seed.matchStrategy,
    minBet: bahtToSatang(seed.minBetBaht),
    maxBet: bahtToSatang(seed.maxBetBaht),
    maxPerNumber: bahtToSatang(seed.maxPerNumberBaht),
    isActive: true,
    sortOrder: seed.sortOrder,
    description: seed.description,
  };
}

export function defaultRateMilli(seed: BetTypeSeed): number {
  return rateFromX(seed.defaultRateX);
}

const ALL_TYPES = BET_TYPE_SEEDS.map((seed) => seed.code);
const NUMERIC_INDEX_TYPES = ['three-top', 'three-tote', 'two-top', 'two-bottom'];

export interface LotterySeed {
  slug: string;
  name: string;
  nameTh: string;
  country: string;
  countryCode: string;
  timezone: string;
  description: string;
  betTypeCodes: string[];
  sortOrder: number;
  /** Rounds per day used by the round generator. */
  roundsPerDay: number;
  /** Close times in the lottery's own local zone, `HH:mm`. */
  closeTimesLocal: string[];
}

export const LOTTERY_SEEDS: readonly LotterySeed[] = [
  {
    slug: 'thai-government',
    name: 'Thai Government Lottery',
    nameTh: 'หวยรัฐบาลไทย',
    country: 'Thailand',
    countryCode: 'TH',
    timezone: 'Asia/Bangkok',
    description: 'สลากกินแบ่งรัฐบาล ออกผลวันที่ 1 และ 16 ของทุกเดือน',
    betTypeCodes: [...ALL_TYPES],
    sortOrder: 10,
    roundsPerDay: 1,
    closeTimesLocal: ['15:00'],
  },
  {
    slug: 'lao',
    name: 'Lao Lottery',
    nameTh: 'หวยลาว',
    country: 'Laos',
    countryCode: 'LA',
    timezone: 'Asia/Vientiane',
    description: 'หวยพัฒนารัฐลาว ออกผลสัปดาห์ละหลายงวด',
    betTypeCodes: [...ALL_TYPES],
    sortOrder: 20,
    roundsPerDay: 1,
    closeTimesLocal: ['20:00'],
  },
  {
    slug: 'hanoi',
    name: 'Hanoi Lottery',
    nameTh: 'หวยฮานอย',
    country: 'Vietnam',
    countryCode: 'VN',
    timezone: 'Asia/Ho_Chi_Minh',
    description: 'หวยฮานอยปกติ ออกผลทุกวัน',
    betTypeCodes: [...ALL_TYPES],
    sortOrder: 30,
    roundsPerDay: 1,
    closeTimesLocal: ['18:00'],
  },
  {
    slug: 'hanoi-vip',
    name: 'Hanoi VIP',
    nameTh: 'หวยฮานอย VIP',
    country: 'Vietnam',
    countryCode: 'VN',
    timezone: 'Asia/Ho_Chi_Minh',
    description: 'หวยฮานอยรอบพิเศษ VIP',
    betTypeCodes: [...ALL_TYPES],
    sortOrder: 40,
    roundsPerDay: 1,
    closeTimesLocal: ['19:30'],
  },
  {
    slug: 'hanoi-special',
    name: 'Hanoi Special',
    nameTh: 'หวยฮานอยพิเศษ',
    country: 'Vietnam',
    countryCode: 'VN',
    timezone: 'Asia/Ho_Chi_Minh',
    description: 'หวยฮานอยรอบพิเศษ',
    betTypeCodes: [...ALL_TYPES],
    sortOrder: 50,
    roundsPerDay: 1,
    closeTimesLocal: ['17:00'],
  },
  {
    slug: 'nikkei',
    name: 'Nikkei',
    nameTh: 'หวยหุ้นนิเคอิ',
    country: 'Japan',
    countryCode: 'JP',
    timezone: 'Asia/Tokyo',
    description: 'หวยหุ้นนิเคอิ รอบเช้าและรอบบ่าย',
    betTypeCodes: [...NUMERIC_INDEX_TYPES],
    sortOrder: 60,
    roundsPerDay: 2,
    closeTimesLocal: ['10:15', '13:15'],
  },
  {
    slug: 'china-stock',
    name: 'China Stock Lottery',
    nameTh: 'หวยหุ้นจีน',
    country: 'China',
    countryCode: 'CN',
    timezone: 'Asia/Shanghai',
    description: 'หวยหุ้นจีน รอบเช้าและรอบบ่าย',
    betTypeCodes: [...NUMERIC_INDEX_TYPES],
    sortOrder: 70,
    roundsPerDay: 2,
    closeTimesLocal: ['10:20', '14:20'],
  },
  {
    slug: 'hang-seng',
    name: 'Hang Seng',
    nameTh: 'หวยหุ้นฮั่งเส็ง',
    country: 'Hong Kong',
    countryCode: 'HK',
    timezone: 'Asia/Hong_Kong',
    description: 'หวยหุ้นฮั่งเส็ง รอบเช้าและรอบบ่าย',
    betTypeCodes: [...NUMERIC_INDEX_TYPES],
    sortOrder: 80,
    roundsPerDay: 2,
    closeTimesLocal: ['10:00', '14:00'],
  },
  {
    slug: 'dow-jones',
    name: 'Dow Jones',
    nameTh: 'หวยหุ้นดาวโจนส์',
    country: 'United States',
    countryCode: 'US',
    timezone: 'America/New_York',
    description: 'หวยหุ้นดาวโจนส์ ออกผลตามตลาดสหรัฐฯ',
    betTypeCodes: [...NUMERIC_INDEX_TYPES],
    sortOrder: 90,
    roundsPerDay: 1,
    closeTimesLocal: ['03:30'],
  },
];

export type LotterySeedFields = Omit<Lottery, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>;

export function lotteryFromSeed(seed: LotterySeed): LotterySeedFields {
  return {
    name: seed.name,
    nameTh: seed.nameTh,
    slug: seed.slug,
    country: seed.country,
    countryCode: seed.countryCode,
    timezone: seed.timezone,
    description: seed.description,
    status: 'active',
    sortOrder: seed.sortOrder,
    betTypeCodes: seed.betTypeCodes,
  };
}
