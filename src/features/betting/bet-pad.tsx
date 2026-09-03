'use client';

import * as React from 'react';
import { toast } from 'sonner';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { NumericInput, Label } from '@/components/ui/input';
import { InlineAlert } from '@/components/ui/feedback';
import { formatMoney, formatRate } from '@/lib/money';
import { cn } from '@/lib/utils';
import { useBetSlip } from '@/stores/bet-slip-store';
import type { BetTypeDto } from '@/types/dto';
import { QuickPickBar, TouchKeypad } from './number-pad';

const QUICK_AMOUNTS = [10, 20, 50, 100, 200, 500] as const;

/**
 * Fast bet entry.
 *
 * Target flow is four interactions: pick type -> type number -> type amount ->
 * Enter. On desktop, Enter from either field adds the row and returns focus to
 * the number field, so a run of numbers can be entered without touching the
 * mouse. On mobile the on-screen pad keeps the field focused and the sticky
 * summary stays visible.
 */
export function BetPad({
  betTypes,
  acceptingBets,
  className,
}: {
  betTypes: BetTypeDto[];
  acceptingBets: boolean;
  className?: string;
}) {
  const add = useBetSlip((state) => state.add);
  const addMany = useBetSlip((state) => state.addMany);

  const [activeCode, setActiveCode] = React.useState(betTypes[0]?.code ?? '');
  const [numberValue, setNumberValue] = React.useState('');
  const [amountValue, setAmountValue] = React.useState('10');
  const numberRef = React.useRef<HTMLInputElement>(null);

  const activeType = betTypes.find((betType) => betType.code === activeCode) ?? betTypes[0];

  React.useEffect(() => {
    // Trim the number when switching to a shorter bet type instead of silently
    // carrying an invalid value.
    if (activeType) setNumberValue((current) => current.slice(0, activeType.digitLength));
  }, [activeType]);

  if (!activeType) {
    return <InlineAlert tone="warning">หวยนี้ยังไม่ได้ตั้งค่าประเภทการแทง</InlineAlert>;
  }

  const stakeBaht = Number.parseInt(amountValue || '0', 10);
  const numberComplete = numberValue.length === activeType.digitLength;
  const stakeValid =
    Number.isFinite(stakeBaht) &&
    stakeBaht > 0 &&
    stakeBaht * 100 >= activeType.minBet &&
    stakeBaht * 100 <= activeType.maxBet;
  const canAdd = acceptingBets && numberComplete && stakeValid;

  const commit = () => {
    if (!canAdd) {
      if (!numberComplete) toast.error(`กรุณากรอกเลข ${activeType.digitLength} หลัก`);
      else if (!stakeValid) toast.error(`จำนวนเงินต้องอยู่ระหว่าง ${formatMoney(activeType.minBet)} – ${formatMoney(activeType.maxBet)}`);
      return;
    }
    const outcome = add({ betType: activeType, number: numberValue, stakeBaht });
    toast.success(
      outcome === 'merged'
        ? `รวมยอด ${numberValue} เป็น ${activeType.nameTh}`
        : `เพิ่ม ${numberValue} (${activeType.nameTh}) แล้ว`,
    );
    setNumberValue('');
    numberRef.current?.focus();
  };

  const commitMany = (values: string[]) => {
    if (!acceptingBets) return;
    if (!stakeValid) {
      toast.error('กรุณากรอกจำนวนเงินให้ถูกต้องก่อน');
      return;
    }
    const added = addMany(
      values.map((value) => ({ betType: activeType, number: value, stakeBaht })),
    );
    toast.success(`เพิ่ม ${added} รายการลงโพยแล้ว`);
    setNumberValue('');
    numberRef.current?.focus();
  };

  return (
    <div className={cn('space-y-4', className)}>
      {/* --------------------------------------------------- bet type picker */}
      <div className="space-y-2">
        <Label>ประเภทการแทง</Label>
        <div
          role="radiogroup"
          aria-label="ประเภทการแทง"
          className="grid grid-cols-2 gap-2 sm:grid-cols-3"
        >
          {betTypes.map((betType) => {
            const active = betType.code === activeCode;
            return (
              <button
                key={betType.code}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setActiveCode(betType.code)}
                className={cn(
                  'flex flex-col items-start gap-0.5 rounded-[var(--radius-control)] border px-3 py-2 text-left transition-colors',
                  active
                    ? 'border-primary bg-primary-soft text-primary-soft-foreground'
                    : 'border-border bg-surface hover:border-border-strong',
                )}
              >
                <span className="text-sm font-medium">{betType.nameTh}</span>
                <span className={cn('tabular text-xs', active ? 'text-primary' : 'text-accent')}>
                  จ่าย x{formatRate(betType.rateMilli)}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* -------------------------------------------------------- number/amount */}
      <div className="grid gap-3 sm:grid-cols-[1.2fr_1fr]">
        <div className="space-y-1.5">
          <Label htmlFor="bet-number">
            เลขที่ต้องการ ({activeType.digitLength} หลัก)
          </Label>
          <NumericInput
            id="bet-number"
            ref={numberRef}
            value={numberValue}
            maxDigits={activeType.digitLength}
            disabled={!acceptingBets}
            placeholder={'0'.repeat(activeType.digitLength)}
            autoComplete="off"
            className="h-12 text-center text-xl tracking-[0.3em]"
            onChange={(event) => setNumberValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                commit();
              }
            }}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="bet-amount">จำนวนเงิน (บาท)</Label>
          <NumericInput
            id="bet-amount"
            value={amountValue}
            maxDigits={7}
            disabled={!acceptingBets}
            className="h-12 text-center text-xl"
            onChange={(event) => setAmountValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                commit();
              }
            }}
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {QUICK_AMOUNTS.map((amount) => (
          <Button
            key={amount}
            variant={String(amount) === amountValue ? 'soft' : 'secondary'}
            size="sm"
            disabled={!acceptingBets}
            onClick={() => setAmountValue(String(amount))}
          >
            {amount}
          </Button>
        ))}
      </div>

      <QuickPickBar
        betType={activeType}
        currentNumber={numberValue}
        onPick={(value) => {
          setNumberValue(value);
          numberRef.current?.focus();
        }}
        onPickMany={commitMany}
      />

      <div className="hidden sm:block">
        <Button block size="lg" disabled={!canAdd} onClick={commit}>
          <Plus /> เพิ่มลงโพย
          <span className="ml-1 text-xs opacity-80">(Enter)</span>
        </Button>
      </div>

      <TouchKeypad
        submitDisabled={!canAdd}
        onDigit={(digit) =>
          setNumberValue((current) => (current + digit).slice(0, activeType.digitLength))
        }
        onBackspace={() => setNumberValue((current) => current.slice(0, -1))}
        onClear={() => setNumberValue('')}
        onSubmit={commit}
      />

      <p className="text-xs text-muted-foreground">
        {activeType.description} · ขั้นต่ำ {formatMoney(activeType.minBet)} · สูงสุด{' '}
        {formatMoney(activeType.maxBet)} ต่อรายการ
      </p>
    </div>
  );
}
