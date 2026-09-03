import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { NotificationList } from '@/features/account/notification-list';
import { requireUser } from '@/server/context';
import { getServices } from '@/services/container';

export default async function AccountNotificationsPage() {
  const user = await requireUser();
  const notifications = await getServices().notifications.list(user.id, 50);

  return (
    <Card>
      <CardHeader>
        <CardTitle>การแจ้งเตือน</CardTitle>
      </CardHeader>
      <CardContent className="px-0 pb-0">
        <NotificationList
          notifications={notifications.map((notification) => ({
            id: notification.id,
            type: notification.type,
            title: notification.title,
            body: notification.body,
            href: notification.href,
            readAt: notification.readAt,
            createdAt: notification.createdAt,
          }))}
        />
      </CardContent>
    </Card>
  );
}
