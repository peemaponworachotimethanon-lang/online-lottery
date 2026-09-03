import Link from 'next/link';
import { brand } from '@/config/brand';
import { Logo } from './logo';

const COLUMNS = [
  {
    title: 'ผลิตภัณฑ์',
    links: [
      { href: '/lotteries', label: 'หวยทั้งหมด' },
      { href: '/results', label: 'ผลรางวัลย้อนหลัง' },
      { href: '/bet-slip', label: 'โพยหวยของฉัน' },
      { href: '/wallet', label: 'ฝาก–ถอน' },
    ],
  },
  {
    title: 'ช่วยเหลือ',
    links: [
      { href: '/help', label: 'คำถามที่พบบ่อย' },
      { href: '/help#rules', label: 'กติกาและอัตราจ่าย' },
      { href: '/help#contact', label: 'ติดต่อฝ่ายบริการ' },
    ],
  },
  {
    title: 'เกี่ยวกับ',
    links: [
      { href: '/help#about', label: 'เกี่ยวกับระบบ' },
      { href: '/help#terms', label: 'เงื่อนไขการใช้งาน' },
      { href: '/help#privacy', label: 'นโยบายความเป็นส่วนตัว' },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-border bg-surface-muted">
      <div className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-3">
            <Logo />
            <p className="max-w-xs text-sm text-muted-foreground">{brand.tagline}</p>
            <p className="inline-flex rounded-full border border-accent/35 bg-accent-soft px-2.5 py-1 text-xs font-medium text-accent-foreground">
              โหมดสาธิต · ไม่มีการใช้เงินจริง
            </p>
          </div>

          {COLUMNS.map((column) => (
            <div key={column.title} className="space-y-3">
              <h2 className="text-sm font-semibold">{column.title}</h2>
              <ul className="space-y-2">
                {column.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-8 flex flex-col gap-2 border-t border-border pt-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {new Date().getFullYear()} {brand.name}. ระบบสาธิตเพื่อการพัฒนาและทดสอบเท่านั้น
          </p>
          <p>ธีม {brand.themeName} · {brand.themeConceptTh}</p>
        </div>
      </div>
    </footer>
  );
}
