'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Copy, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { EmptyState } from '@/components/ui/feedback';
import { NumericInput } from '@/components/ui/input';
import { Money } from '@/components/ui/money';
import { bahtToSatang, formatMoney, formatRate } from '@/lib/money';
import { cn } from '@/lib/utils';
import { placeBetAction } from '@/server/actions/betting-actions';
import { slipTotals, useBetSlip } from '@/stores/bet-slip-store';

/**
 * Bet slip.
 *
 * Duplicate-submit protection has two halves:
 *   1. the confirm button disables while the request is in flight, and
 *   2. a fresh idempotency key is generated per confirmation attempt, so a
 *      double-fire of the same click can only ever create one bet server-side.
 */
export function BetSlipPanel({
  balance,
  isAuthenticated,
  acceptingBets,
  className,
  onPlaced,
}: {
  balance: number;
  isAuthenticated: boolean;
  acceptingBets: boolean;
  className?: string;
  onPlaced?: () => void;
}) {
  const router = useRouter();
  const items = useBetSlip((state) => state.items);
  const roundId = useBetSlip((state) => state.roundId);
  const updateStake = useBetSlip((state) => state.updateStake);
  const duplicate = useBetSlip((state) => state.duplicate);
  const remove = useBetSlip((state) => state.remove);
  const clear = useBetSlip((state) => state.clear);

  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);

  const totals = slipTotals(items);
  const balanceAfter = balance - totals.totalStakeSatang;
  const insufficient = balanceAfter < 0;

  const submit = async () => {
    if (!roundId || items.length === 0) return;
    setPending(true);
    try {
      const result = await placeBetAction({
        roundId,
        items: items.map((item) => ({
          betTypeCode: item.betTypeCode,
          number: item.number,
          stakeBaht: item.stakeBaht,
        })),
        // One key per confirmation attempt.
        idempotencyKey: `bet-${roundId}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
      });

      if (!result.ok) {
        toast.error(result.message);
        return;
      }

      toast.success(`ส่งโพยสำเร็จ · ${result.data.reference}`, {
        description: `เดิมพันรวม ${formatMoney(result.data.totalStake)} · คงเหลือ ${formatMoney(result.data.balanceAfter)}`,
      });
      clear();
      setConfirmOpen(false);
      onPlaced?.();
      router.refresh();
    } catch {
      toast.error('เกิดข้อผิดพลาดในการส่งโพย กรุณาลองใหม่');
    } finally {
      setPending(false);
    }
  };

  return (
    <div className={cn('flex flex-col', className)}>
      <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold">
          โพยหวย{' '}
          <span className="tabular text-muted-foreground">({totals.count})</span>
        </h2>
        {items.length > 0 ? (
          <Button variant="ghost" size="sm" onClick={clear}>
            <Trash2 /> ล้างทั้งหมด
          </Button>
        ) : null}
      </div>

      {items.length === 0 ? (
        <EmptyState
          title="ยังไม่มีรายการในโพย"
          description="เลือกประเภทการแทง ใส่เลขและจำนวนเงิน แล้วกดเพิ่มลงโพย"
        />
      ) : (
        <ul className="scrollbar-thin max-h-[min(46vh,26rem)] divide-y divide-border overflow-y-auto">
          {items.map((item) => {
            const potential = Math.floor((bahtToSatang(item.stakeBaht) * item.rateMilli) / 1000);
            return (
              <li key={item.key} className="flex items-center gap-3 px-4 py-2.5">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="tabular text-base font-semibold tracking-widest">{item.number}</span>
                    <span className="truncate text-xs text-muted-foreground">{item.betTypeName}</span>
                  </div>
                  <p className="tabular text-xs text-muted-foreground">
                    x{formatRate(item.rateMilli)} · ได้รับ{' '}
                    <span className="font-medium text-accent">{formatMoney(potential)}</span>
                  </p>
                </div>

                <NumericInput
                  aria-label={`จำนวนเงินสำหรับเลข ${item.number}`}
                  value={String(item.stakeBaht)}
                  maxDigits={7}
                  className="h-9 w-20 text-right"
                  onChange={(event) => updateStake(item.key, Number(event.target.value || 0))}
                />

                <div className="flex shrink-0 gap-0.5">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`คัดลอกรายการเลข ${item.number}`}
                    onClick={() => duplicate(item.key)}
                  >
                    <Copy />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`ลบรายการเลข ${item.number}`}
                    onClick={() => remove(item.key)}
                  >
                    <X />
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <dl className="space-y-1.5 border-t border-border px-4 py-3 text-sm">
        <div className="flex justify-between">
          <dt className="text-muted-foreground">จำนวนรายการ</dt>
          <dd className="tabular font-medium">{totals.count}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-muted-foreground">ยอดเดิมพันรวม</dt>
          <dd>
            <Money value={totals.totalStakeSatang} className="font-semibold" />
          </dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-muted-foreground">ยอดเงินคงเหลือ</dt>
          <dd>
            <Money value={balance} tone="muted" />
          </dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-muted-foreground">คงเหลือหลังแทง</dt>
          <dd>
            <Money value={balanceAfter} tone={insufficient ? 'negative' : 'default'} />
          </dd>
        </div>
        <div className="flex justify-between border-t border-border pt-1.5">
          <dt className="text-muted-foreground">รางวัลสูงสุดที่เป็นไปได้</dt>
          <dd>
            <Money value={totals.totalPotentialSatang} tone="prize" />
          </dd>
        </div>
      </dl>

      <div className="border-t border-border p-4">
        {!isAuthenticated ? (
          <Button asChild block size="lg">
            <Link href="/login">เข้าสู่ระบบเพื่อส่งโพย</Link>
          </Button>
        ) : (
          <Button
            block
            size="lg"
            disabled={items.length === 0 || insufficient || !acceptingBets || pending}
            onClick={() => setConfirmOpen(true)}
          >
            {!acceptingBets
              ? 'งวดนี้ปิดรับแล้ว'
              : insufficient
                ? 'ยอดเงินไม่พอ'
                : `ยืนยันการแทง · ${formatMoney(totals.totalStakeSatang)}`}
          </Button>
        )}
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        pending={pending}
        title="ยืนยันการส่งโพย"
        confirmLabel="ยืนยันและหักเงิน"
        description={
          <span className="block space-y-1">
            <span className="block">
              คุณกำลังส่ง <strong className="tabular">{totals.count}</strong> รายการ
              ยอดรวม <strong>{formatMoney(totals.totalStakeSatang)}</strong>
            </span>
            <span className="block text-xs">
              เมื่อยืนยันแล้ว เลขและจำนวนเงินในบิลจะไม่สามารถแก้ไขได้
            </span>
          </span>
        }
        onConfirm={submit}
      >
        <ul className="scrollbar-thin max-h-56 divide-y divide-border overflow-y-auto rounded-[var(--radius-control)] border border-border">
          {items.map((item) => (
            <li key={item.key} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
              <span className="tabular font-semibold tracking-widest">{item.number}</span>
              <span className="truncate text-xs text-muted-foreground">{item.betTypeName}</span>
              <Money value={bahtToSatang(item.stakeBaht)} className="text-sm" />
            </li>
          ))}
        </ul>
      </ConfirmDialog>
    </div>
  );
}
