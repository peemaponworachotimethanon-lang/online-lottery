import { Badge, type BadgeProps } from './badge';
import type {
  BetStatus,
  DepositStatus,
  DisplayRoundStatus,
  RoundStatus,
  UserStatus,
  WalletTxStatus,
  WalletTxType,
  WithdrawalStatus,
} from '@/types/domain';

type Tone = NonNullable<BadgeProps['variant']>;

const ROUND: Record<DisplayRoundStatus, { label: string; tone: Tone }> = {
  open: { label: 'เปิดรับแทง', tone: 'emerald' },
  'closing-soon': { label: 'ใกล้ปิด', tone: 'warning' },
  closed: { label: 'ปิดรับแล้ว', tone: 'neutral' },
  resulted: { label: 'ออกผลแล้ว', tone: 'outline' },
  settled: { label: 'จ่ายรางวัลแล้ว', tone: 'gold' },
  scheduled: { label: 'รอเปิด', tone: 'neutral' },
  cancelled: { label: 'ยกเลิก', tone: 'danger' },
};

const ROUND_RAW: Record<RoundStatus, { label: string; tone: Tone }> = {
  scheduled: { label: 'รอเปิด', tone: 'neutral' },
  open: { label: 'เปิดรับแทง', tone: 'emerald' },
  closed: { label: 'ปิดรับแล้ว', tone: 'neutral' },
  resulted: { label: 'ออกผลแล้ว', tone: 'outline' },
  settled: { label: 'จ่ายรางวัลแล้ว', tone: 'gold' },
  cancelled: { label: 'ยกเลิก', tone: 'danger' },
};

const BET: Record<BetStatus, { label: string; tone: Tone }> = {
  pending: { label: 'รอยืนยัน', tone: 'warning' },
  confirmed: { label: 'รอผล', tone: 'emerald' },
  won: { label: 'ถูกรางวัล', tone: 'gold' },
  lost: { label: 'ไม่ถูกรางวัล', tone: 'neutral' },
  cancelled: { label: 'ยกเลิก', tone: 'danger' },
  void: { label: 'เป็นโมฆะ', tone: 'danger' },
};

const DEPOSIT: Record<DepositStatus, { label: string; tone: Tone }> = {
  pending: { label: 'รอตรวจสอบ', tone: 'warning' },
  completed: { label: 'สำเร็จ', tone: 'emerald' },
  rejected: { label: 'ปฏิเสธ', tone: 'danger' },
  cancelled: { label: 'ยกเลิก', tone: 'neutral' },
};

const WITHDRAWAL: Record<WithdrawalStatus, { label: string; tone: Tone }> = {
  pending: { label: 'รอตรวจสอบ', tone: 'warning' },
  approved: { label: 'อนุมัติแล้ว', tone: 'emerald' },
  rejected: { label: 'ปฏิเสธ', tone: 'danger' },
  cancelled: { label: 'ยกเลิก', tone: 'neutral' },
};

const USER: Record<UserStatus, { label: string; tone: Tone }> = {
  active: { label: 'ใช้งานปกติ', tone: 'emerald' },
  suspended: { label: 'ถูกระงับ', tone: 'danger' },
  pending: { label: 'รอยืนยัน', tone: 'warning' },
  closed: { label: 'ปิดบัญชี', tone: 'neutral' },
};

const TX_TYPE: Record<WalletTxType, { label: string; tone: Tone }> = {
  deposit: { label: 'ฝากเงิน', tone: 'emerald' },
  withdraw: { label: 'ถอนเงิน', tone: 'outline' },
  bet: { label: 'แทงหวย', tone: 'neutral' },
  win: { label: 'รางวัล', tone: 'gold' },
  refund: { label: 'คืนเงิน', tone: 'outline' },
  adjustment: { label: 'ปรับปรุงยอด', tone: 'warning' },
  hold: { label: 'กันวงเงิน', tone: 'neutral' },
  release: { label: 'คืนวงเงิน', tone: 'outline' },
};

const TX_STATUS: Record<WalletTxStatus, { label: string; tone: Tone }> = {
  pending: { label: 'รอดำเนินการ', tone: 'warning' },
  completed: { label: 'สำเร็จ', tone: 'emerald' },
  failed: { label: 'ล้มเหลว', tone: 'danger' },
  cancelled: { label: 'ยกเลิก', tone: 'neutral' },
};

export function RoundStatusBadge({ status }: { status: DisplayRoundStatus }) {
  const entry = ROUND[status];
  return <Badge variant={entry.tone}>{entry.label}</Badge>;
}

export function RawRoundStatusBadge({ status }: { status: RoundStatus }) {
  const entry = ROUND_RAW[status];
  return <Badge variant={entry.tone}>{entry.label}</Badge>;
}

export function BetStatusBadge({ status }: { status: BetStatus }) {
  const entry = BET[status];
  return <Badge variant={entry.tone}>{entry.label}</Badge>;
}

export function DepositStatusBadge({ status }: { status: DepositStatus }) {
  const entry = DEPOSIT[status];
  return <Badge variant={entry.tone}>{entry.label}</Badge>;
}

export function WithdrawalStatusBadge({ status }: { status: WithdrawalStatus }) {
  const entry = WITHDRAWAL[status];
  return <Badge variant={entry.tone}>{entry.label}</Badge>;
}

export function UserStatusBadge({ status }: { status: UserStatus }) {
  const entry = USER[status];
  return <Badge variant={entry.tone}>{entry.label}</Badge>;
}

export function TxTypeBadge({ type }: { type: WalletTxType }) {
  const entry = TX_TYPE[type];
  return <Badge variant={entry.tone}>{entry.label}</Badge>;
}

export function TxStatusBadge({ status }: { status: WalletTxStatus }) {
  const entry = TX_STATUS[status];
  return <Badge variant={entry.tone}>{entry.label}</Badge>;
}

export const statusLabels = { ROUND, BET, DEPOSIT, WITHDRAWAL, USER, TX_TYPE, TX_STATUS };
