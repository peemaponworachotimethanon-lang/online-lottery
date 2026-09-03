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
import { Field, Input, Label, NumericInput } from '@/components/ui/input';
import { InlineAlert } from '@/components/ui/feedback';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/misc';
import { saveBetTypeAction, savePayoutRateAction } from '@/server/actions/admin-actions';
import { MATCH_STRATEGIES, type MatchStrategy } from '@/types/domain';

const STRATEGY_LABELS: Record<MatchStrategy, string> = {
  'exact-top-3': 'ตรงกับ 3 ตัวบน',
  'permutation-top-3': 'สลับตำแหน่งของ 3 ตัวบน (โต๊ด)',
  'exact-top-2': 'ตรงกับ 2 ตัวบน',
  'exact-bottom-2': 'ตรงกับ 2 ตัวล่าง',
  'running-top': 'เลขวิ่งใน 3 ตัวบน',
  'running-bottom': 'เลขวิ่งใน 2 ตัวล่าง',
};

export interface BetTypeFormValues {
  id?: string;
  name: string;
  nameTh: string;
  code: string;
  digitLength: number;
  matchStrategy: MatchStrategy;
  minBetBaht: number;
  maxBetBaht: number;
  maxPerNumberBaht: number;
  isActive: boolean;
  description: string;
}

const EMPTY: BetTypeFormValues = {
  name: '',
  nameTh: '',
  code: '',
  digitLength: 2,
  matchStrategy: 'exact-top-2',
  minBetBaht: 1,
  maxBetBaht: 20_000,
  maxPerNumberBaht: 50_000,
  isActive: true,
  description: '',
};

