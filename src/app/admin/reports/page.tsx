import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Money } from '@/components/ui/money';
import { PageHeader, StatCard } from '@/components/ui/stat-card';
import { Table, TableWrap, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { AdminDailyChart, TopLotteriesChart } from '@/components/charts/lazy';
import { requirePermission } from '@/server/context';
import { getServices } from '@/services/container';

export default async function AdminReportsPage() {
  await requirePermission('report.view');
  const report = await getServices().reporting.operationalReport(14);

  return (
    <div className="space-y-5">
      <PageHeader
        title="รายงานการดำเนินงาน"
        description={`ย้อนหลัง ${report.days} วัน · สร้างเมื่อ ${report.generatedAt}`}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard label="ยอดแทงรวม" value={<Money value={report.totals.betVolume} compact />} />
        <StatCard label="ยอดฝากรวม" value={<Money value={report.totals.deposits} compact />} tone="emerald" />
        <StatCard label="ยอดถอนรวม" value={<Money value={report.totals.withdrawals} compact />} tone="warning" />
        <StatCard label="ยอดจ่ายรางวัล" value={<Money value={report.payout} tone="prize" compact />} tone="gold" />
        <StatCard
          label="กำไรขั้นต้น"
          value={<Money value={report.grossMargin} tone="auto" compact />}
          hint="ยอดแทง − ยอดจ่ายรางวัล"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>แนวโน้มรายวัน</CardTitle>
        </CardHeader>
        <CardContent>
          <AdminDailyChart data={report.daily} />
        </CardContent>
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>หวยที่มียอดแทงสูงสุด</CardTitle>
          </CardHeader>
          <CardContent>
            <TopLotteriesChart data={report.topLotteries} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>ตารางสรุปรายวัน</CardTitle>
          </CardHeader>
          <CardContent className="px-0 pb-0">
            <TableWrap className="rounded-none border-0 border-t">
              <Table>
                <THead>
                  <TR>
                    <TH>วันที่</TH>
                    <TH align="right">ยอดแทง</TH>
                    <TH align="right">ฝาก</TH>
                    <TH align="right">ถอน</TH>
                    <TH align="right">สมัครใหม่</TH>
                  </TR>
                </THead>
                <TBody>
                  {report.daily.map((day) => (
                    <TR key={day.date}>
                      <TD className="tabular text-sm">{day.date}</TD>
                      <TD align="right">
                        <Money value={day.betVolume} compact className="text-sm" />
                      </TD>
                      <TD align="right">
                        <Money value={day.deposits} compact className="text-sm" />
                      </TD>
                      <TD align="right">
                        <Money value={day.withdrawals} compact className="text-sm" />
                      </TD>
                      <TD align="right" className="tabular text-sm">
                        {day.newUsers}
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </TableWrap>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
