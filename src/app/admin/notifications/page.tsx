import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/feedback';
import { PageHeader } from '@/components/ui/stat-card';
import { Badge } from '@/components/ui/badge';
import { Table, TableWrap, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { BroadcastForm } from '@/features/admin/broadcast-form';
import { formatDateTime } from '@/lib/datetime';
import { can } from '@/lib/permissions';
import { requireStaff } from '@/server/context';
import { getServices } from '@/services/container';
import { getQueue } from '@/providers/queue';

export default async function AdminNotificationsPage() {
  const actor = await requireStaff();
  const services = getServices();

  const users = await services.repos.users.findMany({ page: 1, pageSize: 5, status: 'active' });
  const recent = users.items.length > 0 && users.items[0]
    ? await services.notifications.list(users.items[0].id, 10)
    : [];
  const jobs = getQueue().list(10);

  return (
    <div className="space-y-5">
      <PageHeader
        title="การแจ้งเตือน"
        description="ส่งประกาศถึงผู้ใช้ทั้งหมด — งานจะถูกส่งเข้าคิวเบื้องหลัง ไม่รันใน request"
      />

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>ส่งประกาศ</CardTitle>
            <CardDescription>ข้อความจะไปถึงผู้ใช้ที่มีสถานะใช้งานปกติ</CardDescription>
          </CardHeader>
          <CardContent>
            <BroadcastForm canSend={can({ id: actor.id, roles: actor.roles }, 'settings.manage')} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>งานเบื้องหลังล่าสุด</CardTitle>
            <CardDescription>คิวจำลองในโหมดสาธิต · production ใช้ BullMQ + Redis</CardDescription>
          </CardHeader>
          <CardContent className="px-0 pb-0">
            {jobs.length === 0 ? (
              <EmptyState title="ยังไม่มีงานในคิว" />
            ) : (
              <TableWrap className="rounded-none border-0 border-t">
                <Table>
                  <THead>
                    <TR>
                      <TH>งาน</TH>
                      <TH>สถานะ</TH>
                      <TH align="right">เวลา</TH>
                    </TR>
                  </THead>
                  <TBody>
                    {jobs.map((job) => (
                      <TR key={job.id}>
                        <TD className="tabular text-xs">{job.name}</TD>
                        <TD>
                          <Badge
                            variant={
                              job.status === 'completed'
                                ? 'emerald'
                                : job.status === 'failed'
                                  ? 'danger'
                                  : 'neutral'
                            }
                          >
                            {job.status}
                          </Badge>
                        </TD>
                        <TD align="right" className="tabular whitespace-nowrap text-xs text-muted-foreground">
                          {formatDateTime(job.enqueuedAt)}
                        </TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              </TableWrap>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>ตัวอย่างการแจ้งเตือนของผู้ใช้</CardTitle>
          <CardDescription>
            แสดงการแจ้งเตือนล่าสุดของผู้ใช้รายหนึ่ง เพื่อตรวจสอบรูปแบบข้อความ
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          {recent.length === 0 ? (
            <EmptyState title="ยังไม่มีการแจ้งเตือน" />
          ) : (
            <ul className="divide-y divide-border border-t border-border">
              {recent.map((notification) => (
                <li key={notification.id} className="px-5 py-3">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium">{notification.title}</p>
                    <Badge variant="neutral">{notification.type}</Badge>
                    {notification.readAt === null ? <Badge variant="emerald">ยังไม่อ่าน</Badge> : null}
                  </div>
                  <p className="text-sm text-muted-foreground">{notification.body}</p>
                  <p className="tabular text-xs text-muted-foreground">
                    {formatDateTime(notification.createdAt)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
