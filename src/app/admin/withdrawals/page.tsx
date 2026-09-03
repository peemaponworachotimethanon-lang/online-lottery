import { EmptyState } from '@/components/ui/feedback';
import { Money } from '@/components/ui/money';
import { Pagination } from '@/components/ui/pagination';
import { PageHeader, StatCard } from '@/components/ui/stat-card';
import { WithdrawalStatusBadge } from '@/components/ui/status-badge';
import { Table, TableWrap, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { AdminFilterBar } from '@/features/admin/filter-bar';
import { ReviewActions } from '@/features/admin/review-actions';
import { formatDateTime } from '@/lib/datetime';
import { can } from '@/lib/permissions';
import { maskAccountNumber } from '@/lib/utils';
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

const STATUSES = ['pending', 'approved', 'rejected', 'cancelled'] as const;

export default async function AdminWithdrawalsPage({
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

  const [withdrawals, pendingCount, approvedTotal] = await Promise.all([
    services.query.findWithdrawals({
      status,
      search,
      ...(from ? { from } : {}),
      ...(to ? { to } : {}),
      page: readPage(params),
      pageSize: readPageSize(params),
    }),
    services.repos.withdrawals.countByStatus('pending'),
    services.repos.withdrawals.sumAmount({ status: 'approved' }),
  ]);

  const canApprove = can({ id: actor.id, roles: actor.roles }, 'withdrawal.approve');

  return (
    <div className="space-y-4">
      <PageHeader
        title="จัดการการถอนเงิน"
        description="อนุมัติจะปลดวงเงินที่กันไว้ ปฏิเสธจะคืนเงินเข้ากระเป๋าผู้ใช้"
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="รอตรวจสอบ" value={pendingCount} tone={pendingCount > 0 ? 'warning' : 'default'} />
        <StatCard label="ยอดถอนที่อนุมัติสะสม" value={<Money value={approvedTotal} compact />} />
        <StatCard label="รายการทั้งหมด" value={withdrawals.total.toLocaleString('th-TH')} />
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
              { value: 'approved', label: 'อนุมัติแล้ว' },
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

      {withdrawals.items.length === 0 ? (
        <div className="surface-card">
          <EmptyState title="ไม่พบรายการถอนเงิน" description="ลองปรับตัวกรองหรือช่วงวันที่" />
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
                  <TH>บัญชีปลายทาง</TH>
                  <TH>สถานะ</TH>
                  <TH align="right">เวลา</TH>
                  <TH align="right">การจัดการ</TH>
                </TR>
              </THead>
              <TBody>
                {withdrawals.items.map((withdrawal) => (
                  <TR key={withdrawal.id}>
                    <TD className="tabular text-sm">{withdrawal.reference}</TD>
                    <TD className="text-sm">{withdrawal.username}</TD>
                    <TD align="right">
                      <Money value={withdrawal.amount} className="text-sm" />
                    </TD>
                    <TD className="text-sm">
                      {withdrawal.bankName}
                      <span className="tabular block text-xs text-muted-foreground">
                        {maskAccountNumber(withdrawal.bankAccountNumber)} · {withdrawal.bankAccountName}
                      </span>
                    </TD>
                    <TD>
                      <WithdrawalStatusBadge status={withdrawal.status} />
                    </TD>
                    <TD align="right" className="tabular whitespace-nowrap text-xs text-muted-foreground">
                      {formatDateTime(withdrawal.createdAt)}
                    </TD>
                    <TD align="right">
                      {withdrawal.status === 'pending' && canApprove ? (
                        <ReviewActions
                          kind="withdrawal"
                          id={withdrawal.id}
                          reference={withdrawal.reference}
                          amount={withdrawal.amount}
                        />
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          {withdrawal.note ??
                            (withdrawal.reviewedAt ? formatDateTime(withdrawal.reviewedAt) : '—')}
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
              page={withdrawals.page}
              pageCount={withdrawals.pageCount}
              pageSize={withdrawals.pageSize}
              total={withdrawals.total}
            />
          </div>
        </div>
      )}
    </div>
  );
}
