import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { AdminShell } from '@/components/layout/admin-shell';
import { ROLE_LABELS } from '@/lib/permissions';
import { isStaff } from '@/lib/permissions';
import { getCurrentUser } from '@/server/context';
import { getServices } from '@/services/container';

export const metadata: Metadata = {
  title: { default: 'ระบบผู้ดูแล', template: '%s · ระบบผู้ดูแล' },
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/admin');
  // Coarse gate for the whole console; every page and action re-checks the
  // specific permission it needs.
  if (!isStaff({ id: user.id, roles: user.roles })) redirect('/forbidden');

  const services = getServices();
  const [pendingDeposits, pendingWithdrawals] = await Promise.all([
    services.repos.deposits.countByStatus('pending'),
    services.repos.withdrawals.countByStatus('pending'),
  ]);

  return (
    <AdminShell
      displayName={user.displayName}
      roleLabel={user.roles.map((role) => ROLE_LABELS[role]).join(' · ')}
      pendingCount={pendingDeposits + pendingWithdrawals}
    >
      {children}
    </AdminShell>
  );
}
