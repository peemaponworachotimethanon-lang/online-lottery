'use client';

import * as React from 'react';
import { ClipboardList } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { InlineAlert } from '@/components/ui/feedback';
import { Money } from '@/components/ui/money';
import { formatMoney } from '@/lib/money';
import { slipTotals, useBetSlip } from '@/stores/bet-slip-store';
import type { BetTypeDto } from '@/types/dto';
import { BetPad } from './bet-pad';
import { BetSlipPanel } from './bet-slip-panel';

/**
 * Layout switch for the betting experience.
 *
 * Desktop (>= lg): entry pad and slip side by side, so a player can see the slip
 * grow while they type.
 * Mobile: the pad takes the full width and the slip collapses into a sticky
 * bottom bar that opens a full-height sheet — not a shrunken desktop column.
 */
export function BettingBoard({
  betTypes,
  roundId,
  lotterySlug,
  lotteryName,
  closeAt,
  acceptingBets,
  balance,
  isAuthenticated,
}: {
  betTypes: BetTypeDto[];
  roundId: string | null;
  lotterySlug: string;
  lotteryName: string;
  closeAt: string | null;
  acceptingBets: boolean;
  balance: number;
  isAuthenticated: boolean;
}) {
  const setContext = useBetSlip((state) => state.setContext);
  const items = useBetSlip((state) => state.items);
  const [sheetOpen, setSheetOpen] = React.useState(false);

  React.useEffect(() => {
    if (roundId && closeAt) setContext({ roundId, lotterySlug, lotteryName, closeAt });
  }, [roundId, closeAt, lotterySlug, lotteryName, setContext]);

  const totals = slipTotals(items);

  return (
    <>
      <div className="grid gap-5 lg:grid-cols-[1.35fr_1fr]">
        <section className="surface-card p-4 sm:p-5" aria-label="กรอกรายการแทง">
          {!acceptingBets ? (
            <InlineAlert tone="warning" className="mb-4">
              งวดนี้ปิดรับแทงแล้ว — คุณยังดูอัตราจ่ายและผลย้อนหลังได้ตามปกติ
            </InlineAlert>
          ) : null}
          <BetPad betTypes={betTypes} acceptingBets={acceptingBets} />
        </section>

        {/* Desktop slip */}
        <aside className="hidden lg:block">
          <div className="surface-card sticky top-20 overflow-hidden">
            <BetSlipPanel
              balance={balance}
              isAuthenticated={isAuthenticated}
              acceptingBets={acceptingBets}
            />
          </div>
        </aside>
      </div>

      {/* Mobile sticky summary — sits above the bottom navigation. */}
      <div className="safe-bottom fixed inset-x-0 bottom-14 z-30 border-t border-border bg-surface/95 px-4 py-2.5 backdrop-blur lg:hidden">
        <div className="mx-auto flex max-w-lg items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] text-muted-foreground">
              <span className="tabular font-medium text-foreground">{totals.count}</span> รายการ ·
              รางวัลสูงสุด <Money value={totals.totalPotentialSatang} tone="prize" className="text-[11px]" />
            </p>
            <p className="tabular text-sm font-semibold">{formatMoney(totals.totalStakeSatang)}</p>
          </div>
          <Button onClick={() => setSheetOpen(true)} disabled={totals.count === 0}>
            <ClipboardList /> ดูโพย
          </Button>
        </div>
      </div>

      <Dialog open={sheetOpen} onOpenChange={setSheetOpen}>
        <DialogContent className="top-auto bottom-0 max-h-[88vh] w-full max-w-full translate-y-0 rounded-b-none">
          <DialogHeader className="sr-only">
            <DialogTitle>โพยหวย</DialogTitle>
          </DialogHeader>
          <BetSlipPanel
            balance={balance}
            isAuthenticated={isAuthenticated}
            acceptingBets={acceptingBets}
            onPlaced={() => setSheetOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
