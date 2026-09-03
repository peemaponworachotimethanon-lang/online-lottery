import { PageHeader } from '@/components/ui/stat-card';
import { WithdrawForm } from '@/features/wallet/withdraw-form';
import { requireUser } from '@/server/context';
import { getServices } from '@/services/container';

export default async function WithdrawPage() {
  const user = await requireUser();
  const wallet = await getServices().wallet.getWallet(user.id);

  return (
    <div className="mx-auto w-full max-w-6xl space-y-5 px-4 py-6 sm:px-6">
      <PageHeader
        title="ถอนเงิน"
        description="ส่งคำขอถอนเงินเข้าบัญชีธนาคารของคุณ เจ้าหน้าที่จะตรวจสอบก่อนอนุมัติ"
      />
      <WithdrawForm
        balance={wallet.balance}
        held={wallet.held}
        defaults={{
          bankName: user.bankName,
          bankAccountNumber: user.bankAccountNumber,
          bankAccountName: user.bankAccountName,
        }}
      />
    </div>
  );
}
