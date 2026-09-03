import type { Metadata, Viewport } from 'next';
import { Toaster } from 'sonner';
import { appConfig } from '@/config/app';
import { brand } from '@/config/brand';
import { themeInitScript } from '@/components/layout/theme';
import './globals.css';

/**
 * Fonts are loaded with a plain stylesheet link rather than `next/font/google`.
 * `next/font` fetches the font files at BUILD time, which makes the build fail in
 * any environment without outbound access to fonts.googleapis.com (air-gapped CI,
 * restricted corporate networks). A `<link>` moves that dependency to runtime and
 * degrades gracefully to the system stack. `display=swap` plus explicit fallbacks
 * keep first paint fast either way.
 */
const FONT_HREF =
  'https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=Noto+Sans+Thai:wght@400;500;600;700&display=swap';

export const metadata: Metadata = {
  metadataBase: new URL(appConfig.url),
  title: {
    default: `${brand.name} — ${brand.taglineEn}`,
    template: `%s · ${brand.name}`,
  },
  description: brand.tagline,
  applicationName: brand.name,
  openGraph: {
    type: 'website',
    siteName: brand.name,
    title: `${brand.name} — ${brand.tagline}`,
    description: brand.tagline,
    locale: 'th_TH',
  },
  twitter: { card: 'summary_large_image', title: brand.name, description: brand.tagline },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0d1f19' },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="stylesheet" href={FONT_HREF} />
        {/* Applies the stored theme before paint to avoid a light flash. */}
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="antialiased">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
        >
          ข้ามไปยังเนื้อหาหลัก
        </a>
        {children}
        <Toaster
          position="top-center"
          richColors
          closeButton
          toastOptions={{ className: 'text-sm' }}
        />
      </body>
    </html>
  );
}
