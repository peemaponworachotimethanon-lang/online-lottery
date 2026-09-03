import Link from 'next/link';
import { ArrowDownToLine, ArrowUpFromLine, Wallet as WalletIcon, Lock, Receipt } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/feedback';
import { Money } from '@/components/ui/money';
import { PageHeader, StatCard } from '@/components/ui/stat-card';
import { DepositStatusBadge, TxTypeBadge, WithdrawalStatusBadge } from '@/components/ui/status-badge';
import { Table, TableWrap, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { formatDateTime } from '@/lib/datetime';
import { requireUser } from '@/server/context';
import { getServices } from '@/services/container';

export default async function WalletPage() {
  const user = await requireUser();
  const services = getServices();

  const [wallet, transactions, deposits, withdrawals] = await Promise.all([
    services.wallet.getWallet(user.id),
    services.query.findTransactions({ userId: user.id, page: 1, pageSize: 8 }),
    services.query.findDeposits({ userId: user.id, page: 1, pageSize: 5 }),
    services.query.findWithdrawals({ userId: user.id, page: 1, pageSize: 5 }),
  ]);

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-6 sm:px-6">
      <PageHeader
        title="กระเป๋าเงิน"
        description="ยอดเงิน การฝาก–ถอน และประวัติธุรกรรมทั้งหมด"
        actions={
          <>
            <Button asChild>
              <Link href="/wallet/deposit">
                <ArrowDownToLine /> ฝากเงิน
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/wallet/withdraw">
                <ArrowUpFromLine /> ถอนเงิน
              </Link>
            </Button>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="ยอดที่ใช้ได้"
          value={<Money value={wallet.balance} />}
          icon={<WalletIcon />}
          tone="emerald"
        />
        <StatCard
          label="กันไว้สำหรับการถอน"
          value={<Money value={wallet.held} tone="muted" />}
          hint="ยังเป็นเงินของคุณ แต่ใช้แทงไม่ได้"
          icon={<Lock />}
          tone="warning"
        />
        <StatCard
          label="ยอดรวมทั้งหมด"
          value={<Money value={wallet.balance + wallet.held} />}
          icon={<Receipt />}
        />
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>ธุรกรรมล่าสุด</CardTitle>
          <Button asChild variant="ghost" size="sm">
            <Link href="/account/transactions">ดูทั้งหมด</Link>
          </Button>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          {transactions.items.length === 0 ? (
            <EmptyState title="ยังไม่มีธุรกรรม" description="เริ่มต้นด้วยการฝากเงินเข้ากระเป๋า" />
          ) : (
            <TableWrap className="rounded-none border-0 border-t">
              <Table>
                <THead>
                  <TR>
                    <TH>ประเภท</TH>
                    <TH>รายละเอียด</TH>
                    <TH align="right">จำนวน</TH>
                    <TH align="right">คงเหลือ</TH>
                    <TH align="right">เวลา</TH>
                  </TR>
                </THead>
                <TBody>
                  {transactions.items.map((tx) => (
                    <TR key={tx.id}>
                      <TD>
                        <TxTypeBadge type={tx.type} />
                      </TD>
                      <TD className="max-w-64">
                        <span className="line-clamp-1 text-sm">{tx.description}</span>
                      </TD>
                      <TD align="right">
                        <Money value={tx.amount} tone="auto" signed className="text-sm" />
                      </TD>
                      <TD align="right">
                        <Money value={tx.balanceAfter} tone="muted" className="text-sm" />
                      </TD>
                      <TD align="right" className="tabular whitespace-nowrap text-xs text-muted-foreground">
                        {formatDateTime(tx.createdAt)}
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </TableWrap>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>การฝากเงินล่าสุด</CardTitle>
            <Button asChild variant="ghost" size="sm">
              <Link href="/account/deposits">ดูทั้งหมด</Link>
            </Button>
          </CardHeader>
          <CardContent className="px-0 pb-0">
            {deposits.items.length === 0 ? (
              <EmptyState title="ยังไม่มีรายการฝากเงิน" />
            ) : (
              <ul className="divide-y divide-border">
                {deposits.items.map((deposit) => (
                  <li key={deposit.id} className="flex items-center justify-between gap-3 px-5 py-3">
                    <div className="min-w-0">
                      <p className="tabular truncate text-sm font-medium">{deposit.reference}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {deposit.method} · {formatDateTime(deposit.createdAt)}
                      </p>
                    </div>
                    <div className="text-right">
                      <Money value={deposit.amount} className="block text-sm" />
                      <DepositStatusBadge status={deposit.status} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>การถอนเงินล่าสุด</CardTitle>
            <Button asChild variant="ghost" size="sm">
              <Link href="/account/withdrawals">ดูทั้งหมด</Link>
            </Button>
          </CardHeader>
          <CardContent className="px-0 pb-0">
            {withdrawals.items.length === 0 ? (
              <EmptyState title="ยังไม่มีรายการถอนเงิน" />
            ) : (
              <ul className="divide-y divide-border">
                {withdrawals.items.map((withdrawal) => (
                  <li key={withdrawal.id} className="flex items-center justify-between gap-3 px-5 py-3">
                    <div className="min-w-0">
                      <p className="tabular truncate text-sm font-medium">{withdrawal.reference}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {withdrawal.bankName} · {formatDateTime(withdrawal.createdAt)}
                      </p>
                    </div>
                    <div className="text-right">
                      <Money value={withdrawal.amount} className="block text-sm" />
                      <WithdrawalStatusBadge status={withdrawal.status} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
