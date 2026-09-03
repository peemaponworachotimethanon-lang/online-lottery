'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Pencil, Plus, Trash2 } from 'lucide-react';
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
import { Checkbox } from '@/components/ui/misc';
import { Field, Input, Label, Textarea } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { deleteLotteryAction, saveLotteryAction } from '@/server/actions/admin-actions';
import type { LotteryFormInput } from '@/schemas/admin';

export interface LotteryFormValues extends LotteryFormInput {
  id?: string;
}

const EMPTY: LotteryFormValues = {
  name: '',
  nameTh: '',
  slug: '',
  country: '',
  countryCode: 'TH',
  timezone: 'Asia/Bangkok',
  description: '',
  status: 'active',
  betTypeCodes: [],
};

export function LotteryFormDialog({
  betTypes,
  initial,
  trigger,
}: {
  betTypes: Array<{ code: string; nameTh: string }>;
  initial?: LotteryFormValues;
  trigger?: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [values, setValues] = React.useState<LotteryFormValues>(initial ?? EMPTY);
  const [errors, setErrors] = React.useState<Record<string, string>>({});

  React.useEffect(() => {
    if (open) {
      setValues(initial ?? EMPTY);
      setErrors({});
    }
  }, [open, initial]);

  const set = <K extends keyof LotteryFormValues>(key: K, value: LotteryFormValues[K]) =>
    setValues((current) => ({ ...current, [key]: value }));

  const submit = async () => {
    setPending(true);
    const result = await saveLotteryAction(
      {
        name: values.name,
        nameTh: values.nameTh,
        slug: values.slug,
        country: values.country,
        countryCode: values.countryCode,
        timezone: values.timezone,
        description: values.description,
        status: values.status,
        betTypeCodes: values.betTypeCodes,
      },
      initial?.id,
    );
    setPending(false);

    if (!result.ok) {
      setErrors(result.details ?? {});
      toast.error(result.message);
      return;
    }
    toast.success(initial?.id ? 'บันทึกการแก้ไขแล้ว' : 'เพิ่มหวยใหม่แล้ว');
    setOpen(false);
    router.refresh();
  };

  return (
    <Dialog open={open} onOpenChange={(next) => (pending ? undefined : setOpen(next))}>
      <span onClick={() => setOpen(true)}>
        {trigger ?? (
          <Button size="sm">
            <Plus /> เพิ่มหวย
          </Button>
        )}
      </span>

      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{initial?.id ? 'แก้ไขหวย' : 'เพิ่มหวยใหม่'}</DialogTitle>
          <DialogDescription>
            ประเภทการแทงที่เลือกจะกำหนดว่าผู้ใช้แทงอะไรได้บ้างในหวยนี้
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="ชื่อ (อังกฤษ)" htmlFor="lot-name" error={errors.name}>
              <Input id="lot-name" value={values.name} onChange={(e) => set('name', e.target.value)} />
            </Field>
            <Field label="ชื่อ (ไทย)" htmlFor="lot-nameTh" error={errors.nameTh}>
              <Input id="lot-nameTh" value={values.nameTh} onChange={(e) => set('nameTh', e.target.value)} />
            </Field>
            <Field label="Slug (URL)" htmlFor="lot-slug" error={errors.slug} hint="เช่น thai-government">
              <Input
                id="lot-slug"
                value={values.slug}
                disabled={Boolean(initial?.id)}
                onChange={(e) => set('slug', e.target.value)}
              />
            </Field>
            <Field label="ประเทศ" htmlFor="lot-country" error={errors.country}>
              <Input id="lot-country" value={values.country} onChange={(e) => set('country', e.target.value)} />
            </Field>
            <Field label="รหัสประเทศ (2 ตัว)" htmlFor="lot-cc" error={errors.countryCode}>
              <Input
                id="lot-cc"
                maxLength={2}
                value={values.countryCode}
                onChange={(e) => set('countryCode', e.target.value.toUpperCase())}
              />
            </Field>
            <Field label="โซนเวลา" htmlFor="lot-tz" error={errors.timezone}>
              <Input id="lot-tz" value={values.timezone} onChange={(e) => set('timezone', e.target.value)} />
            </Field>
          </div>

          <Field label="คำอธิบาย" htmlFor="lot-desc" error={errors.description}>
            <Textarea
              id="lot-desc"
              value={values.description}
              onChange={(e) => set('description', e.target.value)}
            />
          </Field>

          <Field label="สถานะ" htmlFor="lot-status" error={errors.status}>
            <Select
              value={values.status}
              onValueChange={(value) => set('status', value as 'active' | 'inactive')}
            >
              <SelectTrigger id="lot-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">เปิดใช้งาน</SelectItem>
                <SelectItem value="inactive">ปิดใช้งาน</SelectItem>
              </SelectContent>
            </Select>
          </Field>

          <div className="space-y-2">
            <Label>ประเภทการแทงที่รองรับ</Label>
            {errors.betTypeCodes ? <p className="text-xs text-danger">{errors.betTypeCodes}</p> : null}
            <div className="grid gap-2 sm:grid-cols-2">
              {betTypes.map((betType) => {
                const checked = values.betTypeCodes.includes(betType.code);
                return (
                  <label
                    key={betType.code}
                    className="flex cursor-pointer items-center gap-2.5 rounded-[var(--radius-control)] border border-border px-3 py-2 text-sm"
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={(next) =>
                        set(
                          'betTypeCodes',
                          next
                            ? [...values.betTypeCodes, betType.code]
                            : values.betTypeCodes.filter((code) => code !== betType.code),
                        )
                      }
                    />
                    {betType.nameTh}
                  </label>
                );
              })}
            </div>
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

export function EditLotteryButton(props: {
  betTypes: Array<{ code: string; nameTh: string }>;
  initial: LotteryFormValues;
}) {
  return (
    <LotteryFormDialog
      {...props}
      trigger={
        <Button variant="ghost" size="icon-sm" aria-label={`แก้ไข ${props.initial.nameTh}`}>
          <Pencil />
        </Button>
      }
    />
  );
}

export function DeleteLotteryButton({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);

  return (
    <>
      <Button variant="ghost" size="icon-sm" aria-label={`ลบ ${name}`} onClick={() => setOpen(true)}>
        <Trash2 className="text-danger" />
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        pending={pending}
        destructive
        title="ยืนยันการลบหวย"
        confirmLabel="ลบหวย"
        description={
          <span>
            หวย <strong>{name}</strong> จะถูกซ่อนจากระบบ (soft delete) งวดและบิลเดิมยังคงอยู่เพื่อการตรวจสอบ
          </span>
        }
        onConfirm={async () => {
          setPending(true);
          const result = await deleteLotteryAction(id);
          setPending(false);
          if (!result.ok) {
            toast.error(result.message);
            return;
          }
          toast.success('ลบหวยแล้ว');
          setOpen(false);
          router.refresh();
        }}
      />
    </>
  );
}
