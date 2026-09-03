'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Pencil, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Field, Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { saveRoundAction } from '@/server/actions/admin-actions';
import { ROUND_STATUSES, type RoundStatus } from '@/types/domain';
import { statusLabels } from '@/components/ui/status-badge';

/**
 * Datetime-local inputs are wall-clock strings with no zone. The admin works in
 * Asia/Bangkok, so we convert to and from that zone explicitly rather than
 * relying on the browser's own timezone, which would silently produce different
 * round times for a staff member travelling abroad.
 */
const BANGKOK_OFFSET_MINUTES = 7 * 60;

function toLocalInput(iso: string): string {
  const shifted = new Date(new Date(iso).getTime() + BANGKOK_OFFSET_MINUTES * 60_000);
  return shifted.toISOString().slice(0, 16);
}

function fromLocalInput(value: string): string {
  return new Date(new Date(`${value}:00.000Z`).getTime() - BANGKOK_OFFSET_MINUTES * 60_000).toISOString();
}

export interface RoundFormValues {
  id?: string;
  lotteryId: string;
  roundCode: string;
  openAt: string;
  closeAt: string;
  resultAt: string;
  status: RoundStatus;
}

export function RoundFormDialog({
  lotteries,
  initial,
  trigger,
}: {
  lotteries: Array<{ id: string; nameTh: string }>;
  initial?: RoundFormValues;
  trigger?: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [errors, setErrors] = React.useState<Record<string, string>>({});

  const blank = React.useMemo<RoundFormValues>(() => {
    const now = Date.now();
    return {
      lotteryId: lotteries[0]?.id ?? '',
      roundCode: '',
      openAt: toLocalInput(new Date(now).toISOString()),
      closeAt: toLocalInput(new Date(now + 6 * 3_600_000).toISOString()),
      resultAt: toLocalInput(new Date(now + 7 * 3_600_000).toISOString()),
      status: 'scheduled',
    };
  }, [lotteries]);

  const [values, setValues] = React.useState<RoundFormValues>(blank);

  React.useEffect(() => {
    if (!open) return;
    setErrors({});
    setValues(
      initial
        ? {
            ...initial,
            openAt: toLocalInput(initial.openAt),
            closeAt: toLocalInput(initial.closeAt),
            resultAt: toLocalInput(initial.resultAt),
          }
        : blank,
    );
  }, [open, initial, blank]);

  const set = <K extends keyof RoundFormValues>(key: K, value: RoundFormValues[K]) =>
    setValues((current) => ({ ...current, [key]: value }));

  const submit = async () => {
    setPending(true);
    const result = await saveRoundAction(
      {
        lotteryId: values.lotteryId,
        roundCode: values.roundCode,
        openAt: fromLocalInput(values.openAt),
        closeAt: fromLocalInput(values.closeAt),
        resultAt: fromLocalInput(values.resultAt),
        status: values.status,
      },
      initial?.id,
    );
    setPending(false);

    if (!result.ok) {
      setErrors(result.details ?? {});
      toast.error(result.message);
      return;
    }
    toast.success(initial?.id ? 'บันทึกงวดแล้ว' : 'สร้างงวดใหม่แล้ว');
    setOpen(false);
    router.refresh();
  };

  return (
    <Dialog open={open} onOpenChange={(next) => (pending ? undefined : setOpen(next))}>
      <span onClick={() => setOpen(true)}>
        {trigger ?? (
          <Button size="sm">
            <Plus /> สร้างงวดใหม่
          </Button>
        )}
      </span>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>{initial?.id ? 'แก้ไขงวด' : 'สร้างงวดใหม่'}</DialogTitle>
          <DialogDescription>เวลาทั้งหมดกรอกเป็นเวลาไทย (Asia/Bangkok) และเก็บเป็น UTC</DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-4">
          <Field label="หวย" htmlFor="round-lottery" error={errors.lotteryId}>
            <Select value={values.lotteryId} onValueChange={(value) => set('lotteryId', value)}>
              <SelectTrigger id="round-lottery">
                <SelectValue placeholder="เลือกหวย" />
              </SelectTrigger>
              <SelectContent>
                {lotteries.map((lottery) => (
                  <SelectItem key={lottery.id} value={lottery.id}>
                    {lottery.nameTh}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label="รหัสงวด" htmlFor="round-code" error={errors.roundCode} hint="เช่น THAI-20260916-1">
            <Input
              id="round-code"
              value={values.roundCode}
              onChange={(event) => set('roundCode', event.target.value)}
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="เปิดรับ" htmlFor="round-open" error={errors.openAt}>
              <Input
                id="round-open"
                type="datetime-local"
                value={values.openAt}
                onChange={(event) => set('openAt', event.target.value)}
              />
            </Field>
            <Field label="ปิดรับ" htmlFor="round-close" error={errors.closeAt}>
              <Input
                id="round-close"
                type="datetime-local"
                value={values.closeAt}
                onChange={(event) => set('closeAt', event.target.value)}
              />
            </Field>
            <Field label="ออกผล" htmlFor="round-result" error={errors.resultAt}>
              <Input
                id="round-result"
                type="datetime-local"
                value={values.resultAt}
                onChange={(event) => set('resultAt', event.target.value)}
              />
            </Field>
          </div>

          <Field label="สถานะ" htmlFor="round-status" error={errors.status}>
            <Select value={values.status} onValueChange={(value) => set('status', value as RoundStatus)}>
              <SelectTrigger id="round-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROUND_STATUSES.map((status) => (
                  <SelectItem key={status} value={status}>
                    {statusLabels.ROUND[status].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </DialogBody>

        <DialogFooter>
          <Button variant="outline" disabled={pending} onClick={() => setOpen(false)}>
            ยกเลิก
          </Button>
          <Button disabled={pending} onClick={() => void submit()}>
            {pending ? 'กำลังบันทึก…' : 'บันทึก'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function EditRoundButton(props: {
  lotteries: Array<{ id: string; nameTh: string }>;
  initial: RoundFormValues;
}) {
  return (
    <RoundFormDialog
      {...props}
      trigger={
        <Button variant="ghost" size="icon-sm" aria-label={`แก้ไขงวด ${props.initial.roundCode}`}>
          <Pencil />
        </Button>
      }
    />
  );
}