export function BetTypeFormDialog({
  initial,
  trigger,
}: {
  initial?: BetTypeFormValues;
  trigger?: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [values, setValues] = React.useState<BetTypeFormValues>(initial ?? EMPTY);

  React.useEffect(() => {
    if (open) {
      setValues(initial ?? EMPTY);
      setErrors({});
    }
  }, [open, initial]);

  const set = <K extends keyof BetTypeFormValues>(key: K, value: BetTypeFormValues[K]) =>
    setValues((current) => ({ ...current, [key]: value }));

  const submit = async () => {
    setPending(true);
    const result = await saveBetTypeAction(values, initial?.id);
    setPending(false);
    if (!result.ok) {
      setErrors(result.details ?? {});
      toast.error(result.message);
      return;
    }
    toast.success(initial?.id ? 'บันทึกประเภทการแทงแล้ว' : 'เพิ่มประเภทการแทงแล้ว');
    setOpen(false);
    router.refresh();
  };

  return (
    <Dialog open={open} onOpenChange={(next) => (pending ? undefined : setOpen(next))}>
      <span onClick={() => setOpen(true)}>
        {trigger ?? (
          <Button size="sm">
            <Plus /> เพิ่มประเภทการแทง
          </Button>
        )}
      </span>

      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{initial?.id ? 'แก้ไขประเภทการแทง' : 'เพิ่มประเภทการแทง'}</DialogTitle>
          <DialogDescription>
            อัตราจ่ายตั้งค่าแยกต่างหากที่หน้า &quot;อัตราจ่าย&quot; เพื่อให้ปรับได้โดยไม่กระทบวงเงิน
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="ชื่อ (อังกฤษ)" htmlFor="bt-name" error={errors.name}>
              <Input id="bt-name" value={values.name} onChange={(e) => set('name', e.target.value)} />
            </Field>
            <Field label="ชื่อ (ไทย)" htmlFor="bt-nameTh" error={errors.nameTh}>
              <Input id="bt-nameTh" value={values.nameTh} onChange={(e) => set('nameTh', e.target.value)} />
            </Field>
            <Field label="รหัส (code)" htmlFor="bt-code" error={errors.code} hint="เช่น two-top">
              <Input
                id="bt-code"
                value={values.code}
                disabled={Boolean(initial?.id)}
                onChange={(e) => set('code', e.target.value)}
              />
            </Field>
            <Field label="จำนวนหลัก" htmlFor="bt-digits" error={errors.digitLength}>
              <NumericInput
                id="bt-digits"
                maxDigits={1}
                value={String(values.digitLength)}
                onChange={(e) => set('digitLength', Number(e.target.value || 1))}
              />
            </Field>
          </div>

          <Field
            label="วิธีตัดสินผล"
            htmlFor="bt-strategy"
            error={errors.matchStrategy}
            hint="กำหนดว่าเลขที่แทงจะถูกนำไปเทียบกับผลรางวัลอย่างไร"
          >
            <Select
              value={values.matchStrategy}
              onValueChange={(value) => set('matchStrategy', value as MatchStrategy)}
            >
              <SelectTrigger id="bt-strategy">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MATCH_STRATEGIES.map((strategy) => (
                  <SelectItem key={strategy} value={strategy}>
                    {STRATEGY_LABELS[strategy]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="ขั้นต่ำ (บาท)" htmlFor="bt-min" error={errors.minBetBaht}>
              <NumericInput
                id="bt-min"
                value={String(values.minBetBaht)}
                onChange={(e) => set('minBetBaht', Number(e.target.value || 0))}
              />
            </Field>
            <Field label="สูงสุด/รายการ (บาท)" htmlFor="bt-max" error={errors.maxBetBaht}>
              <NumericInput
                id="bt-max"
                value={String(values.maxBetBaht)}
                onChange={(e) => set('maxBetBaht', Number(e.target.value || 0))}
              />
            </Field>
            <Field label="สูงสุด/เลข/งวด (บาท)" htmlFor="bt-maxnum" error={errors.maxPerNumberBaht}>
              <NumericInput
                id="bt-maxnum"
                value={String(values.maxPerNumberBaht)}
                onChange={(e) => set('maxPerNumberBaht', Number(e.target.value || 0))}
              />
            </Field>
          </div>

          <Field label="คำอธิบาย" htmlFor="bt-desc" error={errors.description}>
            <Input
              id="bt-desc"
              value={values.description}
              onChange={(e) => set('description', e.target.value)}
            />
          </Field>

          <div className="flex items-center justify-between gap-4">
            <Label htmlFor="bt-active">เปิดใช้งาน</Label>
            <Switch
              id="bt-active"
              checked={values.isActive}
              onCheckedChange={(checked) => set('isActive', checked)}
            />
          </div>

          <InlineAlert tone="info">
            หากเพิ่มประเภทใหม่ อย่าลืมตั้งอัตราจ่ายที่หน้า &quot;อัตราจ่าย&quot; มิฉะนั้นผู้ใช้จะยังแทงไม่ได้
          </InlineAlert>
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

export function EditBetTypeButton({ initial }: { initial: BetTypeFormValues }) {
  return (
    <BetTypeFormDialog
      initial={initial}
      trigger={
        <Button variant="ghost" size="icon-sm" aria-label={`แก้ไข ${initial.nameTh}`}>
          <Pencil />
        </Button>
      }
    />
  );
}

/* ------------------------------------------------------------------ */
/* Payout rate                                                         */
/* ------------------------------------------------------------------ */

export interface PayoutRateFormValues {
  id?: string;
  betTypeCode: string;
  lotteryId: string | null;
  rateX: number;
  isActive: boolean;
}

export function PayoutRateFormDialog({
  betTypes,
  lotteries,
  initial,
  trigger,
}: {
  betTypes: Array<{ code: string; nameTh: string }>;
  lotteries: Array<{ id: string; nameTh: string }>;
  initial?: PayoutRateFormValues;
  trigger?: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);

  const blank: PayoutRateFormValues = {
    betTypeCode: betTypes[0]?.code ?? '',
    lotteryId: null,
    rateX: 90,
    isActive: true,
  };
  const [values, setValues] = React.useState<PayoutRateFormValues>(initial ?? blank);

  React.useEffect(() => {
    if (open) setValues(initial ?? blank);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initial]);

  const submit = async () => {
    setPending(true);
    const result = await savePayoutRateAction(
      {
        betTypeCode: values.betTypeCode,
        lotteryId: values.lotteryId,
        rateX: values.rateX,
        isActive: values.isActive,
      },
      initial?.id,
    );
    setPending(false);
    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    toast.success('บันทึกอัตราจ่ายแล้ว');
    setOpen(false);
    router.refresh();
  };

  return (
    <Dialog open={open} onOpenChange={(next) => (pending ? undefined : setOpen(next))}>
      <span onClick={() => setOpen(true)}>
        {trigger ?? (
          <Button size="sm">
            <Plus /> เพิ่มอัตราจ่าย
          </Button>
        )}
      </span>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>{initial?.id ? 'แก้ไขอัตราจ่าย' : 'เพิ่มอัตราจ่าย'}</DialogTitle>
          <DialogDescription>
            การแก้ไขมีผลกับบิลที่แทงหลังจากนี้เท่านั้น บิลเดิมยังใช้อัตราที่บันทึกไว้ ณ เวลาที่แทง
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-4">
          <Field label="ประเภทการแทง" htmlFor="rate-bettype">
            <Select
              value={values.betTypeCode}
              disabled={Boolean(initial?.id)}
              onValueChange={(value) => setValues((current) => ({ ...current, betTypeCode: value }))}
            >
              <SelectTrigger id="rate-bettype">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {betTypes.map((betType) => (
                  <SelectItem key={betType.code} value={betType.code}>
                    {betType.nameTh}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field
            label="ขอบเขต"
            htmlFor="rate-scope"
            hint="อัตราเฉพาะหวยจะถูกใช้ก่อนอัตราเริ่มต้นเสมอ"
          >
            <Select
              value={values.lotteryId ?? '__default__'}
              disabled={Boolean(initial?.id)}
              onValueChange={(value) =>
                setValues((current) => ({
                  ...current,
                  lotteryId: value === '__default__' ? null : value,
                }))
              }
            >
              <SelectTrigger id="rate-scope">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__default__">ทุกหวย (ค่าเริ่มต้น)</SelectItem>
                {lotteries.map((lottery) => (
                  <SelectItem key={lottery.id} value={lottery.id}>
                    {lottery.nameTh}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label="อัตราจ่าย (เท่า)" htmlFor="rate-x" hint="รองรับทศนิยม เช่น 92.5">
            <Input
              id="rate-x"
              inputMode="decimal"
              className="tabular h-11 text-center text-lg"
              value={String(values.rateX)}
              onChange={(event) =>
                setValues((current) => ({ ...current, rateX: Number(event.target.value || 0) }))
              }
            />
          </Field>

          <div className="flex items-center justify-between gap-4">
            <Label htmlFor="rate-active">เปิดใช้งาน</Label>
            <Switch
              id="rate-active"
              checked={values.isActive}
              onCheckedChange={(checked) => setValues((current) => ({ ...current, isActive: checked }))}
            />
          </div>
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

export function EditPayoutRateButton(props: {
  betTypes: Array<{ code: string; nameTh: string }>;
  lotteries: Array<{ id: string; nameTh: string }>;
  initial: PayoutRateFormValues;
  label: string;
}) {
  return (
    <PayoutRateFormDialog
      betTypes={props.betTypes}
      lotteries={props.lotteries}
      initial={props.initial}
      trigger={
        <Button variant="ghost" size="icon-sm" aria-label={`แก้ไขอัตราจ่าย ${props.label}`}>
          <Pencil />
        </Button>
      }
    />
  );
}
