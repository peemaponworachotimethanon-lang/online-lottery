'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Building2, QrCode, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { InlineAlert } from '@/components/ui/feedback';
import { Field, NumericInput } from '@/components/ui/input';
import { Money } from '@/components/ui/money';
import { bahtToSatang, formatMoney } from '@/lib/money';
import { cn } from '@/lib/utils';
import { DEPOSIT_PRESETS_BAHT, MAX_DEPOSIT_SATANG, MIN_DEPOSIT_SATANG } from '@/schemas/betting';
import { simulateDepositAction } from '@/server/actions/wallet-actions';
import { MockQrPlaceholder } from './qr-placeholder';

const METHODS = [
  { value: 'qr', label: 'QR Payment', description: 'สแกนจ่ายผ่านแอปธนาคาร', icon: QrCode },
  { value: 'bank-transfer', label: 'โอนผ่านธนาคาร', description: 'โอนเข้าบัญชีที่ระบุ', icon: Building2 },
] as const;

export function DepositForm({ balance, reference }: { balance: number; reference: string }) {
  const router = useRouter();
  const [method, setMethod] = React.useState<'qr' | 'bank-transfer'>('qr');
  const [amountValue, setAmountValue] = React.useState('500');
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);

  const amountBaht = Number.parseInt(amountValue || '0', 10);
  const amountSatang = bahtToSatang(Number.isFinite(amountBaht) ? amountBaht : 0);
  const valid = amountSatang >= MIN_DEPOSIT_SATANG && amountSatang <= MAX_DEPOSIT_SATANG;

  const submit = async () => {
    setPending(true);
    try {
      const result = await simulateDepositAction({
        amountBaht,
        method,
        // Fresh key per confirmation so a double-fire cannot double-credit.
        idempotencyKey: `dep-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
      });

      if (!result.ok) {
        toast.error(result.message);
        return;
      }

      toast.success('ฝากเงินสำเร็จ', {
        description: `${formatMoney(result.data.amount)} เข้าบัญชีแล้ว · คงเหลือ ${formatMoney(result.data.balance)}`,
      });
      setConfirmOpen(false);
      router.refresh();
    } catch {
      toast.error('เกิดข้อผิดพลาด กรุณาลองใหม่');
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
      <div className="surface-card space-y-5 p-5">
        <div className="space-y-2">
          <h2 className="text-sm font-semibold">เลือกช่องทาง</h2>
          <div role="radiogroup" aria-label="ช่องทางการฝากเงิน" className="grid gap-2 sm:grid-cols-2">
            {METHODS.map((option) => {
              const Icon = option.icon;
              const active = option.value === method;
              return (
                <button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setMethod(option.value)}
                  className={cn(
                    'flex items-center gap-3 rounded-[var(--radius-control)] border px-3 py-3 text-left transition-colors',
                    active
                      ? 'border-primary bg-primary-soft text-primary-soft-foreground'
                      : 'border-border bg-surface hover:border-border-strong',
                  )}
                >
                  <Icon className="size-5 shrink-0" aria-hidden />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium">{option.label}</span>
                    <span className="block truncate text-xs opacity-80">{option.description}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-2">
          <h2 className="text-sm font-semibold">จำนวนเงิน</h2>
          <div className="grid grid-cols-3 gap-2">
            {DEPOSIT_PRESETS_BAHT.map((preset) => (
              <Button
                key={preset}
                variant={String(preset) === amountValue ? 'soft' : 'secondary'}
                onClick={() => setAmountValue(String(preset))}
              >
                {preset.toLocaleString('th-TH')}
              </Button>
            ))}
          </div>

          <Field
            label="หรือระบุจำนวนเอง (บาท)"
            htmlFor="deposit-amount"
            error={!valid && amountValue ? `ฝากได้ระหว่าง ${formatMoney(MIN_DEPOSIT_SATANG)} – ${formatMoney(MAX_DEPOSIT_SATANG)}` : undefined}
          >
            <NumericInput
              id="deposit-amount"
              value={amountValue}
              maxDigits={7}
              className="h-12 text-center text-xl"
              onChange={(event) => setAmountValue(event.target.value)}
            />
          </Field>
        </div>

        {method === 'qr' ? (
          <MockQrPlaceholder amountSatang={amountSatang} reference={reference} />
        ) : (
          <div className="rounded-[var(--radius-control)] border border-border bg-surface-muted p-4">
            <h3 className="mb-2 text-sm font-medium">บัญชีสำหรับโอน (ตัวอย่าง)</h3>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
              <dt className="text-muted-foreground">ธนาคาร</dt>
              <dd className="font-medium">ธนาคารตัวอย่าง จำกัด (มหาชน)</dd>
              <dt className="text-muted-foreground">เลขบัญชี</dt>
              <dd className="tabular font-medium">000-0-00000-0</dd>
              <dt className="text-muted-foreground">ชื่อบัญชี</dt>
              <dd className="font-medium">บริษัท เดโม จำกัด</dd>
              <dt className="text-muted-foreground">อ้างอิง</dt>
              <dd className="tabular font-medium">{reference}</dd>
            </dl>
          </div>
        )}

        <InlineAlert tone="info">
          <span className="flex items-start gap-2">
            <ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden />
            โหมดสาธิต: การกดปุ่มด้านล่างจะจำลองว่าชำระเงินสำเร็จ และเครดิตเงินเข้ากระเป๋าผ่านระบบบัญชีจริงของแอป
          </span>
        </InlineAlert>
      </div>

      <aside className="surface-card h-fit space-y-3 p-5 lg:sticky lg:top-20">
        <h2 className="text-sm font-semibold">สรุปรายการ</h2>
        <dl className="space-y-1.5 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">ยอดเงินปัจจุบัน</dt>
            <dd>
              <Money value={balance} tone="muted" />
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">จำนวนที่ฝาก</dt>
            <dd>
              <Money value={amountSatang} className="font-semibold" />
            </dd>
          </div>
          <div className="flex justify-between border-t border-border pt-1.5">
            <dt className="text-muted-foreground">ยอดหลังฝาก</dt>
            <dd>
              <Money value={balance + amountSatang} tone="positive" className="font-semibold" />
            </dd>
          </div>
        </dl>

        <Button block size="lg" disabled={!valid || pending} onClick={() => setConfirmOpen(true)}>
          จำลองการชำระเงินสำเร็จ
        </Button>
        <p className="text-xs text-muted-foreground">
          ไม่มีการเรียกเก็บเงินจริง รายการนี้จะถูกบันทึกในประวัติธุรกรรมของคุณ
        </p>
      </aside>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        pending={pending}
        title="ยืนยันการฝากเงิน (จำลอง)"
        confirmLabel="ยืนยันการฝาก"
        description={
          <span>
            ระบบจะเพิ่มยอดเงิน <strong>{formatMoney(amountSatang)}</strong> เข้ากระเป๋าของคุณ
            และสร้างรายการบัญชีกำกับ
          </span>
        }
        onConfirm={submit}
      />
    </div>
  );
}
