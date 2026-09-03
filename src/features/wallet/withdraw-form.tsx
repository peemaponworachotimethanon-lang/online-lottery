'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { InlineAlert } from '@/components/ui/feedback';
import { Field, Input, NumericInput } from '@/components/ui/input';
import { Money } from '@/components/ui/money';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { bahtToSatang, formatMoney } from '@/lib/money';
import { THAI_BANKS } from '@/mocks/names';
import { MAX_WITHDRAWAL_SATANG, MIN_WITHDRAWAL_SATANG, withdrawalSchema, type WithdrawalInput } from '@/schemas/betting';
import { requestWithdrawalAction } from '@/server/actions/wallet-actions';

export function WithdrawForm({
  balance,
  held,
  defaults,
}: {
  balance: number;
  held: number;
  defaults: { bankName: string | null; bankAccountNumber: string | null; bankAccountName: string | null };
}) {
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);

  const form = useForm<WithdrawalInput>({
    resolver: zodResolver(withdrawalSchema),
    defaultValues: {
      amountBaht: 500,
      bankName: defaults.bankName ?? THAI_BANKS[0],
      bankAccountNumber: defaults.bankAccountNumber ?? '',
      bankAccountName: defaults.bankAccountName ?? '',
      idempotencyKey: 'placeholder',
    },
  });

  const amountBaht = form.watch('amountBaht') || 0;
  const amountSatang = bahtToSatang(Number(amountBaht) || 0);
  const insufficient = amountSatang > balance;

  const openConfirm = form.handleSubmit(() => {
    if (insufficient) {
      form.setError('amountBaht', { message: 'ยอดเงินคงเหลือไม่เพียงพอ' });
      return;
    }
    setConfirmOpen(true);
  });

  const submit = async () => {
    setPending(true);
    try {
      const values = form.getValues();
      const result = await requestWithdrawalAction({
        ...values,
        amountBaht: Number(values.amountBaht),
        idempotencyKey: `wdr-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
      });

      if (!result.ok) {
        toast.error(result.message);
        return;
      }

      toast.success('ส่งคำขอถอนเงินแล้ว', {
        description: `${formatMoney(result.data.amount)} · รอเจ้าหน้าที่ตรวจสอบ`,
      });
      setConfirmOpen(false);
      router.refresh();
      router.push('/account/withdrawals');
    } catch {
      toast.error('เกิดข้อผิดพลาด กรุณาลองใหม่');
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
      <form onSubmit={openConfirm} className="surface-card space-y-4 p-5" noValidate>
        <Field
          label="จำนวนเงินที่ต้องการถอน (บาท)"
          htmlFor="withdraw-amount"
          error={form.formState.errors.amountBaht?.message}
          hint={`ถอนได้ระหว่าง ${formatMoney(MIN_WITHDRAWAL_SATANG)} – ${formatMoney(MAX_WITHDRAWAL_SATANG)}`}
        >
          <NumericInput
            id="withdraw-amount"
            maxDigits={7}
            className="h-12 text-center text-xl"
            value={String(form.watch('amountBaht') ?? '')}
            onChange={(event) =>
              form.setValue('amountBaht', Number(event.target.value || 0), { shouldValidate: true })
            }
          />
        </Field>

        <div className="flex flex-wrap gap-2">
          {[100, 500, 1000, 5000].map((preset) => (
            <Button
              key={preset}
              variant="secondary"
              size="sm"
              onClick={() => form.setValue('amountBaht', preset, { shouldValidate: true })}
            >
              {preset.toLocaleString('th-TH')}
            </Button>
          ))}
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              form.setValue('amountBaht', Math.floor(balance / 100), { shouldValidate: true })
            }
          >
            ถอนทั้งหมด
          </Button>
        </div>

        <Field label="ธนาคาร" htmlFor="bank-name" error={form.formState.errors.bankName?.message}>
          <Select
            value={form.watch('bankName')}
            onValueChange={(value) => form.setValue('bankName', value, { shouldValidate: true })}
          >
            <SelectTrigger id="bank-name">
              <SelectValue placeholder="เลือกธนาคาร" />
            </SelectTrigger>
            <SelectContent>
              {THAI_BANKS.map((bank) => (
                <SelectItem key={bank} value={bank}>
                  {bank}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field
          label="เลขที่บัญชี"
          htmlFor="bank-account-number"
          error={form.formState.errors.bankAccountNumber?.message}
        >
          <Input
            id="bank-account-number"
            inputMode="numeric"
            aria-invalid={Boolean(form.formState.errors.bankAccountNumber)}
            {...form.register('bankAccountNumber')}
          />
        </Field>

        <Field
          label="ชื่อบัญชี"
          htmlFor="bank-account-name"
          error={form.formState.errors.bankAccountName?.message}
          hint="ต้องตรงกับชื่อเจ้าของบัญชีผู้ใช้"
        >
          <Input
            id="bank-account-name"
            aria-invalid={Boolean(form.formState.errors.bankAccountName)}
            {...form.register('bankAccountName')}
          />
        </Field>

        <Button type="submit" block size="lg" disabled={pending}>
          ส่งคำขอถอนเงิน
        </Button>
      </form>

      <aside className="surface-card h-fit space-y-3 p-5 lg:sticky lg:top-20">
        <h2 className="text-sm font-semibold">สรุปยอด</h2>
        <dl className="space-y-1.5 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">ยอดที่ใช้ได้</dt>
            <dd>
              <Money value={balance} className="font-semibold" />
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">กันไว้อยู่แล้ว</dt>
            <dd>
              <Money value={held} tone="muted" />
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">จำนวนที่ขอถอน</dt>
            <dd>
              <Money value={amountSatang} />
            </dd>
          </div>
          <div className="flex justify-between border-t border-border pt-1.5">
            <dt className="text-muted-foreground">คงเหลือหลังกันวงเงิน</dt>
            <dd>
              <Money value={balance - amountSatang} tone={insufficient ? 'negative' : 'default'} />
            </dd>
          </div>
        </dl>

        <InlineAlert tone="info">
          <span className="flex items-start gap-2">
            <Lock className="mt-0.5 size-4 shrink-0" aria-hidden />
            เมื่อส่งคำขอ ระบบจะกันวงเงินออกจากยอดที่ใช้ได้ทันที เพื่อไม่ให้นำไปแทงซ้ำ
            หากคำขอถูกปฏิเสธ เงินจะถูกคืนเข้ากระเป๋าอัตโนมัติ
          </span>
        </InlineAlert>
      </aside>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        pending={pending}
        title="ยืนยันคำขอถอนเงิน"
        confirmLabel="ส่งคำขอ"
        description={
          <span>
            ระบบจะกันวงเงิน <strong>{formatMoney(amountSatang)}</strong> และส่งคำขอให้เจ้าหน้าที่ตรวจสอบ
          </span>
        }
        onConfirm={submit}
      >
        <dl className="space-y-1.5 text-sm">
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">ธนาคาร</dt>
            <dd className="text-right font-medium">{form.watch('bankName')}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">เลขที่บัญชี</dt>
            <dd className="tabular text-right font-medium">{form.watch('bankAccountNumber')}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">ชื่อบัญชี</dt>
            <dd className="text-right font-medium">{form.watch('bankAccountName')}</dd>
          </div>
        </dl>
      </ConfirmDialog>
    </div>
  );
}
