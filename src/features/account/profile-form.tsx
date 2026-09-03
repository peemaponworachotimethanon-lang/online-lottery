'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { THAI_BANKS } from '@/mocks/names';
import { updateProfileSchema, type UpdateProfileInput } from '@/schemas/auth';
import { updateProfileAction } from '@/server/actions/account-actions';
import type { PublicUser } from '@/types/domain';

export function ProfileForm({ user }: { user: PublicUser }) {
  const router = useRouter();

  const form = useForm<UpdateProfileInput>({
    resolver: zodResolver(updateProfileSchema),
    defaultValues: {
      displayName: user.displayName,
      phone: user.phone,
      bankName: user.bankName ?? '',
      bankAccountName: user.bankAccountName ?? '',
      bankAccountNumber: user.bankAccountNumber ?? '',
    },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    const result = await updateProfileAction(values);
    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    toast.success('บันทึกข้อมูลเรียบร้อย');
    router.refresh();
  });

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="ชื่อที่แสดง" htmlFor="displayName" error={form.formState.errors.displayName?.message}>
          <Input id="displayName" {...form.register('displayName')} />
        </Field>
        <Field label="เบอร์โทรศัพท์" htmlFor="phone" error={form.formState.errors.phone?.message}>
          <Input id="phone" type="tel" inputMode="tel" {...form.register('phone')} />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="ธนาคาร" htmlFor="profile-bank" error={form.formState.errors.bankName?.message}>
          <Select
            value={form.watch('bankName') || undefined}
            onValueChange={(value) => form.setValue('bankName', value, { shouldValidate: true })}
          >
            <SelectTrigger id="profile-bank">
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
          htmlFor="bankAccountNumber"
          error={form.formState.errors.bankAccountNumber?.message}
        >
          <Input id="bankAccountNumber" inputMode="numeric" {...form.register('bankAccountNumber')} />
        </Field>
      </div>

      <Field
        label="ชื่อบัญชี"
        htmlFor="bankAccountName"
        error={form.formState.errors.bankAccountName?.message}
      >
        <Input id="bankAccountName" {...form.register('bankAccountName')} />
      </Field>

      <Button type="submit" disabled={form.formState.isSubmitting}>
        {form.formState.isSubmitting ? 'กำลังบันทึก…' : 'บันทึกการเปลี่ยนแปลง'}
      </Button>
    </form>
  );
}
