import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/feedback';
import { Badge } from '@/components/ui/badge';
import { Table, TableWrap, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { ChangePasswordForm } from '@/features/account/security-settings';
import { formatDateTime } from '@/lib/datetime';
import { requireUser } from '@/server/context';
import { getServices } from '@/services/container';

export default async function AccountSecurityPage() {
  const user = await requireUser();
  const loginEvents = await getServices().repos.loginEvents.listByUser(user.id, 15);

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <CardTitle>เปลี่ยนรหัสผ่าน</CardTitle>
          <CardDescription>ใช้รหัสผ่านที่มีตัวพิมพ์ใหญ่ พิมพ์เล็ก และตัวเลข อย่างน้อย 8 ตัวอักษร</CardDescription>
        </CardHeader>
        <CardContent>
          <ChangePasswordForm />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>ประวัติการเข้าสู่ระบบ</CardTitle>
          <CardDescription>ตรวจสอบว่ามีการเข้าใช้งานที่คุณไม่รู้จักหรือไม่</CardDescription>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          {loginEvents.length === 0 ? (
            <EmptyState title="ยังไม่มีประวัติการเข้าสู่ระบบ" />
          ) : (
            <TableWrap className="rounded-none border-0 border-t">
              <Table>
                <THead>
                  <TR>
                    <TH>เวลา</TH>
                    <TH>IP</TH>
                    <TH>อุปกรณ์</TH>
                    <TH align="right">ผลลัพธ์</TH>
                  </TR>
                </THead>
                <TBody>
                  {loginEvents.map((event) => (
                    <TR key={event.id}>
                      <TD className="tabular whitespace-nowrap text-sm">
                        {formatDateTime(event.createdAt)}
                      </TD>
                      <TD className="tabular text-sm">{event.ip}</TD>
                      <TD className="max-w-64">
                        <span className="line-clamp-1 text-xs text-muted-foreground">{event.userAgent}</span>
                      </TD>
                      <TD align="right">
                        <Badge variant={event.success ? 'emerald' : 'danger'}>
                          {event.success ? 'สำเร็จ' : 'ล้มเหลว'}
                        </Badge>
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
  );
}
