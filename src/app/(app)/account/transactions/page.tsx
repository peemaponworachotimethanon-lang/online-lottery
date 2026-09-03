import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/feedback';
import { Money } from '@/components/ui/money';
import { Pagination } from '@/components/ui/pagination';
import { TxStatusBadge, TxTypeBadge } from '@/components/ui/status-badge';
import { Table, TableWrap, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { formatDateTime } from '@/lib/datetime';
import { requireUser } from '@/server/context';
import { getServices } from '@/services/container';

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function AccountTransactionsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const user = await requireUser();
  const page = Number(params.page) || 1;
  const pageSize = Number(params.pageSize) || 20;

  const transactions = await getServices().query.findTransactions({
    userId: user.id,
    page,
    pageSize,
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>ประวัติธุรกรรม</CardTitle>
      </CardHeader>
      <CardContent className="px-0 pb-0">
        {transactions.items.length === 0 ? (
          <EmptyState title="ยังไม่มีธุรกรรม" />
        ) : (
          <>
            <TableWrap className="rounded-none border-0 border-t">
              <Table>
                <THead>
                  <TR>
                    <TH>ประเภท</TH>
                    <TH>รายละเอียด</TH>
                    <TH align="right">จำนวน</TH>
                    <TH align="right">ก่อน</TH>
                    <TH align="right">หลัง</TH>
                    <TH>สถานะ</TH>
                    <TH align="right">เวลา</TH>
                  </TR>
                </THead>
                <TBody>
                  {transactions.items.map((tx) => (
                    <TR key={tx.id}>
                      <TD>
                        <TxTypeBadge type={tx.type} />
                      </TD>
                      <TD className="max-w-72">
                        <span className="line-clamp-1 text-sm">{tx.description}</span>
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
                      <TD align="right" className="tabular whitespace-nowrap text-xs text-muted-foreground">
                        {formatDateTime(tx.createdAt)}
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </TableWrap>
            <div className="px-5">
              <Pagination
                page={transactions.page}
                pageCount={transactions.pageCount}
                pageSize={transactions.pageSize}
                total={transactions.total}
              />
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
