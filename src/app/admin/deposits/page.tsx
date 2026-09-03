import { EmptyState } from '@/components/ui/feedback';
import { Money } from '@/components/ui/money';
import { Pagination } from '@/components/ui/pagination';
import { PageHeader, StatCard } from '@/components/ui/stat-card';
import { DepositStatusBadge } from '@/components/ui/status-badge';
import { Table, TableWrap, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { AdminFilterBar } from '@/features/admin/filter-bar';
import { ReviewActions } from '@/features/admin/review-actions';
import { formatDateTime } from '@/lib/datetime';
import { can } from '@/lib/permissions';
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

const STATUSES = ['pending', 'completed', 'rejected', 'cancelled'] as const;

export default async function AdminDepositsPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const actor = await requirePermission('wallet.view');
  const params = await searchParams;
  const services = getServices();

  const status = readEnum(params, 'status', STATUSES);
  const search = readParam(params, 'q');
  const from = readDateFrom(params);
  const to = readDateTo(params);

  const [deposits, pendingCount, todayTotal] = await Promise.all([
    services.query.findDeposits({
      status,
      search,
      ...(from ? { from } : {}),
      ...(to ? { to } : {}),
      page: readPage(params),
      pageSize: readPageSize(params),
    }),
    services.repos.deposits.countByStatus('pending'),
    services.repos.deposits.sumAmount({ status: 'completed' }),
  ]);

  const canApprove = can({ id: actor.id, roles: actor.roles }, 'deposit.approve');

  return (
    <div className="space-y-4">
      <PageHeader title="จัดการการฝากเงิน" description="ตรวจสอบและอนุมัติรายการฝากเงินของผู้ใช้" />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="รอตรวจสอบ" value={pendingCount} tone={pendingCount > 0 ? 'warning' : 'default'} />
        <StatCard label="ยอดฝากสำเร็จสะสม" value={<Money value={todayTotal} compact />} tone="emerald" />
        <StatCard label="รายการทั้งหมด" value={deposits.total.toLocaleString('th-TH')} />
      </div>

      <AdminFilterBar
        searchValue={search}
        searchPlaceholder="ค้นหาจากอ้างอิงหรือ user id"
        selects={[
          {
            key: 'status',
            label: 'สถานะ',
            value: status === 'all' ? '' : status,
            options: [
              { value: 'pending', label: 'รอตรวจสอบ' },
              { value: 'completed', label: 'สำเร็จ' },
              { value: 'rejected', label: 'ปฏิเสธ' },
              { value: 'cancelled', label: 'ยกเลิก' },
            ],
          },
        ]}
        dateKeys={{
          from: 'from',
          to: 'to',
          fromValue: readParam(params, 'from'),
          toValue: readParam(params, 'to'),
        }}
      />

      {deposits.items.length === 0 ? (
        <div className="surface-card">
          <EmptyState title="ไม่พบรายการฝากเงิน" description="ลองปรับตัวกรองหรือช่วงวันที่" />
        </div>
      ) : (
        <div className="surface-card overflow-hidden">
          <TableWrap className="rounded-none border-0">
            <Table>
              <THead>
                <TR>
                  <TH>อ้างอิง</TH>
                  <TH>ผู้ใช้</TH>
                  <TH align="right">จำนวน</TH>
                  <TH>ช่องทาง</TH>
                  <TH>สถานะ</TH>
                  <TH align="right">เวลา</TH>
                  <TH align="right">การจัดการ</TH>
                </TR>
              </THead>
              <TBody>
                {deposits.items.map((deposit) => (
                  <TR key={deposit.id}>
                    <TD className="tabular text-sm">{deposit.reference}</TD>
                    <TD className="text-sm">{deposit.username}</TD>
                    <TD align="right">
                      <Money value={deposit.amount} className="text-sm" />
                    </TD>
                    <TD className="text-sm">{deposit.method}</TD>
                    <TD>
                      <DepositStatusBadge status={deposit.status} />
                    </TD>
                    <TD align="right" className="tabular whitespace-nowrap text-xs text-muted-foreground">
                      {formatDateTime(deposit.createdAt)}
                    </TD>
                    <TD align="right">
                      {deposit.status === 'pending' && canApprove ? (
                        <ReviewActions
                          kind="deposit"
                          id={deposit.id}
                          reference={deposit.reference}
                          amount={deposit.amount}
                        />
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          {deposit.note ?? (deposit.reviewedAt ? formatDateTime(deposit.reviewedAt) : '—')}
                        </span>
                      )}
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </TableWrap>
          <div className="px-4">
            <Pagination
              page={deposits.page}
              pageCount={deposits.pageCount}
              pageSize={deposits.pageSize}
              total={deposits.total}
            />
          </div>
        </div>
      )}
    </div>
  );
}
