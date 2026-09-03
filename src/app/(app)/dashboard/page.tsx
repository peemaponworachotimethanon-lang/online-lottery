import Link from 'next/link';
import {
  ArrowDownToLine,
  ArrowUpRight,
  Clock,
  Star,
  Ticket,
  TrendingUp,
  Trophy,
  Wallet,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/feedback';
import { Money } from '@/components/ui/money';
import { PageHeader, StatCard } from '@/components/ui/stat-card';
import { BetStatusBadge, TxTypeBadge } from '@/components/ui/status-badge';
import { Table, TableWrap, TBody, TD, TR } from '@/components/ui/table';
import { StakeAreaChart, WinLossChart } from '@/components/charts/lazy';
import { LotteryCard } from '@/features/lottery/lottery-card';
import { formatDateTime, relativeFromNow } from '@/lib/datetime';
import { requireUser } from '@/server/context';
import { getServices } from '@/services/container';

export default async function DashboardPage() {
  const user = await requireUser();
  const services = getServices();
  const nowMs = Date.now();

  const [summary, betCounts] = await Promise.all([
    services.reporting.userDashboard(user.id, nowMs),
    Promise.all([
      services.repos.bets.findMany({ userId: user.id, status: 'won', pageSize: 1 }),
      services.repos.bets.findMany({ userId: user.id, status: 'lost', pageSize: 1 }),
      services.repos.bets.findMany({ userId: user.id, status: 'confirmed', pageSize: 1 }),
    ]),
  ]);

  const [won, lost, waiting] = betCounts;

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 px-4 py-6 sm:px-6">
      <PageHeader
        title={`สวัสดี ${user.displayName}`}
        description="ภาพรวมกระเป๋าเงิน การแทง และงวดที่กำลังจะปิดรับ"
        actions={
          <>
            <Button asChild variant="outline">
              <Link href="/wallet/deposit">
                <ArrowDownToLine /> ฝากเงิน
              </Link>
            </Button>
            <Button asChild>
              <Link href="/lotteries">
                <Ticket /> แทงหวย
              </Link>
            </Button>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="ยอดเงินคงเหลือ"
          value={<Money value={summary.balance} />}
          hint={summary.held > 0 ? <>กันไว้สำหรับการถอน <Money value={summary.held} tone="muted" className="text-xs" /></> : 'พร้อมใช้งานทั้งหมด'}
          icon={<Wallet />}
          tone="emerald"
        />
        <StatCard
          label="ยอดแทงวันนี้"
          value={<Money value={summary.todayStake} />}
          hint={`${waiting.total} บิลกำลังรอผล`}
          icon={<Ticket />}
        />
        <StatCard
          label="รางวัลสะสม"
          value={<Money value={summary.totalWinnings} tone="prize" />}
          hint={`ถูกรางวัล ${won.total} บิล`}
          icon={<Trophy />}
          tone="gold"
        />
        <StatCard
          label="กำไร/ขาดทุนสุทธิ"
          value={<Money value={summary.netProfit} tone="auto" signed />}
          hint="คำนวณจากยอดแทงและรางวัลทั้งหมด"
          icon={<TrendingUp />}
          tone={summary.netProfit >= 0 ? 'emerald' : 'warning'}
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>ยอดแทงและรางวัล 7 วันล่าสุด</CardTitle>
          </CardHeader>
          <CardContent>
            <StakeAreaChart data={summary.weeklyStake} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>สรุปผลบิล</CardTitle>
          </CardHeader>
          <CardContent>
            <WinLossChart
              data={[
                { label: 'ถูกรางวัล', value: won.total },
                { label: 'ไม่ถูกรางวัล', value: lost.total },
                { label: 'รอผล', value: waiting.total },
              ]}
            />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* --------------------------------------------------- recent bets */}
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>บิลล่าสุด</CardTitle>
            <Button asChild variant="ghost" size="sm">
              <Link href="/account/bets">
                ดูทั้งหมด <ArrowUpRight />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="px-0 pb-0">
            {summary.recentBets.length === 0 ? (
              <EmptyState
                title="ยังไม่มีบิลแทง"
                description="เริ่มแทงหวยงวดแรกของคุณได้เลย"
                action={
                  <Button asChild size="sm">
                    <Link href="/lotteries">เลือกหวย</Link>
                  </Button>
                }
              />
            ) : (
              <ul className="divide-y divide-border">
                {summary.recentBets.map((bet) => (
                  <li key={bet.id} className="flex items-center gap-3 px-5 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{bet.lotteryName}</p>
                      <p className="tabular truncate text-xs text-muted-foreground">
                        {bet.reference} · {bet.itemCount} รายการ · {relativeFromNow(bet.createdAt)}
                      </p>
                    </div>
                    <div className="text-right">
                      <Money value={bet.totalStake} className="block text-sm" />
                      <BetStatusBadge status={bet.status} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* ------------------------------------------- recent transactions */}
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>ธุรกรรมล่าสุด</CardTitle>
            <Button asChild variant="ghost" size="sm">
              <Link href="/account/transactions">
                ดูทั้งหมด <ArrowUpRight />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="px-0 pb-0">
            {summary.recentTransactions.length === 0 ? (
              <EmptyState title="ยังไม่มีธุรกรรม" />
            ) : (
              <TableWrap className="rounded-none border-0 border-t">
                <Table>
                  <TBody>
                    {summary.recentTransactions.map((tx) => (
                      <TR key={tx.id}>
                        <TD className="w-28">
                          <TxTypeBadge type={tx.type} />
                        </TD>
                        <TD>
                          <span className="line-clamp-1 text-sm">{tx.description}</span>
                          <span className="block text-xs text-muted-foreground">
                            {formatDateTime(tx.createdAt)}
                          </span>
                        </TD>
                        <TD align="right">
                          <Money value={tx.amount} tone="auto" signed className="text-sm" />
                        </TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              </TableWrap>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <section aria-labelledby="upcoming">
          <div className="mb-3 flex items-center gap-2">
            <Clock className="size-4 text-muted-foreground" aria-hidden />
            <h2 id="upcoming" className="text-base font-semibold tracking-tight">
              ใกล้ปิดรับ
            </h2>
          </div>
          {summary.upcomingClosings.length === 0 ? (
            <div className="surface-card">
              <EmptyState title="ยังไม่มีงวดที่เปิดรับ" />
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {summary.upcomingClosings.map((card) => (
                <LotteryCard key={card.id} lottery={card} serverNowMs={nowMs} />
              ))}
            </div>
          )}
        </section>

        <section aria-labelledby="favorites">
          <div className="mb-3 flex items-center gap-2">
            <Star className="size-4 text-muted-foreground" aria-hidden />
            <h2 id="favorites" className="text-base font-semibold tracking-tight">
              หวยที่ติดตาม
            </h2>
          </div>
          {summary.favoriteLotteries.length === 0 ? (
            <div className="surface-card">
              <EmptyState
                icon={<Star className="size-5" />}
                title="ยังไม่ได้ติดตามหวยใด"
                description="กดติดตามหวยที่คุณเล่นบ่อย เพื่อให้ขึ้นที่นี่"
                action={
                  <Button asChild size="sm" variant="outline">
                    <Link href="/lotteries">เลือกหวย</Link>
                  </Button>
                }
              />
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {summary.favoriteLotteries.map((card) => (
                <LotteryCard key={card.id} lottery={card} serverNowMs={nowMs} />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
