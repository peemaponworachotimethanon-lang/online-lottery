import Link from 'next/link';
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  CircleDollarSign,
  Coins,
  Radio,
  TicketCheck,
  Trophy,
  UserPlus,
  Users,
  Wallet,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Money } from '@/components/ui/money';
import { PageHeader, StatCard } from '@/components/ui/stat-card';
import { AdminDailyChart, NewUsersChart, TopLotteriesChart } from '@/components/charts/lazy';
import { requirePermission } from '@/server/context';
import { getServices } from '@/services/container';
import { LedgerHealthCard } from '@/features/admin/ledger-health';

export default async function AdminDashboardPage() {
  await requirePermission('report.view');
  const services = getServices();

  const [kpis, charts] = await Promise.all([
    services.reporting.adminKpis(),
    services.reporting.adminCharts(7),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="แดชบอร์ดผู้ดูแล"
        description="ภาพรวมผู้ใช้ การเงิน และกิจกรรมการแทงของทั้งระบบ"
        actions={
          <>
            {kpis.pendingDeposits > 0 ? (
              <Button asChild variant="outline" size="sm">
                <Link href="/admin/deposits?status=pending">
                  <ArrowDownToLine /> ฝากรออนุมัติ {kpis.pendingDeposits}
                </Link>
              </Button>
            ) : null}
            {kpis.pendingWithdrawals > 0 ? (
              <Button asChild size="sm">
                <Link href="/admin/withdrawals?status=pending">
                  <ArrowUpFromLine /> ถอนรออนุมัติ {kpis.pendingWithdrawals}
                </Link>
              </Button>
            ) : null}
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="ผู้ใช้ทั้งหมด" value={kpis.totalUsers.toLocaleString('th-TH')} icon={<Users />} />
        <StatCard
          label="ผู้ใช้ที่ใช้งานได้"
          value={kpis.activeUsers.toLocaleString('th-TH')}
          icon={<TicketCheck />}
          tone="emerald"
        />
        <StatCard
          label="สมัครใหม่วันนี้"
          value={kpis.newUsersToday.toLocaleString('th-TH')}
          icon={<UserPlus />}
        />
        <StatCard
          label="ยอดเงินในระบบ"
          value={<Money value={kpis.totalWalletBalance} compact />}
          hint="รวมยอดที่กันไว้"
          icon={<Wallet />}
          tone="emerald"
        />
        <StatCard
          label="ยอดฝากวันนี้"
          value={<Money value={kpis.depositToday} compact />}
          icon={<ArrowDownToLine />}
        />
        <StatCard
          label="ยอดถอนวันนี้"
          value={<Money value={kpis.withdrawalToday} compact />}
          icon={<ArrowUpFromLine />}
          tone="warning"
        />
        <StatCard
          label="ยอดแทงวันนี้"
          value={<Money value={kpis.betVolumeToday} compact />}
          icon={<Coins />}
        />
        <StatCard
          label="ยอดจ่ายรางวัลสะสม"
          value={<Money value={kpis.totalPayout} tone="prize" compact />}
          icon={<Trophy />}
          tone="gold"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="ฝากรออนุมัติ"
          value={kpis.pendingDeposits}
          icon={<CircleDollarSign />}
          tone={kpis.pendingDeposits > 0 ? 'warning' : 'default'}
        />
        <StatCard
          label="ถอนรออนุมัติ"
          value={kpis.pendingWithdrawals}
          icon={<CircleDollarSign />}
          tone={kpis.pendingWithdrawals > 0 ? 'warning' : 'default'}
        />
        <StatCard label="หวยที่เปิดรับตอนนี้" value={kpis.openLotteries} icon={<Radio />} tone="emerald" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>ยอดแทง ฝาก และถอน 7 วันล่าสุด</CardTitle>
        </CardHeader>
        <CardContent>
          <AdminDailyChart data={charts.daily} />
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>ผู้ใช้สมัครใหม่</CardTitle>
          </CardHeader>
          <CardContent>
            <NewUsersChart data={charts.daily} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>หวยที่มียอดแทงสูงสุด</CardTitle>
          </CardHeader>
          <CardContent>
            <TopLotteriesChart data={charts.topLotteries} />
          </CardContent>
        </Card>
      </div>

      <LedgerHealthCard />
    </div>
  );
}
