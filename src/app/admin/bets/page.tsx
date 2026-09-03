import { EmptyState } from '@/components/ui/feedback';
import { Money } from '@/components/ui/money';
import { Pagination } from '@/components/ui/pagination';
import { PageHeader, StatCard } from '@/components/ui/stat-card';
import { BetStatusBadge } from '@/components/ui/status-badge';
import { Table, TableWrap, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { AdminFilterBar } from '@/features/admin/filter-bar';
import { formatDateTime } from '@/lib/datetime';
import { formatRate } from '@/lib/money';
import {
  readDateFrom,
  readDateTo,
  readEnum,
  readPage,
  readPageSize,
  readParam,
  type RawSearchParams,
} from '@/lib/search-params';
import { requirePermission } from '@/server/context';
import { getServices } from '@/services/container';
import { BET_STATUSES } from '@/types/domain';
import { statusLabels } from '@/components/ui/status-badge';

export default async function AdminBetsPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  await requirePermission('bet.view');
  const params = await searchParams;
  const services = getServices();

  const status = readEnum(params, 'status', BET_STATUSES);
  const search = readParam(params, 'q');
  const lotteryId = readParam(params, 'lottery');
  const from = readDateFrom(params);
  const to = readDateTo(params);

  const [bets, lotteries, totalStake, totalPayout] = await Promise.all([
    services.query.findBets({
      status,
      search,
      ...(lotteryId ? { lotteryId } : {}),
      ...(from ? { from } : {}),
      ...(to ? { to } : {}),
      page: readPage(params),
      pageSize: readPageSize(params),
    }),
    services.repos.lotteries.list({ includeInactive: true }),
    services.repos.bets.sumStake({}),
    services.repos.bets.sumPayout({}),
  ]);

  return (
    <div className="space-y-4">
      <PageHeader
        title="บิลแทงทั้งหมด"
        description="เลขและจำนวนเงินในบิลที่ยืนยันแล้วไม่สามารถแก้ไขได้ — ดูได้อย่างเดียว"
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="ยอดแทงสะสม" value={<Money value={totalStake} compact />} />
        <StatCard label="ยอดจ่ายรางวัลสะสม" value={<Money value={totalPayout} tone="prize" compact />} tone="gold" />
        <StatCard label="กำไรขั้นต้น" value={<Money value={totalStake - totalPayout} tone="auto" compact />} tone="emerald" />
      </div>

      <AdminFilterBar
        searchValue={search}
        searchPlaceholder="ค้นหาจาก bet id, อ้างอิง หรือ user id"
        selects={[
          {
            key: 'status',
            label: 'สถานะ',
            value: status === 'all' ? '' : status,
            options: BET_STATUSES.map((value) => ({ value, label: statusLabels.BET[value].label })),
          },
          {
            key: 'lottery',
            label: 'หวย',
            value: lotteryId,
            options: lotteries.map((lottery) => ({ value: lottery.id, label: lottery.nameTh })),
          },
        ]}
        dateKeys={{
          from: 'from',
          to: 'to',
          fromValue: readParam(params, 'from'),
          toValue: readParam(params, 'to'),
        }}
      />

      {bets.items.length === 0 ? (
        <div className="surface-card">
          <EmptyState title="ไม่พบบิลแทง" description="ลองปรับตัวกรองหรือช่วงวันที่" />
        </div>
      ) : (
        <div className="surface-card overflow-hidden">
          <ul className="divide-y divide-border">
            {bets.items.map((bet) => (
              <li key={bet.id} className="space-y-3 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">
                      {bet.reference}
                      <span className="ml-2 font-normal text-muted-foreground">{bet.username}</span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {bet.lotteryName} · งวด {bet.roundCode} · {formatDateTime(bet.createdAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <BetStatusBadge status={bet.status} />
                    <div className="text-right">
                      <Money value={bet.totalStake} className="block text-sm font-semibold" />
                      <span className="block text-xs text-muted-foreground">
                        เป็นไปได้ <Money value={bet.totalPotentialPayout} tone="muted" className="text-xs" />
                      </span>
                    </div>
                  </div>
                </div>

                <TableWrap>
                  <Table>
                    <THead>
                      <TR>
                        <TH>เลข</TH>
                        <TH>ประเภท</TH>
                        <TH align="right">เดิมพัน</TH>
                        <TH align="right">อัตรา ณ เวลาที่แทง</TH>
                        <TH align="right">รางวัลที่เป็นไปได้</TH>
                        <TH align="right">จ่ายจริง</TH>
                      </TR>
                    </THead>
                    <TBody>
                      {bet.items.map((item) => (
                        <TR key={item.id}>
                          <TD className="tabular font-semibold tracking-widest">{item.number}</TD>
                          <TD className="text-sm">{item.betTypeName}</TD>
                          <TD align="right">
                            <Money value={item.stake} className="text-sm" />
                          </TD>
                          <TD align="right" className="tabular text-sm text-accent">
                            x{formatRate(item.rateMilli)}
                          </TD>
                          <TD align="right">
                            <Money value={item.potentialPayout} tone="muted" className="text-sm" />
                          </TD>
                          <TD align="right">
                            {item.payout > 0 ? (
                              <Money value={item.payout} tone="prize" className="text-sm" />
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </TD>
                        </TR>
                      ))}
                    </TBody>
                  </Table>
                </TableWrap>
              </li>
            ))}
          </ul>
          <div className="px-4">
            <Pagination
              page={bets.page}
              pageCount={bets.pageCount}
              pageSize={bets.pageSize}
              total={bets.total}
            />
          </div>
        </div>
      )}
    </div>
  );
}
