import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Bell,
  Receipt,
  Settings,
  ShieldCheck,
  Ticket,
  User,
} from 'lucide-react';
import { SideNav } from '@/components/layout/nav';
import { PageHeader } from '@/components/ui/stat-card';

const ITEMS = [
  { href: '/account', label: 'โปรไฟล์', icon: <User />, exact: true },
  { href: '/account/bets', label: 'ประวัติการแทง', icon: <Ticket /> },
  { href: '/account/transactions', label: 'ประวัติธุรกรรม', icon: <Receipt /> },
  { href: '/account/deposits', label: 'การฝากเงิน', icon: <ArrowDownToLine /> },
  { href: '/account/withdrawals', label: 'การถอนเงิน', icon: <ArrowUpFromLine /> },
  { href: '/account/notifications', label: 'การแจ้งเตือน', icon: <Bell /> },
  { href: '/account/security', label: 'ความปลอดภัย', icon: <ShieldCheck /> },
  { href: '/account/settings', label: 'ตั้งค่า', icon: <Settings /> },
];

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-7xl space-y-5 px-4 py-6 sm:px-6">
      <PageHeader title="บัญชีของฉัน" description="จัดการโปรไฟล์ ประวัติการใช้งาน และการตั้งค่า" />

      <div className="grid gap-5 lg:grid-cols-[220px_1fr]">
        {/* Horizontal scroller on mobile, sidebar on desktop. */}
        <aside className="scrollbar-thin -mx-4 overflow-x-auto px-4 lg:mx-0 lg:overflow-visible lg:px-0">
          <div className="lg:sticky lg:top-20">
            <SideNav items={ITEMS} className="min-w-max flex-row gap-1 lg:min-w-0 lg:flex-col lg:gap-0.5" />
          </div>
        </aside>
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
