import Link from 'next/link';
import { Compass } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
      <span className="flex size-14 items-center justify-center rounded-full bg-primary-soft text-primary-soft-foreground">
        <Compass className="size-6" aria-hidden />
      </span>
      <div className="space-y-1">
        <p className="tabular text-sm font-medium text-muted-foreground">404</p>
        <h1 className="text-2xl font-semibold tracking-tight">ไม่พบหน้าที่คุณต้องการ</h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          หน้านี้อาจถูกย้าย เปลี่ยนชื่อ หรือไม่มีอยู่จริง
        </p>
      </div>
      <div className="flex gap-2">
        <Button asChild>
          <Link href="/">กลับหน้าแรก</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/lotteries">ดูหวยทั้งหมด</Link>
        </Button>
      </div>
    </div>
  );
}
