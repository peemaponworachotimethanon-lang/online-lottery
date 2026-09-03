import type { Metadata } from 'next';
import { PageHeader } from '@/components/ui/stat-card';
import { EmptyState } from '@/components/ui/feedback';
import { LotteryCard } from '@/features/lottery/lottery-card';
import { getServices } from '@/services/container';

export const revalidate = 15;

export const metadata: Metadata = {
  title: 'หวยทั้งหมด',
  description: 'ดูหวยทุกประเภทที่เปิดรับแทง พร้อมเวลาปิดรับและสถานะของแต่ละงวด',
  openGraph: { title: 'หวยทั้งหมด', description: 'หวยทุกประเภทที่เปิดรับแทงในระบบ' },
};

const GROUPS = [
  { key: 'open', title: 'เปิดรับแทงตอนนี้', description: 'พร้อมรับโพยทันที' },
  { key: 'closing-soon', title: 'ใกล้ปิดรับ', description: 'เหลือเวลาไม่ถึง 30 นาที' },
  { key: 'other', title: 'ยังไม่เปิดรับ / รอผล', description: 'ดูตารางงวดและผลย้อนหลังได้' },
] as const;

export default async function LotteriesPage() {
  const nowMs = Date.now();
  const cards = await getServices().catalog.listCards(nowMs);

  const grouped = {
    'closing-soon': cards.filter((card) => card.status === 'closing-soon'),
    open: cards.filter((card) => card.status === 'open'),
    other: cards.filter((card) => card.status !== 'open' && card.status !== 'closing-soon'),
  };

  return (
    <div className="mx-auto w-full max-w-7xl space-y-8 px-4 py-8 sm:px-6">
      <PageHeader
        title="หวยทั้งหมด"
        description={`${cards.length} รายการในระบบ · เวลาแสดงตามโซนเวลาไทย (Asia/Bangkok)`}
      />

      {cards.length === 0 ? (
        <div className="surface-card">
          <EmptyState title="ยังไม่มีหวยในระบบ" description="ผู้ดูแลระบบสามารถเพิ่มหวยได้จากหน้าจัดการ" />
        </div>
      ) : (
        GROUPS.map((group) => {
          const groupCards = grouped[group.key];
          if (groupCards.length === 0) return null;
          return (
            <section key={group.key} aria-labelledby={`group-${group.key}`}>
              <header className="mb-3">
                <h2 id={`group-${group.key}`} className="text-base font-semibold tracking-tight">
                  {group.title}
                  <span className="tabular ml-2 text-sm font-normal text-muted-foreground">
                    {groupCards.length}
                  </span>
                </h2>
                <p className="text-sm text-muted-foreground">{group.description}</p>
              </header>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {groupCards.map((card) => (
                  <LotteryCard key={card.id} lottery={card} serverNowMs={nowMs} />
                ))}
              </div>
            </section>
          );
        })
      )}
    </div>
  );
}
