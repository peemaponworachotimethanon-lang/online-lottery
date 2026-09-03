import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { MobileNav } from '@/components/layout/mobile-nav';
import { SiteHeader } from '@/components/layout/site-header';
import { getCurrentUser } from '@/server/context';

/** Everything under this group is private and must never be indexed. */
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <main id="main" className="flex-1 pb-24 md:pb-8">
        {children}
      </main>
      <MobileNav />
    </div>
  );
}
