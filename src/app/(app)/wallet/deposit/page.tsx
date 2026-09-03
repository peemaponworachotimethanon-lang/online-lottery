import { PageHeader } from '@/components/ui/stat-card';
import { DepositForm } from '@/features/wallet/deposit-form';
import { requireUser } from '@/server/context';
import { getServices } from '@/services/container';

export default async function DepositPage() {
  const user = await requireUser();
  const wallet = await getServices().wallet.getWallet(user.id);

  return (
    <div className="mx-auto w-full max-w-6xl space-y-5 px-4 py-6 sm:px-6">
      <PageHeader
        title="ฝากเงิน"
        description="เลือกช่องทางและจำนวนเงิน แล้วยืนยันเพื่อจำลองการชำระเงินสำเร็จ"
      />
      <DepositForm balance={wallet.balance} reference={`DEP-${user.username.toUpperCase()}`} />
    </div>
  );
}
