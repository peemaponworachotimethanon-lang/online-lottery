import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { InlineAlert } from '@/components/ui/feedback';
import { PageHeader } from '@/components/ui/stat-card';
import { Table, TableWrap, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { appConfig } from '@/config/app';
import { brand } from '@/config/brand';
import { PERMISSIONS, ROLES } from '@/types/domain';
import { ROLE_LABELS, ROLE_PERMISSIONS } from '@/lib/permissions';
import { RATE_LIMITS } from '@/providers/rate-limit';
import { cacheKeys, cacheTtl } from '@/providers/cache';
import { requireStaff } from '@/server/context';

export default async function AdminSettingsPage() {
  await requireStaff();

  return (
    <div className="space-y-5">
      <PageHeader
        title="ตั้งค่าระบบ"
        description="ค่าคอนฟิกที่กำหนดพฤติกรรมของระบบ · แก้ไขได้ผ่านไฟล์คอนฟิกและตัวแปรสภาพแวดล้อม"
      />

      <InlineAlert tone="warning">
        ระบบทำงานในโหมด <strong>{appConfig.mode}</strong> — ข้อมูลทั้งหมดเป็นข้อมูลจำลอง
        และเก็บอยู่ในหน่วยความจำของอินสแตนซ์ ไม่ได้เชื่อมต่อฐานข้อมูลจริง
      </InlineAlert>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>ค่าพื้นฐาน</CardTitle>
            <CardDescription>กำหนดที่ src/config</CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <dt className="text-muted-foreground">ชื่อระบบ (ชั่วคราว)</dt>
              <dd className="font-medium">{brand.name}</dd>
              <dt className="text-muted-foreground">ธีม</dt>
              <dd className="font-medium">
                {brand.themeName} · {brand.themeConceptTh}
              </dd>
              <dt className="text-muted-foreground">โหมด</dt>
              <dd className="font-medium">{appConfig.mode}</dd>
              <dt className="text-muted-foreground">โซนเวลาแสดงผล</dt>
              <dd className="font-medium">{appConfig.displayTimeZone}</dd>
              <dt className="text-muted-foreground">สกุลเงิน</dt>
              <dd className="font-medium">
                {appConfig.currency.code} · เก็บเป็นสตางค์ (จำนวนเต็ม)
              </dd>
              <dt className="text-muted-foreground">อายุ session</dt>
              <dd className="tabular font-medium">{appConfig.session.maxAge / 3600} ชั่วโมง</dd>
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Rate limit</CardTitle>
            <CardDescription>
              ค่าเหล่านี้เป็นแบบต่ออินสแตนซ์ในโหมดสาธิต — production ต้องใช้ Redis
            </CardDescription>
          </CardHeader>
          <CardContent className="px-0 pb-0">
            <TableWrap className="rounded-none border-0 border-t">
              <Table>
                <THead>
                  <TR>
                    <TH>การกระทำ</TH>
                    <TH align="right">จำนวนครั้ง</TH>
                    <TH align="right">ต่อช่วงเวลา</TH>
                  </TR>
                </THead>
                <TBody>
                  {Object.entries(RATE_LIMITS).map(([name, rule]) => (
                    <TR key={name}>
                      <TD className="tabular text-sm">{name}</TD>
                      <TD align="right" className="tabular text-sm">
                        {rule.limit}
                      </TD>
                      <TD align="right" className="tabular text-sm text-muted-foreground">
                        {rule.windowSeconds}s
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </TableWrap>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>บทบาทและสิทธิ์</CardTitle>
          <CardDescription>
            สิทธิ์ถูกบังคับใช้ที่ฝั่งเซิร์ฟเวอร์ทุกครั้ง ไม่ได้พึ่งการซ่อนปุ่มบน UI
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          <TableWrap className="rounded-none border-0 border-t">
            <Table>
              <THead>
                <TR>
                  <TH>สิทธิ์</TH>
                  {ROLES.map((role) => (
                    <TH key={role} align="center">
                      {ROLE_LABELS[role]}
                    </TH>
                  ))}
                </TR>
              </THead>
              <TBody>
                {PERMISSIONS.map((permission) => (
                  <TR key={permission}>
                    <TD className="tabular text-xs">{permission}</TD>
                    {ROLES.map((role) => (
                      <TD key={role} align="center">
                        {ROLE_PERMISSIONS[role].includes(permission) ? (
                          <Badge variant="emerald">✓</Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TD>
                    ))}
                  </TR>
                ))}
              </TBody>
            </Table>
          </TableWrap>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>แคช</CardTitle>
          <CardDescription>
            แคชเฉพาะข้อมูลสาธารณะที่สร้างใหม่ได้ · ยอดเงินและบัญชีไม่เคยอ่านจากแคช
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          <TableWrap className="rounded-none border-0 border-t">
            <Table>
              <THead>
                <TR>
                  <TH>คีย์</TH>
                  <TH align="right">TTL</TH>
                </TR>
              </THead>
              <TBody>
                <TR>
                  <TD className="tabular text-xs">{cacheKeys.lotteryList}</TD>
                  <TD align="right" className="tabular text-sm">
                    {cacheTtl.lotteryList}s
                  </TD>
                </TR>
                <TR>
                  <TD className="tabular text-xs">lottery:&#123;id&#125;:round:current:v1</TD>
                  <TD align="right" className="tabular text-sm">
                    {cacheTtl.currentRound}s
                  </TD>
                </TR>
                <TR>
                  <TD className="tabular text-xs">lottery:&#123;id&#125;:rates:v1</TD>
                  <TD align="right" className="tabular text-sm">
                    {cacheTtl.rates}s
                  </TD>
                </TR>
                <TR>
                  <TD className="tabular text-xs">{cacheKeys.latestResults}</TD>
                  <TD align="right" className="tabular text-sm">
                    {cacheTtl.latestResults}s
                  </TD>
                </TR>
              </TBody>
            </Table>
          </TableWrap>
        </CardContent>
      </Card>
    </div>
  );
}
