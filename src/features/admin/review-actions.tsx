'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Textarea } from '@/components/ui/input';
import { formatMoney } from '@/lib/money';
import { reviewDepositAction, reviewWithdrawalAction } from '@/server/actions/admin-actions';

/**
 * Approve / reject controls for a pending deposit or withdrawal.
 *
 * Both decisions are money-moving, so both go through a confirmation dialog and
 * carry an idempotency key; the button stays disabled until the request settles.
 */
export function ReviewActions({
  kind,
  id,
  reference,
  amount,
  disabled,
}: {
  kind: 'deposit' | 'withdrawal';
  id: string;
  reference: string;
  amount: number;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [decision, setDecision] = React.useState<'approve' | 'reject' | null>(null);
  const [note, setNote] = React.useState('');
  const [pending, setPending] = React.useState(false);

  const run = async () => {
    if (!decision) return;
    setPending(true);
    const payload = {
      id,
      decision,
      note,
      idempotencyKey: `rev-${kind}-${id}-${decision}-${Date.now()}`,
    };
    const result =
      kind === 'deposit' ? await reviewDepositAction(payload) : await reviewWithdrawalAction(payload);
    setPending(false);

    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    toast.success(decision === 'approve' ? 'อนุมัติรายการแล้ว' : 'ปฏิเสธรายการแล้ว');
    setDecision(null);
    setNote('');
    router.refresh();
  };

  const approveCopy =
    kind === 'deposit'
      ? 'ระบบจะเครดิตเงินเข้ากระเป๋าผู้ใช้และสร้างรายการบัญชี'
      : 'ระบบจะปลดวงเงินที่กันไว้และบันทึกว่าโอนออกเรียบร้อย';
  const rejectCopy =
    kind === 'deposit'
      ? 'รายการจะถูกทำเครื่องหมายว่าไม่ผ่าน และไม่มีการเครดิตเงิน'
      : 'ระบบจะคืนวงเงินที่กันไว้กลับเข้ากระเป๋าผู้ใช้';

  return (
    <div className="flex justify-end gap-1.5">
      <Button size="sm" disabled={disabled || pending} onClick={() => setDecision('approve')}>
        <Check /> อนุมัติ
      </Button>
      <Button
        size="sm"
        variant="outline"
        disabled={disabled || pending}
        onClick={() => setDecision('reject')}
      >
        <X /> ปฏิเสธ
      </Button>

      <ConfirmDialog
        open={decision !== null}
        onOpenChange={(open) => (open ? undefined : setDecision(null))}
        pending={pending}
        destructive={decision === 'reject'}
        title={decision === 'approve' ? 'ยืนยันการอนุมัติ' : 'ยืนยันการปฏิเสธ'}
        confirmLabel={decision === 'approve' ? 'อนุมัติ' : 'ปฏิเสธ'}
        description={
          <span className="block space-y-1">
            <span className="block">
              รายการ <strong className="tabular">{reference}</strong> จำนวน{' '}
              <strong>{formatMoney(amount)}</strong>
            </span>
            <span className="block text-xs">{decision === 'approve' ? approveCopy : rejectCopy}</span>
          </span>
        }
        onConfirm={run}
      >
        <Textarea
          aria-label="หมายเหตุ"
          placeholder="หมายเหตุ (ไม่บังคับ) — จะบันทึกไว้ในรายการและ audit log"
          value={note}
          onChange={(event) => setNote(event.target.value)}
        />
      </ConfirmDialog>
    </div>
  );
}
