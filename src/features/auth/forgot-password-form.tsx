'use client';

import * as React from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { MailCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/input';
import { InlineAlert } from '@/components/ui/feedback';
import { forgotPasswordSchema, type ForgotPasswordInput } from '@/schemas/auth';
import { forgotPasswordAction } from '@/server/actions/auth-actions';

export function ForgotPasswordForm() {
  const [sent, setSent] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);

  const form = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: '' },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    setFormError(null);
    const result = await forgotPasswordAction(values);
    if (!result.ok) {
      setFormError(result.message);
      return;
    }
    setSent(true);
  });

  if (sent) {
    return (
      <div className="surface-card space-y-4 p-6 text-center">
        <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-primary-soft text-primary-soft-foreground">
          <MailCheck className="size-5" />
        </span>
        <div className="space-y-1">
          <h1 className="text-lg font-semibold tracking-tight">ส่งคำขอเรียบร้อย</h1>
          <p className="text-sm text-muted-foreground">
            หากอีเมลนี้มีอยู่ในระบบ คุณจะได้รับลิงก์สำหรับตั้งรหัสผ่านใหม่
          </p>
        </div>
        <InlineAlert tone="info">
          โหมดสาธิต: ระบบไม่ได้ส่งอีเมลจริง กรุณาใช้บัญชีทดลองในหน้าเข้าสู่ระบบ
        </InlineAlert>
        <Button asChild block>
          <Link href="/login">กลับไปหน้าเข้าสู่ระบบ</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="surface-card p-6">
      <div className="mb-5 space-y-1">
        <h1 className="text-xl font-semibold tracking-tight">ลืมรหัสผ่าน</h1>
        <p className="text-sm text-muted-foreground">
          กรอกอีเมลที่ใช้สมัคร ระบบจะส่งวิธีตั้งรหัสผ่านใหม่ให้
        </p>
      </div>

      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        {formError ? <InlineAlert tone="danger">{formError}</InlineAlert> : null}
        <Field label="อีเมล" htmlFor="email" error={form.formState.errors.email?.message}>
          <Input
            id="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            aria-invalid={Boolean(form.formState.errors.email)}
            {...form.register('email')}
          />
        </Field>
        <Button type="submit" block size="lg" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? 'กำลังส่ง…' : 'ส่งคำขอรีเซ็ตรหัสผ่าน'}
        </Button>
      </form>

      <p className="mt-5 text-center text-sm text-muted-foreground">
        <Link href="/login" className="font-medium text-primary hover:underline">
          กลับไปหน้าเข้าสู่ระบบ
        </Link>
      </p>
    </div>
  );
}
