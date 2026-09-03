import type { Metadata } from 'next';
import Link from 'next/link';
import { ShieldX } from 'lucide-react';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = { title: 'ไม่มีสิทธิ์เข้าถึง', robots: { index: false, follow: false } };

export default function ForbiddenPage() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
      <span className="flex size-14 items-center justify-center rounded-full bg-danger-soft text-danger">
        <ShieldX className="size-6" aria-hidden />
      </span>
      <div className="space-y-1">
        <p className="tabular text-sm font-medium text-muted-foreground">403</p>
        <h1 className="text-2xl font-semibold tracking-tight">ไม่มีสิทธิ์เข้าถึง</h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          บัญชีของคุณไม่มีสิทธิ์ในการเข้าถึงส่วนนี้ หากคิดว่าเป็นข้อผิดพลาด กรุณาติดต่อผู้ดูแลระบบ
        </p>
      </div>
      <div className="flex gap-2">
        <Button asChild>
          <Link href="/dashboard">ไปแดชบอร์ด</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/">กลับหน้าแรก</Link>
        </Button>
      </div>
    </div>
  );
}
