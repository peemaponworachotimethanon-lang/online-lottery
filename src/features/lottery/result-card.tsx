import { formatDateTime } from '@/lib/datetime';
import { cn } from '@/lib/utils';
import type { ResultDto } from '@/types/dto';
import { CountryMark } from './country-mark';

function Digits({ label, value, tone }: { label: string; value: string; tone?: 'gold' }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <span
        className={cn(
          'tabular rounded-[var(--radius-control)] border px-3 py-1.5 text-lg font-semibold tracking-[0.15em]',
          tone === 'gold'
            ? 'border-accent/35 bg-accent-soft text-accent-foreground'
            : 'border-border bg-surface-muted text-foreground',
        )}
      >
        {value}
      </span>
    </div>
  );
}

export function ResultCard({ result, countryCode }: { result: ResultDto; countryCode?: string }) {
  return (
    <article className="surface-card flex flex-col gap-3 p-4">
      <div className="flex items-center gap-3">
        {countryCode ? <CountryMark code={countryCode} /> : null}
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-semibold">{result.lotteryNameTh}</h3>
          <p className="truncate text-xs text-muted-foreground">
            งวด {result.roundCode} · {formatDateTime(result.announcedAt)}
          </p>
        </div>
      </div>
      <div className="flex items-end justify-around gap-2">
        <Digits label="3 ตัวบน" value={result.top3} tone="gold" />
        <Digits label="2 ตัวบน" value={result.top2} />
        <Digits label="2 ตัวล่าง" value={result.bottom2} />
      </div>
    </article>
  );
}
