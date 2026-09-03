import Link from 'next/link';
import {
  ArrowRight,
  BadgeCheck,
  Clock3,
  Gauge,
  ScrollText,
  ShieldCheck,
  Sparkles,
  Wallet,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/feedback';
import { brand } from '@/config/brand';
import { LotteryCard } from '@/features/lottery/lottery-card';
import { ResultCard } from '@/features/lottery/result-card';
import { DEMO_CREDENTIALS } from '@/config/demo';
import { getServices } from '@/services/container';
import { FaqAccordion } from '@/features/marketing/faq';

/** The homepage is public and revalidated, not user-specific. */
export const revalidate = 15;

const FEATURES = [
  {
    icon: Gauge,
    title: 'แทงเร็ว จบใน 4 ขั้นตอน',
    body: 'เลือกประเภท → ใส่เลข → ใส่เงิน → ยืนยัน รองรับคีย์บอร์ดบนเดสก์ท็อปและแป้นตัวเลขบนมือถือ',
  },
  {
    icon: ShieldCheck,
    title: 'บัญชีเงินแบบ Ledger',
    body: 'ทุกการเคลื่อนไหวของเงินมีรายการบัญชีกำกับ ตรวจสอบย้อนหลังได้ทุกบาททุกสตางค์',
  },
  {
    icon: Clock3,
    title: 'เวลาปิดรับตรงกับเซิร์ฟเวอร์',
    body: 'นับถอยหลังซิงก์กับเวลาเซิร์ฟเวอร์ ไม่พึ่งนาฬิกาเครื่องผู้ใช้ ปิดรับตรงเวลาเสมอ',
  },
  {
    icon: BadgeCheck,
    title: 'จ่ายรางวัลอัตโนมัติ',
    body: 'ระบบเคลียร์ผลรางวัลแบบ idempotent รันซ้ำกี่ครั้งก็ไม่จ่ายซ้ำ',
  },
];

export default async function HomePage() {
  const services = getServices();
  const nowMs = Date.now();

  const [openLotteries, closingSoon, latestResults, lotteries] = await Promise.all([
    services.catalog.listOpen(6, nowMs),
    services.catalog.listClosingSoon(4, nowMs),
    services.catalog.latestResults(4),
    services.repos.lotteries.list(),
  ]);

  const countryByLotteryId = new Map(lotteries.map((lottery) => [lottery.id, lottery.countryCode]));

  return (
    <>
      {/* ---------------------------------------------------------------- hero */}
      <section className="hero-wash border-b border-border">
        <div className="mx-auto grid w-full max-w-7xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:py-20">
          <div className="space-y-6">
            <Badge variant="gold" className="gap-1.5">
              <Sparkles className="size-3.5" aria-hidden /> {brand.themeConceptTh} · โหมดสาธิต
            </Badge>

            <h1 className="text-3xl font-semibold leading-tight tracking-tight sm:text-4xl lg:text-5xl">
              แพลตฟอร์มหวยออนไลน์
              <br />
              <span className="text-primary">ที่เร็ว มั่นคง และโปร่งใส</span>
            </h1>

            <p className="max-w-xl text-base text-muted-foreground">
              ออกแบบให้ใช้งานง่ายเหมือนแอปการเงินสมัยใหม่ ตั้งแต่การแทงหวยไปจนถึงการฝาก–ถอน
              พร้อมระบบบัญชีที่ตรวจสอบได้ทุกธุรกรรม
            </p>

            <div className="flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link href="/lotteries">
                  เริ่มแทงหวย <ArrowRight />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/results">ดูผลรางวัล</Link>
              </Button>
            </div>

            <dl className="grid max-w-lg grid-cols-3 gap-4 border-t border-border pt-6">
              <div>
                <dt className="text-xs text-muted-foreground">หวยในระบบ</dt>
                <dd className="tabular text-xl font-semibold">{lotteries.length}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">เปิดรับตอนนี้</dt>
                <dd className="tabular text-xl font-semibold text-primary">{openLotteries.length}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">อัตราจ่ายสูงสุด</dt>
                <dd className="tabular text-xl font-semibold text-accent">x850</dd>
              </div>
            </dl>
          </div>

          {/* Demo credentials panel — the fastest way for a reviewer to get in. */}
          <aside className="surface-card h-fit space-y-4 p-5 lg:mt-2">
            <div className="flex items-center gap-2">
              <span className="flex size-8 items-center justify-center rounded-lg bg-primary-soft text-primary-soft-foreground">
                <ScrollText className="size-4" aria-hidden />
              </span>
              <div>
                <h2 className="text-sm font-semibold">บัญชีทดลองใช้งาน</h2>
                <p className="text-xs text-muted-foreground">สำหรับเดโมเท่านั้น ไม่มีเงินจริง</p>
              </div>
            </div>

            <div className="space-y-2">
              {[
                { role: 'ผู้ใช้ทั่วไป', ...DEMO_CREDENTIALS.user, tone: 'emerald' as const },
                { role: 'ผู้ดูแลระบบ', ...DEMO_CREDENTIALS.admin, tone: 'gold' as const },
              ].map((account) => (
                <div
                  key={account.email}
                  className="rounded-[var(--radius-control)] border border-border bg-surface-muted p-3"
                >
                  <div className="mb-1.5 flex items-center justify-between">
                    <span className="text-xs font-medium">{account.role}</span>
                    <Badge variant={account.tone}>demo</Badge>
                  </div>
                  <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
                    <dt className="text-muted-foreground">อีเมล</dt>
                    <dd className="tabular truncate font-medium">{account.email}</dd>
                    <dt className="text-muted-foreground">รหัสผ่าน</dt>
                    <dd className="tabular font-medium">{account.password}</dd>
                  </dl>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-2 rounded-[var(--radius-control)] bg-primary-soft px-3 py-2 text-xs text-primary-soft-foreground">
              <Wallet className="size-4 shrink-0" aria-hidden />
              บัญชีผู้ใช้ทดลองเริ่มต้นด้วยยอดเงิน 10,000 บาท
            </div>

            <Button asChild block>
              <Link href="/login">เข้าสู่ระบบด้วยบัญชีทดลอง</Link>
            </Button>
          </aside>
        </div>
      </section>

      {/* ------------------------------------------------------- closing soon */}
      {closingSoon.length > 0 ? (
        <section className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6">
          <header className="mb-4 flex items-end justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold tracking-tight">ใกล้ปิดรับ</h2>
              <p className="text-sm text-muted-foreground">รีบแทงก่อนหมดเวลา</p>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link href="/lotteries">
                ดูทั้งหมด <ArrowRight />
              </Link>
            </Button>
          </header>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {closingSoon.map((lottery) => (
              <LotteryCard key={lottery.id} lottery={lottery} serverNowMs={nowMs} />
            ))}
          </div>
        </section>
      ) : null}

      {/* --------------------------------------------------------- open now */}
      <section className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6">
        <header className="mb-4 flex items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">หวยที่เปิดรับแทง</h2>
            <p className="text-sm text-muted-foreground">เลือกหวยที่ต้องการเพื่อเริ่มแทง</p>
          </div>
        </header>
        {openLotteries.length === 0 ? (
          <div className="surface-card">
            <EmptyState
              title="ยังไม่มีหวยที่เปิดรับแทงในขณะนี้"
              description="งวดถัดไปจะเปิดให้แทงตามตารางเวลาของแต่ละหวย"
              action={
                <Button asChild variant="outline" size="sm">
                  <Link href="/lotteries">ดูตารางงวดทั้งหมด</Link>
                </Button>
              }
            />
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {openLotteries.map((lottery) => (
              <LotteryCard key={lottery.id} lottery={lottery} serverNowMs={nowMs} />
            ))}
          </div>
        )}
      </section>

      {/* ------------------------------------------------------ latest results */}
      <section className="border-y border-border bg-surface-muted">
        <div className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6">
          <header className="mb-4 flex items-end justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold tracking-tight">ผลรางวัลล่าสุด</h2>
              <p className="text-sm text-muted-foreground">อัปเดตทันทีเมื่อมีการประกาศผล</p>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link href="/results">
                ดูย้อนหลัง <ArrowRight />
              </Link>
            </Button>
          </header>
          {latestResults.length === 0 ? (
            <EmptyState title="ยังไม่มีผลรางวัล" description="ผลรางวัลจะแสดงที่นี่ทันทีที่ประกาศ" />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {latestResults.map((result) => (
                <ResultCard
                  key={result.id}
                  result={result}
                  countryCode={countryByLotteryId.get(result.lotteryId)}
                />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ----------------------------------------------------------- features */}
      <section className="mx-auto w-full max-w-7xl px-4 py-12 sm:px-6">
        <header className="mb-6 max-w-2xl">
          <h2 className="text-lg font-semibold tracking-tight">ทำไมต้องแพลตฟอร์มนี้</h2>
          <p className="text-sm text-muted-foreground">
            สร้างด้วยมาตรฐานเดียวกับระบบการเงินสมัยใหม่ ทั้งความถูกต้องของยอดเงินและความเร็วในการใช้งาน
          </p>
        </header>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((feature) => {
            const Icon = feature.icon;
            return (
              <div key={feature.title} className="surface-card space-y-2.5 p-5">
                <span className="flex size-9 items-center justify-center rounded-[10px] bg-primary-soft text-primary-soft-foreground">
                  <Icon className="size-4.5" aria-hidden />
                </span>
                <h3 className="text-sm font-semibold">{feature.title}</h3>
                <p className="text-sm text-muted-foreground">{feature.body}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* ---------------------------------------------------------------- faq */}
      <section className="mx-auto w-full max-w-3xl px-4 pb-16 sm:px-6">
        <h2 className="mb-4 text-lg font-semibold tracking-tight">คำถามที่พบบ่อย</h2>
        <FaqAccordion />
      </section>
    </>
  );
}
