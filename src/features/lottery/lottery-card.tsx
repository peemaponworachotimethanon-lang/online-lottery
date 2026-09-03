import Link from 'next/link';
import { ArrowRight, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Countdown } from '@/components/ui/countdown';
import { RoundStatusBadge } from '@/components/ui/status-badge';
import { formatDateTime } from '@/lib/datetime';
import { cn } from '@/lib/utils';
import type { LotteryCardDto } from '@/types/dto';
import { CountryMark } from './country-mark';

/**
 * The public lottery card.
 *
 * Deliberately shows only what a player needs to decide: which lottery, which
 * round, how long is left, and one action. Everything else lives on the detail
 * page.
 */
export function LotteryCard({
  lottery,
  serverNowMs,
  className,
}: {
  lottery: LotteryCardDto;
  serverNowMs: number;
  className?: string;
}) {
  const canBet = lottery.status === 'open' || lottery.status === 'closing-soon';

  return (
    <article
      className={cn(
        'surface-card flex flex-col gap-3 p-4 transition-colors hover:border-border-strong',
        lottery.status === 'closing-soon' && 'border-warning/40',
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <CountryMark code={lottery.countryCode} />
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-semibold">{lottery.nameTh}</h3>
          <p className="truncate text-xs text-muted-foreground">{lottery.name}</p>
        </div>
        <RoundStatusBadge status={lottery.status} />
      </div>

      <div className="rounded-[var(--radius-control)] bg-surface-muted px-3 py-2.5">
        {lottery.closeAt ? (
          <>
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Clock className="size-3.5" aria-hidden /> ปิดรับใน
              </span>
              <Countdown targetIso={lottery.closeAt} serverNowMs={serverNowMs} compact />
            </div>
            <p className="mt-1 truncate text-[11px] text-muted-foreground">
              งวด {lottery.roundCode} · ปิด {formatDateTime(lottery.closeAt)}
            </p>
          </>
        ) : (
          <p className="text-xs text-muted-foreground">ยังไม่มีงวดที่เปิดรับแทง</p>
        )}
      </div>

      <Button asChild variant={canBet ? 'primary' : 'outline'} size="sm" block>
        <Link href={`/lotteries/${lottery.slug}`}>
          {canBet ? 'แทงเลย' : 'ดูรายละเอียด'} <ArrowRight />
        </Link>
      </Button>
    </article>
  );
}
