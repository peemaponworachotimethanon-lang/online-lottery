import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/feedback';
import { Money } from '@/components/ui/money';
import { Pagination } from '@/components/ui/pagination';
import { WithdrawalStatusBadge } from '@/components/ui/status-badge';
import { Table, TableWrap, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { formatDateTime } from '@/lib/datetime';
import { maskAccountNumber } from '@/lib/utils';
import { requireUser } from '@/server/context';
import { getServices } from '@/services/container';

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function AccountWithdrawalsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const user = await requireUser();
  const withdrawals = await getServices().query.findWithdrawals({
    userId: user.id,
    page: Number(params.page) || 1,
    pageSize: Number(params.pageSize) || 20,
  });

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>ประวัติการถอนเงิน</CardTitle>
        <Button asChild size="sm" variant="outline">
          <Link href="/wallet/withdraw">ถอนเงิน</Link>
        </Button>
      </CardHeader>
      <CardContent className="px-0 pb-0">
        {withdrawals.items.length === 0 ? (
          <EmptyState title="ยังไม่มีรายการถอนเงิน" />
        ) : (
          <>
            <TableWrap className="rounded-none border-0 border-t">
              <Table>
                <THead>
                  <TR>
                    <TH>อ้างอิง</TH>
                    <TH>ธนาคาร</TH>
                    <TH align="right">จำนวน</TH>
                    <TH>สถานะ</TH>
                    <TH>หมายเหตุ</TH>
                    <TH align="right">เวลา</TH>
                  </TR>
                </THead>
                <TBody>
                  {withdrawals.items.map((withdrawal) => (
                    <TR key={withdrawal.id}>
                      <TD className="tabular text-sm">{withdrawal.reference}</TD>
                      <TD className="text-sm">
                        {withdrawal.bankName}
                        <span className="tabular block text-xs text-muted-foreground">
                          {maskAccountNumber(withdrawal.bankAccountNumber)}
                        </span>
                      </TD>
                      <TD align="right">
                        <Money value={withdrawal.amount} className="text-sm" />
                      </TD>
                      <TD>
                        <WithdrawalStatusBadge status={withdrawal.status} />
                      </TD>
                      <TD className="max-w-48 text-xs text-muted-foreground">{withdrawal.note ?? '—'}</TD>
                      <TD align="right" className="tabular whitespace-nowrap text-xs text-muted-foreground">
                        {formatDateTime(withdrawal.createdAt)}
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </TableWrap>
            <div className="px-5">
              <Pagination
                page={withdrawals.page}
                pageCount={withdrawals.pageCount}
                pageSize={withdrawals.pageSize}
                total={withdrawals.total}
              />
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
