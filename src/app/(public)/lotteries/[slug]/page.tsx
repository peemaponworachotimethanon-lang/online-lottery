import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CalendarClock, Clock, Info } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Countdown } from '@/components/ui/countdown';
import { EmptyState } from '@/components/ui/feedback';
import { RoundStatusBadge } from '@/components/ui/status-badge';
import { Table, TableWrap, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { formatDateTime } from '@/lib/datetime';
import { isRoundAcceptingBets } from '@/lib/lottery-rules';
import { formatMoney, formatRate } from '@/lib/money';
import { BettingBoard } from '@/features/betting/betting-board';
import { CountryMark } from '@/features/lottery/country-mark';
import { getCurrentUser } from '@/server/context';
import { getServices } from '@/services/container';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const lottery = await getServices().repos.lotteries.findBySlug(slug);
  if (!lottery) return { title: 'ไม่พบหวย' };
  return {
    title: lottery.nameTh,
    description: lottery.description,
    openGraph: { title: `${lottery.nameTh} — อัตราจ่ายและเวลาปิดรับ`, description: lottery.description },
  };
}

export default async function LotteryDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const services = getServices();
  const nowMs = Date.now();

  const lottery = await services.repos.lotteries.findBySlug(slug);
  if (!lottery) notFound();

  const [detail, user] = await Promise.all([
    services.catalog.getDetailBySlug(slug, nowMs),
    getCurrentUser(),
  ]);

  const wallet = user ? await services.wallet.getWallet(user.id).catch(() => null) : null;

  const round = detail.currentRound;
  const accepting = round
    ? isRoundAcceptingBets(
        { status: 'open', openAt: round.openAt, closeAt: round.closeAt },
        nowMs,
      )
    : false;

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 px-4 py-6 pb-40 sm:px-6 lg:pb-8">
      {/* ------------------------------------------------------------ header */}
      <header className="surface-card p-4 sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex gap-3">
            <CountryMark code={detail.countryCode} className="size-12" />
            <div className="min-w-0">
              <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{detail.nameTh}</h1>
              <p className="text-sm text-muted-foreground">
                {detail.name} · {detail.country}
              </p>
              <p className="mt-1 max-w-xl text-sm text-muted-foreground">{detail.description}</p>
            </div>
          </div>

          {round ? (
            <div className="shrink-0 rounded-[var(--radius-control)] border border-border bg-surface-muted p-3 sm:min-w-56">
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="text-xs text-muted-foreground">งวด {round.roundCode}</span>
                <RoundStatusBadge status={round.status} />
              </div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Clock className="size-3.5" aria-hidden /> ปิดรับใน
              </div>
              <Countdown targetIso={round.closeAt} serverNowMs={nowMs} className="text-lg" />
              <dl className="mt-2 space-y-0.5 text-[11px] text-muted-foreground">
                <div className="flex justify-between gap-2">
                  <dt>ปิดรับ</dt>
                  <dd className="tabular">{formatDateTime(round.closeAt)}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt>ออกผล</dt>
                  <dd className="tabular">{formatDateTime(round.resultAt)}</dd>
                </div>
              </dl>
            </div>
          ) : null}
        </div>
      </header>

      {/* ----------------------------------------------------------- betting */}
      {round ? (
        <BettingBoard
          betTypes={detail.betTypes}
          roundId={round.id}
          lotterySlug={detail.slug}
          lotteryName={detail.nameTh}
          closeAt={round.closeAt}
          acceptingBets={accepting}
          balance={wallet?.balance ?? 0}
          isAuthenticated={Boolean(user)}
        />
      ) : (
        <div className="surface-card">
          <EmptyState
            icon={<CalendarClock className="size-5" />}
            title="ยังไม่มีงวดที่เปิดรับแทง"
            description="งวดถัดไปจะประกาศตามตารางเวลาของหวยนี้"
            action={
              <Button asChild variant="outline" size="sm">
                <Link href="/lotteries">ดูหวยอื่น</Link>
              </Button>
            }
          />
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        {/* -------------------------------------------------------- payouts */}
        <section className="space-y-3" aria-labelledby="payout-table">
          <h2 id="payout-table" className="text-base font-semibold tracking-tight">
            อัตราจ่ายและวงเงิน
          </h2>
          <TableWrap>
            <Table>
              <THead>
                <TR>
                  <TH>ประเภท</TH>
                  <TH align="right">อัตราจ่าย</TH>
                  <TH align="right">ขั้นต่ำ</TH>
                  <TH align="right">สูงสุด/รายการ</TH>
                </TR>
              </THead>
              <TBody>
                {detail.betTypes.map((betType) => (
                  <TR key={betType.code}>
                    <TD>
                      <span className="font-medium">{betType.nameTh}</span>
                      <span className="block text-xs text-muted-foreground">{betType.name}</span>
                    </TD>
                    <TD align="right">
                      <Badge variant="gold" className="tabular">
                        x{formatRate(betType.rateMilli)}
                      </Badge>
                    </TD>
                    <TD align="right" className="tabular text-sm">
                      {formatMoney(betType.minBet)}
                    </TD>
                    <TD align="right" className="tabular text-sm">
                      {formatMoney(betType.maxBet)}
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </TableWrap>
          <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
            <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            อัตราจ่ายจะถูกบันทึกไว้ ณ เวลาที่แทง หากมีการปรับอัตราภายหลัง บิลเดิมจะยังใช้อัตราเดิม
          </p>
        </section>

        {/* --------------------------------------------------- past results */}
        <section className="space-y-3" aria-labelledby="recent-results">
          <h2 id="recent-results" className="text-base font-semibold tracking-tight">
            ผลรางวัลย้อนหลัง
          </h2>
          {detail.recentResults.length === 0 ? (
            <div className="surface-card">
              <EmptyState title="ยังไม่มีผลย้อนหลัง" description="ผลรางวัลจะแสดงที่นี่หลังการประกาศ" />
            </div>
          ) : (
            <TableWrap>
              <Table>
                <THead>
                  <TR>
                    <TH>งวด</TH>
                    <TH align="center">3 ตัวบน</TH>
                    <TH align="center">2 ตัวบน</TH>
                    <TH align="center">2 ตัวล่าง</TH>
                  </TR>
                </THead>
                <TBody>
                  {detail.recentResults.map((result) => (
                    <TR key={result.id}>
                      <TD>
                        <span className="text-sm">{formatDateTime(result.announcedAt)}</span>
                        <span className="block text-xs text-muted-foreground">{result.roundCode}</span>
                      </TD>
                      <TD align="center" className="tabular font-semibold text-accent">
                        {result.top3}
                      </TD>
                      <TD align="center" className="tabular">
                        {result.top2}
                      </TD>
                      <TD align="center" className="tabular">
                        {result.bottom2}
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </TableWrap>
          )}
        </section>
      </div>

      {/* -------------------------------------------------------------- rules */}
      <section className="surface-card space-y-2 p-5" aria-labelledby="rules">
        <h2 id="rules" className="text-base font-semibold tracking-tight">
          กติกาโดยสรุป
        </h2>
        <ul className="list-inside list-disc space-y-1.5 text-sm text-muted-foreground">
          <li>ระบบจะปิดรับแทงอัตโนมัติตามเวลาเซิร์ฟเวอร์ ไม่อ้างอิงนาฬิกาเครื่องผู้ใช้</li>
          <li>เมื่อยืนยันบิลแล้ว เลขและจำนวนเงินไม่สามารถแก้ไขหรือยกเลิกได้</li>
          <li>ยอดเงินจะถูกหักทันทีที่ยืนยัน และมีรายการบันทึกในประวัติธุรกรรม</li>
          <li>3 ตัวโต๊ด นับเลขสลับตำแหน่งทุกรูปแบบของเลข 3 ตัวบน</li>
          <li>วิ่งบนนับจากหลักใดหลักหนึ่งของเลข 3 ตัวบน วิ่งล่างนับจากเลข 2 ตัวล่าง</li>
          <li>เมื่อประกาศผล ระบบจะโอนเงินรางวัลเข้ากระเป๋าโดยอัตโนมัติ</li>
        </ul>
      </section>
    </div>
  );
}
