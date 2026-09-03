'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { CheckCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/feedback';
import { relativeFromNow } from '@/lib/datetime';
import { cn } from '@/lib/utils';
import {
  markAllNotificationsReadAction,
  markNotificationReadAction,
} from '@/server/actions/account-actions';
import type { NotificationDto } from '@/types/dto';

const TYPE_LABEL: Record<NotificationDto['type'], string> = {
  system: 'ระบบ',
  wallet: 'กระเป๋าเงิน',
  deposit: 'ฝากเงิน',
  withdrawal: 'ถอนเงิน',
  bet: 'การแทง',
  result: 'ผลรางวัล',
  promotion: 'โปรโมชัน',
};

export function NotificationList({ notifications }: { notifications: NotificationDto[] }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const unread = notifications.filter((notification) => notification.readAt === null).length;

  if (notifications.length === 0) {
    return <EmptyState title="ยังไม่มีการแจ้งเตือน" description="เมื่อมีความเคลื่อนไหว ระบบจะแจ้งที่นี่" />;
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-2 border-b border-border px-5 py-3">
        <p className="text-sm text-muted-foreground">
          ยังไม่ได้อ่าน <span className="tabular font-medium text-foreground">{unread}</span> รายการ
        </p>
        <Button
          variant="outline"
          size="sm"
          disabled={unread === 0 || pending}
          onClick={() =>
            startTransition(async () => {
              const result = await markAllNotificationsReadAction();
              if (result.ok) {
                toast.success(`ทำเครื่องหมายอ่านแล้ว ${result.data.updated} รายการ`);
                router.refresh();
              }
            })
          }
        >
          <CheckCheck /> อ่านทั้งหมด
        </Button>
      </div>

      <ul className="divide-y divide-border">
        {notifications.map((notification) => {
          const unreadItem = notification.readAt === null;
          const body = (
            <div className="flex items-start gap-3">
              <span
                aria-hidden
                className={cn(
                  'mt-1.5 size-2 shrink-0 rounded-full',
                  unreadItem ? 'bg-primary' : 'bg-transparent',
                )}
              />
              <div className="min-w-0 flex-1 space-y-0.5">
                <div className="flex flex-wrap items-center gap-2">
                  <p className={cn('text-sm', unreadItem && 'font-medium')}>{notification.title}</p>
                  <Badge variant="neutral">{TYPE_LABEL[notification.type]}</Badge>
                </div>
                <p className="text-sm text-muted-foreground">{notification.body}</p>
                <p className="text-xs text-muted-foreground">{relativeFromNow(notification.createdAt)}</p>
              </div>
            </div>
          );

          return (
            <li key={notification.id}>
              {notification.href ? (
                <Link
                  href={notification.href}
                  className="block px-5 py-3.5 transition-colors hover:bg-surface-muted"
                  onClick={() => {
                    if (unreadItem) void markNotificationReadAction(notification.id);
                  }}
                >
                  {body}
                </Link>
              ) : (
                <div className="px-5 py-3.5">{body}</div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
