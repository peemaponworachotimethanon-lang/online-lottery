import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/feedback';
import { Money } from '@/components/ui/money';
import { PageHeader } from '@/components/ui/stat-card';
import { Table, TableWrap, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { BetTypeFormDialog, EditBetTypeButton } from '@/features/admin/bet-type-form';
import { satangToBaht } from '@/lib/money';
import { requirePermission } from '@/server/context';
import { getServices } from '@/services/container';

export default async function AdminBetTypesPage() {
  await requirePermission('lottery.manage');
  const betTypes = await getServices().repos.betTypes.list({ includeInactive: true });

  return (
    <div className="space-y-4">
      <PageHeader
        title="ประเภทการแทง"
        description="ประเภทการแทงเป็นข้อมูล ไม่ใช่โค้ด — เพิ่มประเภทใหม่ได้โดยไม่ต้องแก้หน้าเว็บ"
        actions={<BetTypeFormDialog />}
      />

      {betTypes.length === 0 ? (
        <div className="surface-card">
          <EmptyState title="ยังไม่มีประเภทการแทง" />
        </div>
      ) : (
        <div className="surface-card overflow-hidden">
          <TableWrap className="rounded-none border-0">
            <Table>
              <THead>
                <TR>
                  <TH>ชื่อ</TH>
                  <TH>รหัส</TH>
                  <TH align="center">หลัก</TH>
                  <TH>วิธีตัดสิน</TH>
                  <TH align="right">ขั้นต่ำ</TH>
                  <TH align="right">สูงสุด/รายการ</TH>
                  <TH align="right">สูงสุด/เลข/งวด</TH>
                  <TH>สถานะ</TH>
                  <TH align="right">จัดการ</TH>
                </TR>
              </THead>
              <TBody>
                {betTypes.map((betType) => (
                  <TR key={betType.id}>
                    <TD>
                      <span className="block text-sm font-medium">{betType.nameTh}</span>
                      <span className="block text-xs text-muted-foreground">{betType.name}</span>
                    </TD>
                    <TD className="tabular text-xs text-muted-foreground">{betType.code}</TD>
                    <TD align="center" className="tabular text-sm">
                      {betType.digitLength}
                    </TD>
                    <TD className="text-xs text-muted-foreground">{betType.matchStrategy}</TD>
                    <TD align="right">
                      <Money value={betType.minBet} compact className="text-sm" />
                    </TD>
                    <TD align="right">
                      <Money value={betType.maxBet} compact className="text-sm" />
                    </TD>
                    <TD align="right">
                      <Money value={betType.maxPerNumber} compact className="text-sm" />
                    </TD>
                    <TD>
                      <Badge variant={betType.isActive ? 'emerald' : 'neutral'}>
                        {betType.isActive ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}
                      </Badge>
                    </TD>
                    <TD align="right">
                      <EditBetTypeButton
                        initial={{
                          id: betType.id,
                          name: betType.name,
                          nameTh: betType.nameTh,
                          code: betType.code,
                          digitLength: betType.digitLength,
                          matchStrategy: betType.matchStrategy,
                          minBetBaht: satangToBaht(betType.minBet),
                          maxBetBaht: satangToBaht(betType.maxBet),
                          maxPerNumberBaht: satangToBaht(betType.maxPerNumber),
                          isActive: betType.isActive,
                          description: betType.description,
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
