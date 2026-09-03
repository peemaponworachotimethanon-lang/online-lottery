import { PageHeader } from '@/components/ui/stat-card';
import { StandaloneBetSlip } from '@/features/betting/standalone-slip';
import { requireUser } from '@/server/context';
import { getServices } from '@/services/container';

export default async function BetSlipPage() {
  const user = await requireUser();
  const services = getServices();
  const nowMs = Date.now();

  const [wallet, cards] = await Promise.all([
    services.wallet.getWallet(user.id),
    services.catalog.listOpen(6, nowMs),
  ]);

  return (
    <div className="mx-auto w-full max-w-3xl space-y-5 px-4 py-6 sm:px-6">
      <PageHeader title="โพยหวย" description="ตรวจรายการก่อนยืนยัน — โพยจะผูกกับงวดที่คุณเลือกไว้" />
      <StandaloneBetSlip
        balance={wallet.balance}
        openLotteries={cards.map((card) => ({ slug: card.slug, name: card.nameTh }))}
      />
    </div>
  );
}
