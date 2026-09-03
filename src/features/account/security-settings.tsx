'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Field, Input, Label } from '@/components/ui/input';
import { Switch } from '@/components/ui/misc';
import { changePasswordSchema, type ChangePasswordInput } from '@/schemas/auth';
import { changePasswordAction, updateSettingsAction } from '@/server/actions/account-actions';

export function ChangePasswordForm() {
  const form = useForm<ChangePasswordInput>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    const result = await changePasswordAction(values);
    if (!result.ok) {
      if (result.details) {
        for (const [field, message] of Object.entries(result.details)) {
          form.setError(field as keyof ChangePasswordInput, { message });
        }
      }
      toast.error(result.message);
      return;
    }
    toast.success('เปลี่ยนรหัสผ่านเรียบร้อย');
    form.reset();
  });

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <Field
        label="รหัสผ่านปัจจุบัน"
        htmlFor="currentPassword"
        error={form.formState.errors.currentPassword?.message}
      >
        <Input
          id="currentPassword"
          type="password"
          autoComplete="current-password"
          {...form.register('currentPassword')}
        />
      </Field>
      <Field label="รหัสผ่านใหม่" htmlFor="newPassword" error={form.formState.errors.newPassword?.message}>
        <Input
          id="newPassword"
          type="password"
          autoComplete="new-password"
          {...form.register('newPassword')}
        />
      </Field>
      <Field
        label="ยืนยันรหัสผ่านใหม่"
        htmlFor="confirmNewPassword"
        error={form.formState.errors.confirmPassword?.message}
      >
        <Input
          id="confirmNewPassword"
          type="password"
          autoComplete="new-password"
          {...form.register('confirmPassword')}
        />
      </Field>
      <Button type="submit" disabled={form.formState.isSubmitting}>
        {form.formState.isSubmitting ? 'กำลังบันทึก…' : 'เปลี่ยนรหัสผ่าน'}
      </Button>
    </form>
  );
}

export function PreferencesForm({
  marketingOptIn,
  twoFactorEnabled,
}: {
  marketingOptIn: boolean;
  twoFactorEnabled: boolean;
}) {
  const [marketing, setMarketing] = React.useState(marketingOptIn);
  const [twoFactor, setTwoFactor] = React.useState(twoFactorEnabled);
  const [pending, setPending] = React.useState(false);

  const save = async (next: { marketingOptIn: boolean; twoFactorEnabled: boolean }) => {
    setPending(true);
    const result = await updateSettingsAction(next);
    setPending(false);
    if (!result.ok) {
      toast.error(result.message);
      // Roll the toggle back so the UI never claims a state the server rejected.
      setMarketing(marketingOptIn);
      setTwoFactor(twoFactorEnabled);
      return;
    }
    toast.success('บันทึกการตั้งค่าแล้ว');
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-0.5">
          <Label htmlFor="marketing">รับข่าวสารและโปรโมชัน</Label>
          <p className="text-sm text-muted-foreground">แจ้งเตือนโปรโมชันและงวดพิเศษ</p>
        </div>
        <Switch
          id="marketing"
          checked={marketing}
          disabled={pending}
          onCheckedChange={(checked) => {
            setMarketing(checked);
            void save({ marketingOptIn: checked, twoFactorEnabled: twoFactor });
          }}
        />
      </div>

      <div className="flex items-start justify-between gap-4 border-t border-border pt-4">
        <div className="space-y-0.5">
          <Label htmlFor="twoFactor">ยืนยันตัวตนสองชั้น (จำลอง)</Label>
          <p className="text-sm text-muted-foreground">
            ในโหมดสาธิตจะบันทึกค่าไว้เท่านั้น ยังไม่มีการบังคับใช้จริง
          </p>
        </div>
        <Switch
          id="twoFactor"
          checked={twoFactor}
          disabled={pending}
          onCheckedChange={(checked) => {
            setTwoFactor(checked);
            void save({ marketingOptIn: marketing, twoFactorEnabled: checked });
          }}
        />
      </div>
    </div>
  );
}
