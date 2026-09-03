'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/input';
import { InlineAlert } from '@/components/ui/feedback';
import { registerSchema, type RegisterInput } from '@/schemas/auth';
import { registerAction } from '@/server/actions/auth-actions';
import { cn } from '@/lib/utils';

const RULES: Array<{ label: string; test: (value: string) => boolean }> = [
  { label: 'อย่างน้อย 8 ตัวอักษร', test: (value) => value.length >= 8 },
  { label: 'มีตัวพิมพ์เล็ก', test: (value) => /[a-z]/.test(value) },
  { label: 'มีตัวพิมพ์ใหญ่', test: (value) => /[A-Z]/.test(value) },
  { label: 'มีตัวเลข', test: (value) => /[0-9]/.test(value) },
];

export function RegisterForm() {
  const router = useRouter();
  const [formError, setFormError] = React.useState<string | null>(null);

  const form = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    mode: 'onBlur',
    defaultValues: {
      username: '',
      email: '',
      phone: '',
      password: '',
      confirmPassword: '',
      acceptTerms: false as unknown as true,
    },
  });

  const password = form.watch('password') ?? '';

  const onSubmit = form.handleSubmit(async (values) => {
    setFormError(null);
    const result = await registerAction(values);
    if (!result.ok) {
      if (result.details) {
        for (const [field, message] of Object.entries(result.details)) {
          form.setError(field as keyof RegisterInput, { message });
        }
      }
      setFormError(result.message);
      return;
    }
    toast.success('สมัครสมาชิกสำเร็จ ยินดีต้อนรับ');
    router.push('/dashboard');
    router.refresh();
  });

  return (
    <div className="surface-card p-6">
      <div className="mb-5 space-y-1">
        <h1 className="text-xl font-semibold tracking-tight">สมัครสมาชิก</h1>
        <p className="text-sm text-muted-foreground">สร้างบัญชีทดลองใช้งาน ไม่มีการเก็บข้อมูลจริง</p>
      </div>

      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        {formError ? <InlineAlert tone="danger">{formError}</InlineAlert> : null}

        <Field
          label="ชื่อผู้ใช้"
          htmlFor="username"
          error={form.formState.errors.username?.message}
          hint="4–24 ตัวอักษร ใช้ a-z, 0-9, จุด และขีดล่าง"
        >
          <Input
            id="username"
            autoComplete="username"
            aria-invalid={Boolean(form.formState.errors.username)}
            {...form.register('username')}
          />
        </Field>

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

        <Field
          label="เบอร์โทรศัพท์"
          htmlFor="phone"
          error={form.formState.errors.phone?.message}
          hint="เช่น 0812345678"
        >
          <Input
            id="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            aria-invalid={Boolean(form.formState.errors.phone)}
            {...form.register('phone')}
          />
        </Field>

        <Field label="รหัสผ่าน" htmlFor="password" error={form.formState.errors.password?.message}>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            aria-invalid={Boolean(form.formState.errors.password)}
            {...form.register('password')}
          />
        </Field>

        <ul className="grid grid-cols-2 gap-1.5">
          {RULES.map((rule) => {
            const passed = rule.test(password);
            return (
              <li
                key={rule.label}
                className={cn(
                  'flex items-center gap-1.5 text-xs',
                  passed ? 'text-primary' : 'text-muted-foreground',
                )}
              >
                {passed ? <Check className="size-3.5" /> : <X className="size-3.5" />}
                {rule.label}
              </li>
            );
          })}
        </ul>

        <Field
          label="ยืนยันรหัสผ่าน"
          htmlFor="confirmPassword"
          error={form.formState.errors.confirmPassword?.message}
        >
          <Input
            id="confirmPassword"
            type="password"
            autoComplete="new-password"
            aria-invalid={Boolean(form.formState.errors.confirmPassword)}
            {...form.register('confirmPassword')}
          />
        </Field>

        <div className="space-y-1">
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="mt-0.5 size-4 accent-[var(--primary)]"
              {...form.register('acceptTerms')}
            />
            <span className="text-muted-foreground">
              ฉันยอมรับ{' '}
              <Link href="/help#terms" className="text-primary hover:underline">
                เงื่อนไขการใช้งาน
              </Link>{' '}
              และรับทราบว่าระบบนี้เป็นโหมดสาธิต
            </span>
          </label>
          {form.formState.errors.acceptTerms ? (
            <p role="alert" className="text-xs text-danger">
              {form.formState.errors.acceptTerms.message}
            </p>
          ) : null}
        </div>

        <Button type="submit" block size="lg" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? 'กำลังสมัคร…' : 'สมัครสมาชิก'}
        </Button>
      </form>

      <p className="mt-5 text-center text-sm text-muted-foreground">
        มีบัญชีอยู่แล้ว?{' '}
        <Link href="/login" className="font-medium text-primary hover:underline">
          เข้าสู่ระบบ
        </Link>
      </p>
    </div>
  );
}
