'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { KeyRound, ShieldBan, ShieldCheck, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Field, NumericInput, Textarea } from '@/components/ui/input';
import { InlineAlert } from '@/components/ui/feedback';
import { formatMoney } from '@/lib/money';
import {
  adjustWalletAction,
  resetUserPasswordAction,
  setUserStatusAction,
} from '@/server/actions/admin-actions';
import type { UserStatus } from '@/types/domain';

/**
 * Staff actions on one user.
 *
 * Every one of these is permission-checked and audited server-side; the UI only
 * decides what to *offer*. Wallet adjustment carries an idempotency key so a
 * double-click can never credit twice.
 */
export function UserActions({
  userId,
  username,
  status,
  balance,
  canEdit,
  canAdjustWallet,
}: {
  userId: string;
  username: string;
  status: UserStatus;
  balance: number;
  canEdit: boolean;
  canAdjustWallet: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const [statusOpen, setStatusOpen] = React.useState(false);
  const [resetOpen, setResetOpen] = React.useState(false);
  const [adjustOpen, setAdjustOpen] = React.useState(false);
  const [temporaryPassword, setTemporaryPassword] = React.useState<string | null>(null);

  const [amount, setAmount] = React.useState('');
  const [direction, setDirection] = React.useState<'credit' | 'debit'>('credit');
  const [reason, setReason] = React.useState('');

  const nextStatus: UserStatus = status === 'suspended' ? 'active' : 'suspended';

  const changeStatus = async () => {
    setPending(true);
    const result = await setUserStatusAction({
      userId,
      status: nextStatus,
      reason: nextStatus === 'suspended' ? 'ระงับโดยเจ้าหน้าที่' : 'คืนสิทธิ์การใช้งาน',
    });
    setPending(false);
    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    toast.success(nextStatus === 'suspended' ? 'ระงับบัญชีแล้ว' : 'เปิดใช้งานบัญชีแล้ว');
    setStatusOpen(false);
    router.refresh();
  };

  const resetPassword = async () => {
    setPending(true);
    const result = await resetUserPasswordAction(userId);
    setPending(false);
    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    setTemporaryPassword(result.data.temporaryPassword);
    toast.success('รีเซ็ตรหัสผ่านเรียบร้อย');
  };

  const adjust = async () => {
    const parsed = Number.parseInt(amount || '0', 10);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      toast.error('กรุณากรอกจำนวนเงินให้ถูกต้อง');
      return;
    }
    if (reason.trim().length < 5) {
      toast.error('กรุณาระบุเหตุผลอย่างน้อย 5 ตัวอักษร');
      return;
    }

    setPending(true);
    const result = await adjustWalletAction({
      userId,
      amountBaht: direction === 'credit' ? parsed : -parsed,
      reason: reason.trim(),
      idempotencyKey: `adj-${userId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    });
    setPending(false);

    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    toast.success('ปรับปรุงยอดเงินเรียบร้อย');
    setAdjustOpen(false);
    setAmount('');
    setReason('');
    router.refresh();
  };

  return (
    <div className="flex flex-wrap gap-2">
      {canAdjustWallet ? (
        <Button variant="outline" size="sm" onClick={() => setAdjustOpen(true)}>
          <Wallet /> ปรับปรุงยอดเงิน
        </Button>
      ) : null}

      {canEdit ? (
        <>
          <Button
            variant={status === 'suspended' ? 'primary' : 'outline'}
            size="sm"
            onClick={() => setStatusOpen(true)}
          >
            {status === 'suspended' ? <ShieldCheck /> : <ShieldBan />}
            {status === 'suspended' ? 'เปิดใช้งานบัญชี' : 'ระงับบัญชี'}
          </Button>
          <Button variant="outline" size="sm" onClick={() => setResetOpen(true)}>
            <KeyRound /> รีเซ็ตรหัสผ่าน
          </Button>
        </>
      ) : null}

      <ConfirmDialog
        open={statusOpen}
        onOpenChange={setStatusOpen}
        pending={pending}
        destructive={nextStatus === 'suspended'}
        title={nextStatus === 'suspended' ? 'ยืนยันการระงับบัญชี' : 'ยืนยันการเปิดใช้งานบัญชี'}
        confirmLabel={nextStatus === 'suspended' ? 'ระงับบัญชี' : 'เปิดใช้งาน'}
        description={
          nextStatus === 'suspended' ? (
            <span>
              ผู้ใช้ <strong>{username}</strong> จะไม่สามารถเข้าสู่ระบบหรือแทงหวยได้จนกว่าจะเปิดใช้งานอีกครั้ง
            </span>
          ) : (
            <span>
              ผู้ใช้ <strong>{username}</strong> จะกลับมาใช้งานระบบได้ตามปกติ
            </span>
          )
        }
        onConfirm={changeStatus}
      />

      <ConfirmDialog
        open={resetOpen}
        onOpenChange={(open) => {
          setResetOpen(open);
          if (!open) setTemporaryPassword(null);
        }}
        pending={pending}
        title="รีเซ็ตรหัสผ่าน (จำลอง)"
        confirmLabel="รีเซ็ตรหัสผ่าน"
        description="ระบบจะสร้างรหัสผ่านชั่วคราวและแสดงให้เจ้าหน้าที่หนึ่งครั้ง"
        onConfirm={resetPassword}
      >
        {temporaryPassword ? (
          <InlineAlert tone="warning">
            รหัสผ่านชั่วคราว: <strong className="tabular">{temporaryPassword}</strong>
            <span className="mt-1 block text-xs">
              ในระบบจริงควรส่งลิงก์ตั้งรหัสผ่านแบบใช้ครั้งเดียวทางอีเมลแทน ไม่แสดงรหัสผ่านให้เจ้าหน้าที่เห็น
            </span>
          </InlineAlert>
        ) : null}
      </ConfirmDialog>

      <Dialog open={adjustOpen} onOpenChange={(open) => (pending ? undefined : setAdjustOpen(open))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>ปรับปรุงยอดเงิน</DialogTitle>
            <DialogDescription>
              ยอดปัจจุบันของ {username}: {formatMoney(balance)}
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant={direction === 'credit' ? 'primary' : 'outline'}
                onClick={() => setDirection('credit')}
              >
                เพิ่มเงิน
              </Button>
              <Button
                variant={direction === 'debit' ? 'danger' : 'outline'}
                onClick={() => setDirection('debit')}
              >
                หักเงิน
              </Button>
            </div>

            <Field label="จำนวนเงิน (บาท)" htmlFor="adjust-amount">
              <NumericInput
                id="adjust-amount"
                value={amount}
                maxDigits={7}
                className="h-11 text-center text-lg"
                onChange={(event) => setAmount(event.target.value)}
              />
            </Field>

            <Field label="เหตุผล" htmlFor="adjust-reason" hint="จะถูกบันทึกในบันทึกการใช้งานและแจ้งผู้ใช้">
              <Textarea
                id="adjust-reason"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="เช่น ชดเชยรายการที่ผิดพลาดจากเคส #1234"
              />
            </Field>

            <InlineAlert tone="warning">
              รายการนี้จะสร้างรายการบัญชีประเภท adjustment และบันทึกใน audit log
            </InlineAlert>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" disabled={pending} onClick={() => setAdjustOpen(false)}>
              ยกเลิก
            </Button>
            <Button
              variant={direction === 'debit' ? 'danger' : 'primary'}
              disabled={pending}
              onClick={() => void adjust()}
            >
              {pending ? 'กำลังบันทึก…' : 'ยืนยันการปรับปรุง'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
