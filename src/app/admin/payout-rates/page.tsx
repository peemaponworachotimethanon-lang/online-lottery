import { Badge } from '@/components/ui/badge';
import { EmptyState, InlineAlert } from '@/components/ui/feedback';
import { PageHeader } from '@/components/ui/stat-card';
import { Table, TableWrap, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { EditPayoutRateButton, PayoutRateFormDialog } from '@/features/admin/bet-type-form';
import { formatDateTime } from '@/lib/datetime';
import { requirePermission } from '@/server/context';
import { getServices } from '@/services/container';

export default async function AdminPayoutRatesPage() {
  await requirePermission('lottery.manage');
  const services = getServices();

  const [rates, betTypes, lotteries] = await Promise.all([
    services.query.listPayoutRates(),
    services.repos.betTypes.list({ includeInactive: true }),
    services.repos.lotteries.list({ includeInactive: true }),
  ]);

  const betTypeOptions = betTypes.map((betType) => ({ code: betType.code, nameTh: betType.nameTh }));
  const lotteryOptions = lotteries.map((lottery) => ({ id: lottery.id, nameTh: lottery.nameTh }));

  return (
    <div className="space-y-4">
      <PageHeader
        title="อัตราจ่าย"
        description="ตั้งค่าอัตราจ่ายกลาง หรือกำหนดเฉพาะรายหวย"
        actions={<PayoutRateFormDialog betTypes={betTypeOptions} lotteries={lotteryOptions} />}
      />

      <InlineAlert tone="info">
        อัตราจ่ายถูกเก็บเป็นจำนวนเต็ม (x1000) เพื่อรองรับทศนิยมโดยไม่ใช้เลขทศนิยมลอยตัว
        และบิลที่แทงไปแล้วจะยังใช้อัตราเดิมเสมอ (rateAtBet)
      </InlineAlert>

      {rates.length === 0 ? (
        <div className="surface-card">
          <EmptyState title="ยังไม่มีการตั้งค่าอัตราจ่าย" />
        </div>
      ) : (
        <div className="surface-card overflow-hidden">
          <TableWrap className="rounded-none border-0">
            <Table>
              <THead>
                <TR>
                  <TH>ประเภทการแทง</TH>
                  <TH>ขอบเขต</TH>
                  <TH align="right">อัตราจ่าย</TH>
                  <TH>สถานะ</TH>
                  <TH align="right">มีผลตั้งแต่</TH>
                  <TH align="right">จัดการ</TH>
                </TR>
              </THead>
              <TBody>
                {rates.map((rate) => (
                  <TR key={rate.id}>
                    <TD className="text-sm font-medium">{rate.betTypeName}</TD>
                    <TD className="text-sm text-muted-foreground">{rate.lotteryName}</TD>
                    <TD align="right">
                      <Badge variant="gold" className="tabular">
                        {rate.rateLabel}
                      </Badge>
                    </TD>
                    <TD>
                      <Badge variant={rate.isActive ? 'emerald' : 'neutral'}>
                        {rate.isActive ? 'ใช้งาน' : 'ปิด'}
                      </Badge>
                    </TD>
                    <TD align="right" className="tabular whitespace-nowrap text-xs text-muted-foreground">
                      {formatDateTime(rate.effectiveFrom)}
                    </TD>
                    <TD align="right">
                      <EditPayoutRateButton
                        betTypes={betTypeOptions}
                        lotteries={lotteryOptions}
                        label={rate.betTypeName}
                        initial={{
                          id: rate.id,
                          betTypeCode: rate.betTypeCode,
                          lotteryId: rate.lotteryId,
                          rateX: rate.rateMilli / 1000,
                          isActive: rate.isActive,
                        }}
                      />
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
