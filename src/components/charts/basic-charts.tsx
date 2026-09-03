'use client';

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { satangToBaht } from '@/lib/money';

/**
 * Chart primitives.
 *
 * Loaded through `next/dynamic` with `ssr: false` by their callers so the ~90 kB
 * charting bundle never lands on the betting pages, which are the latency-
 * critical ones. Colours come from the design tokens rather than hard-coded hex,
 * so charts follow light/dark automatically.
 */

const EMERALD = 'oklch(0.596 0.145 163)';
const GOLD = 'oklch(0.667 0.108 78)';
const SLATE = 'oklch(0.596 0.02 170)';
const DANGER = 'oklch(0.577 0.207 27)';

const AXIS = {
  stroke: 'currentColor',
  tick: { fontSize: 11, fill: 'currentColor' },
  tickLine: false,
  axisLine: false,
} as const;

function bahtTick(value: number) {
  const baht = satangToBaht(value);
  if (Math.abs(baht) >= 1_000_000) return `${(baht / 1_000_000).toFixed(1)}M`;
  if (Math.abs(baht) >= 1_000) return `${Math.round(baht / 1_000)}k`;
  return String(Math.round(baht));
}

const tooltipStyle = {
  backgroundColor: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 10,
  fontSize: 12,
  color: 'var(--foreground)',
} as const;

export interface SeriesPoint {
  date: string;
  [key: string]: string | number;
}

export function StakeAreaChart({ data }: { data: Array<{ date: string; stake: number; payout: number }> }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
        <defs>
          <linearGradient id="stakeFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={EMERALD} stopOpacity={0.35} />
            <stop offset="100%" stopColor={EMERALD} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis dataKey="date" {...AXIS} className="text-muted-foreground" />
        <YAxis {...AXIS} tickFormatter={bahtTick} className="text-muted-foreground" width={44} />
        <Tooltip
          contentStyle={tooltipStyle}
          formatter={(value: number, name) => [
            `฿${satangToBaht(value).toLocaleString('th-TH')}`,
            name === 'stake' ? 'ยอดแทง' : 'รางวัล',
          ]}
        />
        <Area
          type="monotone"
          dataKey="stake"
          name="stake"
          stroke={EMERALD}
          strokeWidth={2}
          fill="url(#stakeFill)"
        />
        <Line type="monotone" dataKey="payout" name="payout" stroke={GOLD} strokeWidth={2} dot={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function WinLossChart({ data }: { data: Array<{ label: string; value: number }> }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis dataKey="label" {...AXIS} className="text-muted-foreground" />
        <YAxis {...AXIS} className="text-muted-foreground" width={36} allowDecimals={false} />
        <Tooltip contentStyle={tooltipStyle} formatter={(value: number) => [`${value} บิล`, 'จำนวน']} />
        <Bar dataKey="value" radius={[6, 6, 0, 0]}>
          {data.map((entry) => (
            <Cell
              key={entry.label}
              fill={entry.label === 'ถูกรางวัล' ? GOLD : entry.label === 'รอผล' ? EMERALD : SLATE}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function AdminDailyChart({
  data,
}: {
  data: Array<{ date: string; betVolume: number; deposits: number; withdrawals: number }>;
}) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis dataKey="date" {...AXIS} className="text-muted-foreground" />
        <YAxis {...AXIS} tickFormatter={bahtTick} className="text-muted-foreground" width={44} />
        <Tooltip
          contentStyle={tooltipStyle}
          formatter={(value: number) => `฿${satangToBaht(value).toLocaleString('th-TH')}`}
        />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Line type="monotone" dataKey="betVolume" name="ยอดแทง" stroke={EMERALD} strokeWidth={2} dot={false} />
        <Line type="monotone" dataKey="deposits" name="ฝาก" stroke={GOLD} strokeWidth={2} dot={false} />
        <Line
          type="monotone"
          dataKey="withdrawals"
          name="ถอน"
          stroke={DANGER}
          strokeWidth={2}
          dot={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function NewUsersChart({ data }: { data: Array<{ date: string; newUsers: number }> }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis dataKey="date" {...AXIS} className="text-muted-foreground" />
        <YAxis {...AXIS} className="text-muted-foreground" width={32} allowDecimals={false} />
        <Tooltip contentStyle={tooltipStyle} formatter={(value: number) => [`${value} คน`, 'สมัครใหม่']} />
        <Bar dataKey="newUsers" fill={EMERALD} radius={[6, 6, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function TopLotteriesChart({ data }: { data: Array<{ name: string; stake: number }> }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} layout="vertical" margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
        <XAxis type="number" {...AXIS} tickFormatter={bahtTick} className="text-muted-foreground" />
        <YAxis type="category" dataKey="name" {...AXIS} width={110} className="text-muted-foreground" />
        <Tooltip
          contentStyle={tooltipStyle}
          formatter={(value: number) => [`฿${satangToBaht(value).toLocaleString('th-TH')}`, 'ยอดแทง']}
        />
        <Bar dataKey="stake" fill={EMERALD} radius={[0, 6, 6, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
