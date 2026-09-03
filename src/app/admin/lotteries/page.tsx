import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/feedback';
import { PageHeader } from '@/components/ui/stat-card';
import { Table, TableWrap, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import {
  DeleteLotteryButton,
  EditLotteryButton,
  LotteryFormDialog,
} from '@/features/admin/lottery-form';
import { requirePermission } from '@/server/context';
import { getServices } from '@/services/container';

export default async function AdminLotteriesPage() {
  await requirePermission('lottery.manage');
  const services = getServices();

  const [lotteries, betTypes] = await Promise.all([
    services.repos.lotteries.list({ includeInactive: true }),
    services.repos.betTypes.list({ includeInactive: true }),
  ]);

  const betTypeOptions = betTypes.map((betType) => ({ code: betType.code, nameTh: betType.nameTh }));
  const betTypeName = new Map(betTypes.map((betType) => [betType.code, betType.nameTh]));

  return (
    <div className="space-y-4">
      <PageHeader
        title="จัดการหวย"
        description="เพิ่ม แก้ไข และเปิด–ปิดการใช้งานหวยแต่ละประเภท"
        actions={<LotteryFormDialog betTypes={betTypeOptions} />}
      />

      {lotteries.length === 0 ? (
        <div className="surface-card">
          <EmptyState title="ยังไม่มีหวยในระบบ" description="กดปุ่มเพิ่มหวยเพื่อเริ่มต้น" />
        </div>
      ) : (
        <div className="surface-card overflow-hidden">
          <TableWrap className="rounded-none border-0">
            <Table>
              <THead>
                <TR>
                  <TH>ชื่อ</TH>
                  <TH>Slug</TH>
                  <TH>ประเทศ / โซนเวลา</TH>
                  <TH>ประเภทการแทง</TH>
                  <TH>สถานะ</TH>
                  <TH align="right">จัดการ</TH>
                </TR>
              </THead>
              <TBody>
                {lotteries.map((lottery) => (
                  <TR key={lottery.id}>
                    <TD>
                      <span className="block text-sm font-medium">{lottery.nameTh}</span>
                      <span className="block text-xs text-muted-foreground">{lottery.name}</span>
                    </TD>
                    <TD className="tabular text-xs text-muted-foreground">{lottery.slug}</TD>
                    <TD className="text-sm">
                      {lottery.country}
                      <span className="block text-xs text-muted-foreground">{lottery.timezone}</span>
                    </TD>
                    <TD>
                      <div className="flex max-w-72 flex-wrap gap-1">
                        {lottery.betTypeCodes.map((code) => (
                          <Badge key={code} variant="neutral">
                            {betTypeName.get(code) ?? code}
                          </Badge>
                        ))}
                      </div>
                    </TD>
                    <TD>
                      <Badge variant={lottery.status === 'active' ? 'emerald' : 'neutral'}>
                        {lottery.status === 'active' ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}
                      </Badge>
                    </TD>
                    <TD align="right">
                      <div className="flex justify-end gap-0.5">
                        <EditLotteryButton
                          betTypes={betTypeOptions}
                          initial={{
                            id: lottery.id,
                            name: lottery.name,
                            nameTh: lottery.nameTh,
                            slug: lottery.slug,
                            country: lottery.country,
                            countryCode: lottery.countryCode,
                            timezone: lottery.timezone,
                            description: lottery.description,
                            status: lottery.status,
                            betTypeCodes: lottery.betTypeCodes,
                          }}
                        />
                        <DeleteLotteryButton id={lottery.id} name={lottery.nameTh} />
                      </div>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </TableWrap>
        </div>
      )}
    </div>
  );
}
