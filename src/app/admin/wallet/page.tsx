import Link from 'next/link';
import { Coins, Lock, Users, Wallet as WalletIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/feedback';
import { Money } from '@/components/ui/money';
import { PageHeader, StatCard } from '@/components/ui/stat-card';
import { Table, TableWrap, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { LedgerHealthCard } from '@/features/admin/ledger-health';
import { requirePermission } from '@/server/context';
import { getServices } from '@/services/container';

export default async function AdminWalletPage() {
  await requirePermission('wallet.view');
  const services = getServices();

  const [totalBalance, users, depositTotal, withdrawTotal] = await Promise.all([
    services.repos.wallets.totalBalance(),
    services.query.findUsers({ page: 1, pageSize: 15, sortBy: 'createdAt', sortDir: 'desc' }),
    services.repos.walletTransactions.sumByType('deposit'),
    services.repos.walletTransactions.sumByType('hold'),
  ]);

  const topByBalance = [...users.items].sort((a, b) => b.balance - a.balance);
  const totalHeld = users.items.reduce((sum, user) => sum + user.held, 0);

  return (
    <div className="space-y-5">
      <PageHeader
        title="ภาพรวมกระเป๋าเงิน"
        description="ยอดเงินรวมในระบบและความถูกต้องของบัญชีแยกประเภท"
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="ยอดเงินรวมในระบบ"
          value={<Money value={totalBalance} compact />}
          icon={<WalletIcon />}
          tone="emerald"
        />
        <StatCard
          label="ยอดที่กันไว้ (หน้านี้)"
          value={<Money value={totalHeld} compact />}
          icon={<Lock />}
          tone="warning"
        />
        <StatCard
          label="ยอดฝากสะสม"
          value={<Money value={depositTotal} compact />}
          icon={<Coins />}
        />
        <StatCard
          label="ยอดกันวงเงินสะสม"
          value={<Money value={Math.abs(withdrawTotal)} compact />}
          icon={<Users />}
        />
      </div>

      <LedgerHealthCard />

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold tracking-tight">ผู้ใช้ล่าสุดและยอดคงเหลือ</h2>
          <Button asChild variant="ghost" size="sm">
            <Link href="/admin/users">ดูผู้ใช้ทั้งหมด</Link>
          </Button>
        </div>
        {topByBalance.length === 0 ? (
          <div className="surface-card">
            <EmptyState title="ยังไม่มีผู้ใช้" />
          </div>
        ) : (
          <TableWrap>
            <Table>
              <THead>
                <TR>
                  <TH>ผู้ใช้</TH>
                  <TH align="right">ยอดที่ใช้ได้</TH>
                  <TH align="right">กันไว้</TH>
                  <TH align="right">รวม</TH>
                  <TH align="right"></TH>
                </TR>
              </THead>
              <TBody>
                {topByBalance.map((user) => (
                  <TR key={user.id}>
                    <TD>
                      <span className="block text-sm font-medium">{user.username}</span>
                      <span className="block truncate text-xs text-muted-foreground">{user.email}</span>
                    </TD>
                    <TD align="right">
                      <Money value={user.balance} className="text-sm" />
                    </TD>
                    <TD align="right">
                      <Money value={user.held} tone="muted" className="text-sm" />
                    </TD>
                    <TD align="right">
                      <Money value={user.balance + user.held} className="text-sm font-medium" />
                    </TD>
                    <TD align="right">
                      <Button asChild variant="ghost" size="sm">
                        <Link href={`/admin/users/${user.id}`}>จัดการ</Link>
                      </Button>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </TableWrap>
        )}
      </section>
    </div>
  );
}
