'use client';

import * as React from 'react';
import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    // In production this is where an error reporter (Sentry, etc.) is called.
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
      <span className="flex size-14 items-center justify-center rounded-full bg-danger-soft text-danger">
        <AlertTriangle className="size-6" aria-hidden />
      </span>
      <div className="space-y-1">
        <p className="tabular text-sm font-medium text-muted-foreground">500</p>
        <h1 className="text-2xl font-semibold tracking-tight">เกิดข้อผิดพลาดในระบบ</h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          เราบันทึกปัญหานี้ไว้แล้ว กรุณาลองใหม่อีกครั้ง
        </p>
        {error.digest ? (
          <p className="tabular text-xs text-muted-foreground">รหัสอ้างอิง: {error.digest}</p>
        ) : null}
      </div>
      <div className="flex gap-2">
        <Button onClick={reset}>ลองใหม่อีกครั้ง</Button>
        <Button asChild variant="outline">
          <Link href="/">กลับหน้าแรก</Link>
        </Button>
      </div>
    </div>
  );
}
