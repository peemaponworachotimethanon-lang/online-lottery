'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/input';
import { InlineAlert } from '@/components/ui/feedback';
import { DEMO_CREDENTIALS } from '@/config/demo';
import { loginSchema, type LoginInput } from '@/schemas/auth';
import { loginAction } from '@/server/actions/auth-actions';

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = searchParams.get('next');
  const [formError, setFormError] = React.useState<string | null>(null);

  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '', remember: false },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    setFormError(null);
    const result = await loginAction(values);
    if (!result.ok) {
      setFormError(result.message);
      return;
    }
    toast.success(`ยินดีต้อนรับ ${result.data.displayName}`);
    const isStaff = result.data.roles.some((role) => role !== 'user');
    router.push(nextPath ?? (isStaff ? '/admin' : '/dashboard'));
    router.refresh();
  });

  const fillDemo = (account: { email: string; password: string }) => {
    form.setValue('email', account.email);
    form.setValue('password', account.password);
    setFormError(null);
  };

  return (
    <div className="surface-card p-6">
      <div className="mb-5 space-y-1">
        <h1 className="text-xl font-semibold tracking-tight">เข้าสู่ระบบ</h1>
        <p className="text-sm text-muted-foreground">ใช้บัญชีทดลองด้านล่างเพื่อเข้าใช้งานได้ทันที</p>
      </div>

      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        {formError ? <InlineAlert tone="danger">{formError}</InlineAlert> : null}

        <Field label="อีเมล" htmlFor="email" error={form.formState.errors.email?.message}>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            placeholder="you@example.com"
            aria-invalid={Boolean(form.formState.errors.email)}
            {...form.register('email')}
          />
        </Field>

        <Field label="รหัสผ่าน" htmlFor="password" error={form.formState.errors.password?.message}>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            aria-invalid={Boolean(form.formState.errors.password)}
            {...form.register('password')}
          />
        </Field>

        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input type="checkbox" className="size-4 accent-[var(--primary)]" {...form.register('remember')} />
            จดจำฉันไว้
          </label>
          <Link href="/forgot-password" className="text-sm text-primary hover:underline">
            ลืมรหัสผ่าน?
          </Link>
        </div>

        <Button type="submit" block size="lg" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? 'กำลังเข้าสู่ระบบ…' : 'เข้าสู่ระบบ'}
        </Button>
      </form>

      <div className="mt-5 space-y-2 border-t border-border pt-4">
        <p className="text-xs font-medium text-muted-foreground">บัญชีทดลอง (กดเพื่อกรอกอัตโนมัติ)</p>
        <div className="grid gap-2 sm:grid-cols-2">
          <Button variant="secondary" size="sm" onClick={() => fillDemo(DEMO_CREDENTIALS.user)}>
            ผู้ใช้ทั่วไป
          </Button>
          <Button variant="secondary" size="sm" onClick={() => fillDemo(DEMO_CREDENTIALS.admin)}>
            ผู้ดูแลระบบ
          </Button>
          <Button variant="ghost" size="sm" onClick={() => fillDemo(DEMO_CREDENTIALS.finance)}>
            ฝ่ายการเงิน
          </Button>
          <Button variant="ghost" size="sm" onClick={() => fillDemo(DEMO_CREDENTIALS.support)}>
            ฝ่ายบริการ
          </Button>
        </div>
      </div>

      <p className="mt-5 text-center text-sm text-muted-foreground">
        ยังไม่มีบัญชี?{' '}
        <Link href="/register" className="font-medium text-primary hover:underline">
          สมัครสมาชิก
        </Link>
      </p>
    </div>
  );
}
