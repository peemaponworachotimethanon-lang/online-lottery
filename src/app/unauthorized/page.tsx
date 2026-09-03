import type { Metadata } from 'next';
import Link from 'next/link';
import { LogIn } from 'lucide-react';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = { title: 'ต้องเข้าสู่ระบบ', robots: { index: false, follow: false } };

export default function UnauthorizedPage() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
      <span className="flex size-14 items-center justify-center rounded-full bg-warning-soft text-warning-foreground">
        <LogIn className="size-6" aria-hidden />
      </span>
      <div className="space-y-1">
        <p className="tabular text-sm font-medium text-muted-foreground">401</p>
        <h1 className="text-2xl font-semibold tracking-tight">กรุณาเข้าสู่ระบบ</h1>
        <p className="max-w-sm text-sm text-muted-foreground">หน้านี้สำหรับผู้ใช้ที่เข้าสู่ระบบแล้วเท่านั้น</p>
      </div>
      <Button asChild>
        <Link href="/login">ไปหน้าเข้าสู่ระบบ</Link>
      </Button>
    </div>
  );
}
