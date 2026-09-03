import { EmptyState } from '@/components/ui/feedback';
import { Pagination } from '@/components/ui/pagination';
import { PageHeader } from '@/components/ui/stat-card';
import { RawRoundStatusBadge, RoundStatusBadge } from '@/components/ui/status-badge';
import { Table, TableWrap, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { AdminFilterBar } from '@/features/admin/filter-bar';
import { EditRoundButton, RoundFormDialog } from '@/features/admin/round-form';
import { formatDateTime } from '@/lib/datetime';
import { displayRoundStatus } from '@/lib/lottery-rules';
import { readEnum, readPage, readPageSize, readParam, type RawSearchParams } from '@/lib/search-params';
import { requirePermission } from '@/server/context';
import { getServices } from '@/services/container';
import { ROUND_STATUSES } from '@/types/domain';
import { statusLabels } from '@/components/ui/status-badge';

export default async function AdminRoundsPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  await requirePermission('lottery.manage');
  const params = await searchParams;
  const services = getServices();
  const nowMs = Date.now();

  const status = readEnum(params, 'status', ROUND_STATUSES);
  const lotteryId = readParam(params, 'lottery');

  const [rounds, lotteries] = await Promise.all([
    services.repos.rounds.findMany({
      status,
      ...(lotteryId ? { lotteryId } : {}),
      page: readPage(params),
      pageSize: readPageSize(params),
    }),
    services.repos.lotteries.list({ includeInactive: true }),
  ]);

  const lotteryById = new Map(lotteries.map((lottery) => [lottery.id, lottery]));
  const lotteryOptions = lotteries.map((lottery) => ({ id: lottery.id, nameTh: lottery.nameTh }));

  return (
    <div className="space-y-4">
      <PageHeader
        title="จัดการงวด"
        description="สถานะที่แสดงคำนวณจากเวลาเซิร์ฟเวอร์ ไม่ใช่ค่าที่บันทึกไว้เพียงอย่างเดียว"
        actions={<RoundFormDialog lotteries={lotteryOptions} />}
      />

      <AdminFilterBar
        searchKey="q"
        searchPlaceholder="ค้นหารหัสงวด"
        selects={[
          {
            key: 'status',
            label: 'สถานะที่บันทึกไว้',
            value: status === 'all' ? '' : status,
            options: ROUND_STATUSES.map((value) => ({
              value,
              label: statusLabels.ROUND[value].label,
            })),
          },
          {
            key: 'lottery',
            label: 'หวย',
            value: lotteryId,
            options: lotteryOptions.map((lottery) => ({ value: lottery.id, label: lottery.nameTh })),
          },
        ]}
      />

      {rounds.items.length === 0 ? (
        <div className="surface-card">
          <EmptyState title="ไม่พบงวด" description="ลองปรับตัวกรอง หรือสร้างงวดใหม่" />
        </div>
      ) : (
        <div className="surface-card overflow-hidden">
          <TableWrap className="rounded-none border-0">
            <Table>
              <THead>
                <TR>
                  <TH>รหัสงวด</TH>
                  <TH>หวย</TH>
                  <TH align="right">เปิดรับ</TH>
                  <TH align="right">ปิดรับ</TH>
                  <TH align="right">ออกผล</TH>
                  <TH>สถานะที่บันทึก</TH>
                  <TH>สถานะตามเวลาจริง</TH>
                  <TH align="right">จัดการ</TH>
                </TR>
              </THead>
              <TBody>
                {rounds.items.map((round) => (
                  <TR key={round.id}>
                    <TD className="tabular text-xs">{round.roundCode}</TD>
                    <TD className="text-sm">{lotteryById.get(round.lotteryId)?.nameTh ?? '—'}</TD>
                    <TD align="right" className="tabular whitespace-nowrap text-xs">
                      {formatDateTime(round.openAt)}
                    </TD>
                    <TD align="right" className="tabular whitespace-nowrap text-xs">
                      {formatDateTime(round.closeAt)}
                    </TD>
                    <TD align="right" className="tabular whitespace-nowrap text-xs">
                      {formatDateTime(round.resultAt)}
                    </TD>
                    <TD>
                      <RawRoundStatusBadge status={round.status} />
                    </TD>
                    <TD>
                      <RoundStatusBadge status={displayRoundStatus(round, nowMs)} />
                    </TD>
                    <TD align="right">
                      <EditRoundButton
                        lotteries={lotteryOptions}
                        initial={{
                          id: round.id,
                          lotteryId: round.lotteryId,
                          roundCode: round.roundCode,
                          openAt: round.openAt,
                          closeAt: round.closeAt,
                          resultAt: round.resultAt,
                          status: round.status,
                        }}
                      />
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </TableWrap>
          <div className="px-4">
            <Pagination
              page={rounds.page}
              pageCount={rounds.pageCount}
              pageSize={rounds.pageSize}
              total={rounds.total}
            />
          </div>
        </div>
      )}
    </div>
  );
}
