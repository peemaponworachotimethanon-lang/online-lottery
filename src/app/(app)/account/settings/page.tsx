import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PreferencesForm } from '@/features/account/security-settings';
import { appConfig } from '@/config/app';
import { requireUser } from '@/server/context';

export default async function AccountSettingsPage() {
  const user = await requireUser();

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <CardTitle>การตั้งค่าบัญชี</CardTitle>
          <CardDescription>ปรับการแจ้งเตือนและความปลอดภัยตามที่คุณต้องการ</CardDescription>
        </CardHeader>
        <CardContent>
          <PreferencesForm
            marketingOptIn={user.marketingOptIn}
            twoFactorEnabled={user.twoFactorEnabled}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>การแสดงผล</CardTitle>
          <CardDescription>เวลาและสกุลเงินที่ใช้แสดงผลในระบบ</CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-xs text-muted-foreground">โซนเวลาที่แสดง</dt>
              <dd className="text-sm font-medium">{appConfig.displayTimeZone}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">สกุลเงิน</dt>
              <dd className="text-sm font-medium">{appConfig.currency.code} (บาท)</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">โหมดการทำงาน</dt>
              <dd className="text-sm font-medium">{appConfig.mode === 'mock' ? 'สาธิต (mock)' : 'ใช้งานจริง'}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">ธีมสว่าง/มืด</dt>
              <dd className="text-sm text-muted-foreground">สลับได้จากปุ่มมุมขวาบน</dd>
            </div>
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}
