import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Money } from '@/components/ui/money';
import { isStaff } from '@/lib/permissions';
import { getCurrentUser } from '@/server/context';
import { getServices } from '@/services/container';
import { DesktopNav, type NavItem } from './nav';
import { Logo } from './logo';
import { ThemeToggle } from './theme';
import { NotificationBell, UserMenu } from './user-menu';

const PUBLIC_NAV: NavItem[] = [
  { href: '/', label: 'หน้าแรก', exact: true },
  { href: '/lotteries', label: 'หวยทั้งหมด' },
  { href: '/results', label: 'ผลรางวัล' },
  { href: '/help', label: 'ช่วยเหลือ' },
];

/**
 * Server component: reads the session once and passes plain data down, so the
 * header stays out of the client bundle apart from the two interactive menus.
 */
export async function SiteHeader() {
  const user = await getCurrentUser();
  const services = getServices();

  const [wallet, notifications, unread] = user
    ? await Promise.all([
        services.wallet.getWallet(user.id).catch(() => null),
        services.notifications.list(user.id, 6),
        services.notifications.unreadCount(user.id),
      ])
    : [null, [], 0];

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-surface/90 backdrop-blur supports-[backdrop-filter]:bg-surface/75">
      <div className="mx-auto flex h-14 w-full max-w-7xl items-center gap-3 px-4 sm:px-6">
        <Logo />
        <div className="ml-2 hidden md:block">
          <DesktopNav items={PUBLIC_NAV} />
        </div>

        <div className="ml-auto flex items-center gap-1.5">
          {user && wallet ? (
            <>
              <Link
                href="/wallet"
                className="hidden items-center gap-2 rounded-[var(--radius-control)] border border-border bg-surface-muted px-3 py-1.5 text-sm transition-colors hover:border-border-strong sm:flex"
              >
                <span className="text-xs text-muted-foreground">ยอดเงิน</span>
                <Money value={wallet.balance} className="font-semibold" />
              </Link>
              <NotificationBell
                unread={unread}
                notifications={notifications.map((notification) => ({
                  id: notification.id,
                  type: notification.type,
                  title: notification.title,
                  body: notification.body,
                  href: notification.href,
                  readAt: notification.readAt,
                  createdAt: notification.createdAt,
                }))}
              />
              <ThemeToggle />
              <UserMenu
                user={user}
                balance={wallet.balance}
                isStaff={isStaff({ id: user.id, roles: user.roles })}
              />
            </>
          ) : (
            <>
              <ThemeToggle />
              <Button asChild variant="ghost" size="sm">
                <Link href="/login">เข้าสู่ระบบ</Link>
              </Button>
              <Button asChild size="sm">
                <Link href="/register">สมัครสมาชิก</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
