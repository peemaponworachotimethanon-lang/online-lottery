import { EmptyState } from '@/components/ui/feedback';
import { Money } from '@/components/ui/money';
import { Pagination } from '@/components/ui/pagination';
import { PageHeader } from '@/components/ui/stat-card';
import { TxStatusBadge, TxTypeBadge } from '@/components/ui/status-badge';
import { Table, TableWrap, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { AdminFilterBar } from '@/features/admin/filter-bar';
import { formatDateTime } from '@/lib/datetime';
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
import { WALLET_TX_STATUSES, WALLET_TX_TYPES } from '@/types/domain';
import { statusLabels } from '@/components/ui/status-badge';

export default async function AdminTransactionsPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  await requirePermission('wallet.view');
  const params = await searchParams;

  const type = readEnum(params, 'type', WALLET_TX_TYPES);
  const status = readEnum(params, 'status', WALLET_TX_STATUSES);
  const search = readParam(params, 'q');
  const from = readDateFrom(params);
  const to = readDateTo(params);

  // Server-side pagination: only the requested page ever crosses the network.
  const transactions = await getServices().query.findTransactions({
    type,
    status,
    search,
    ...(from ? { from } : {}),
    ...(to ? { to } : {}),
    page: readPage(params),
    pageSize: readPageSize(params),
  });

  return (
    <div className="space-y-4">
      <PageHeader
        title="ธุรกรรมทั้งระบบ"
        description={`${transactions.total.toLocaleString('th-TH')} รายการ · แบ่งหน้าฝั่งเซิร์ฟเวอร์`}
      />

      <AdminFilterBar
        searchValue={search}
        searchPlaceholder="ค้นหาจาก transaction id, user id หรือรายละเอียด"
        selects={[
          {
            key: 'type',
            label: 'ประเภท',
            value: type === 'all' ? '' : type,
            options: WALLET_TX_TYPES.map((value) => ({
              value,
              label: statusLabels.TX_TYPE[value].label,
            })),
          },
          {
            key: 'status',
            label: 'สถานะ',
            value: status === 'all' ? '' : status,
            options: WALLET_TX_STATUSES.map((value) => ({
              value,
              label: statusLabels.TX_STATUS[value].label,
            })),
          },
        ]}
        dateKeys={{
          from: 'from',
          to: 'to',
          fromValue: readParam(params, 'from'),
          toValue: readParam(params, 'to'),
        }}
      />

      {transactions.items.length === 0 ? (
        <div className="surface-card">
          <EmptyState title="ไม่พบธุรกรรม" description="ลองปรับตัวกรองหรือช่วงวันที่" />
        </div>
      ) : (
        <div className="surface-card overflow-hidden">
          <TableWrap className="rounded-none border-0">
            <Table>
              <THead>
                <TR>
                  <TH>Transaction ID</TH>
                  <TH>ผู้ใช้</TH>
                  <TH>ประเภท</TH>
                  <TH align="right">จำนวน</TH>
                  <TH align="right">ยอดก่อน</TH>
                  <TH align="right">ยอดหลัง</TH>
                  <TH>สถานะ</TH>
                  <TH>อ้างอิง</TH>
                  <TH align="right">เวลา</TH>
                </TR>
              </THead>
              <TBody>
                {transactions.items.map((tx) => (
                  <TR key={tx.id}>
                    <TD className="tabular text-xs">{tx.id}</TD>
                    <TD className="text-sm">{tx.username}</TD>
                    <TD>
                      <TxTypeBadge type={tx.type} />
                    </TD>
                    <TD align="right">
                      <Money value={tx.amount} tone="auto" signed className="text-sm" />
                    </TD>
                    <TD align="right">
                      <Money value={tx.balanceBefore} tone="muted" className="text-sm" />
                    </TD>
                    <TD align="right">
                      <Money value={tx.balanceAfter} className="text-sm" />
                    </TD>
                    <TD>
                      <TxStatusBadge status={tx.status} />
                    </TD>
                    <TD className="tabular max-w-40 truncate text-xs text-muted-foreground">
                      {tx.referenceId ?? '—'}
                    </TD>
                    <TD align="right" className="tabular whitespace-nowrap text-xs text-muted-foreground">
                      {formatDateTime(tx.createdAt)}
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </TableWrap>
          <div className="px-4">
            <Pagination
              page={transactions.page}
              pageCount={transactions.pageCount}
              pageSize={transactions.pageSize}
              total={transactions.total}
            />
          </div>
        </div>
      )}
    </div>
  );
}
