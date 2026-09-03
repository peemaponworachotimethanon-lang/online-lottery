import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Money } from '@/components/ui/money';
import { UserStatusBadge } from '@/components/ui/status-badge';
import { ProfileForm } from '@/features/account/profile-form';
import { formatDate } from '@/lib/datetime';
import { ROLE_LABELS } from '@/lib/permissions';
import { maskAccountNumber } from '@/lib/utils';
import { requireUser } from '@/server/context';
import { getServices } from '@/services/container';

export default async function AccountProfilePage() {
  const user = await requireUser();
  const wallet = await getServices().wallet.getWallet(user.id);

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <CardTitle>ข้อมูลบัญชี</CardTitle>
          <CardDescription>ข้อมูลพื้นฐานของบัญชีคุณ</CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <dt className="text-xs text-muted-foreground">ชื่อผู้ใช้</dt>
              <dd className="tabular text-sm font-medium">{user.username}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">อีเมล</dt>
              <dd className="truncate text-sm font-medium">{user.email}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">เบอร์โทร</dt>
              <dd className="tabular text-sm font-medium">{user.phone}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">สถานะบัญชี</dt>
              <dd className="mt-0.5">
                <UserStatusBadge status={user.status} />
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">บทบาท</dt>
              <dd className="mt-0.5 flex flex-wrap gap-1">
                {user.roles.map((role) => (
                  <Badge key={role} variant="emerald">
                    {ROLE_LABELS[role]}
                  </Badge>
                ))}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">สมัครเมื่อ</dt>
              <dd className="tabular text-sm font-medium">{formatDate(user.createdAt)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">ยอดเงินคงเหลือ</dt>
              <dd className="text-sm">
                <Money value={wallet.balance} className="font-semibold" />
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">บัญชีธนาคาร</dt>
              <dd className="tabular text-sm font-medium">
                {maskAccountNumber(user.bankAccountNumber)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">เข้าสู่ระบบล่าสุด</dt>
              <dd className="tabular text-sm font-medium">
                {user.lastLoginAt ? formatDate(user.lastLoginAt) : '—'}
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>แก้ไขข้อมูลส่วนตัว</CardTitle>
          <CardDescription>ชื่อบัญชีธนาคารควรตรงกับชื่อเจ้าของบัญชี เพื่อให้อนุมัติการถอนได้</CardDescription>
        </CardHeader>
        <CardContent>
          <ProfileForm user={user} />
        </CardContent>
      </Card>
    </div>
  );
}
