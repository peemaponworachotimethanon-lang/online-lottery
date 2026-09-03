'use client';

import Link from 'next/link';
import { Ticket } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Countdown } from '@/components/ui/countdown';
import { EmptyState } from '@/components/ui/feedback';
import { useBetSlip } from '@/stores/bet-slip-store';
import { BetSlipPanel } from './bet-slip-panel';

/**
 * The bet slip as its own page (the middle item in the mobile bottom nav).
 *
 * The slip lives in client state scoped to one round, so this page either shows
 * that round's slip or points the player at an open lottery — it never invents a
 * round of its own.
 */
export function StandaloneBetSlip({
  balance,
  openLotteries,
}: {
  balance: number;
  openLotteries: Array<{ slug: string; name: string }>;
}) {
  const roundId = useBetSlip((state) => state.roundId);
  const lotteryName = useBetSlip((state) => state.lotteryName);
  const lotterySlug = useBetSlip((state) => state.lotterySlug);
  const closeAt = useBetSlip((state) => state.closeAt);
  const items = useBetSlip((state) => state.items);

  const expired = closeAt ? new Date(closeAt).getTime() <= Date.now() : false;

  if (!roundId || items.length === 0) {
    return (
      <div className="surface-card">
        <EmptyState
          icon={<Ticket className="size-5" />}
          title="โพยของคุณยังว่างอยู่"
          description="เลือกหวยที่เปิดรับแทง แล้วเพิ่มเลขลงโพยเพื่อดูสรุปที่นี่"
          action={
            <div className="flex flex-wrap justify-center gap-2">
              {openLotteries.slice(0, 3).map((lottery) => (
                <Button key={lottery.slug} asChild size="sm" variant="outline">
                  <Link href={`/lotteries/${lottery.slug}`}>{lottery.name}</Link>
                </Button>
              ))}
              <Button asChild size="sm">
                <Link href="/lotteries">ดูหวยทั้งหมด</Link>
              </Button>
            </div>
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="surface-card flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="min-w-0">
          <p className="text-sm font-medium">{lotteryName}</p>
          {closeAt ? (
            <p className="text-xs text-muted-foreground">
              ปิดรับใน <Countdown targetIso={closeAt} compact />
            </p>
          ) : null}
        </div>
        {lotterySlug ? (
          <Button asChild variant="outline" size="sm">
            <Link href={`/lotteries/${lotterySlug}`}>เพิ่มเลขอีก</Link>
          </Button>
        ) : null}
      </div>

      <div className="surface-card overflow-hidden">
        <BetSlipPanel balance={balance} isAuthenticated acceptingBets={!expired} />
      </div>
    </div>
  );
}
