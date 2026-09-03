import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/feedback';
import { Money } from '@/components/ui/money';
import { Pagination } from '@/components/ui/pagination';
import { DepositStatusBadge } from '@/components/ui/status-badge';
import { Table, TableWrap, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { formatDateTime } from '@/lib/datetime';
import { requireUser } from '@/server/context';
import { getServices } from '@/services/container';

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function AccountDepositsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const user = await requireUser();
  const deposits = await getServices().query.findDeposits({
    userId: user.id,
    page: Number(params.page) || 1,
    pageSize: Number(params.pageSize) || 20,
  });

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>ประวัติการฝากเงิน</CardTitle>
        <Button asChild size="sm">
          <Link href="/wallet/deposit">ฝากเงิน</Link>
        </Button>
      </CardHeader>
      <CardContent className="px-0 pb-0">
        {deposits.items.length === 0 ? (
          <EmptyState title="ยังไม่มีรายการฝากเงิน" description="เริ่มต้นด้วยการฝากเงินเข้ากระเป๋า" />
        ) : (
          <>
            <TableWrap className="rounded-none border-0 border-t">
              <Table>
                <THead>
                  <TR>
                    <TH>อ้างอิง</TH>
                    <TH>ช่องทาง</TH>
                    <TH align="right">จำนวน</TH>
                    <TH>สถานะ</TH>
                    <TH align="right">เวลา</TH>
                  </TR>
                </THead>
                <TBody>
                  {deposits.items.map((deposit) => (
                    <TR key={deposit.id}>
                      <TD className="tabular text-sm">{deposit.reference}</TD>
                      <TD className="text-sm">{deposit.method}</TD>
                      <TD align="right">
                        <Money value={deposit.amount} className="text-sm" />
                      </TD>
                      <TD>
                        <DepositStatusBadge status={deposit.status} />
                      </TD>
                      <TD align="right" className="tabular whitespace-nowrap text-xs text-muted-foreground">
                        {formatDateTime(deposit.createdAt)}
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </TableWrap>
            <div className="px-5">
              <Pagination
                page={deposits.page}
                pageCount={deposits.pageCount}
                pageSize={deposits.pageSize}
                total={deposits.total}
              />
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
