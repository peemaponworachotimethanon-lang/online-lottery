import { formatMoney } from '@/lib/money';

/**
 * Mock QR placeholder.
 *
 * Deliberately NOT a scannable code: it is a deterministic pattern derived from
 * the reference string, clearly labelled as a demo. Rendering a real-looking
 * payment QR would invite someone to try to pay it.
 */
function patternFor(seed: string, size = 11): boolean[][] {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const grid: boolean[][] = [];
  for (let row = 0; row < size; row++) {
    const cells: boolean[] = [];
    for (let column = 0; column < size; column++) {
      hash ^= hash << 13;
      hash ^= hash >>> 17;
      hash ^= hash << 5;
      cells.push(((hash >>> 0) % 100) > 52);
    }
    grid.push(cells);
  }
  return grid;
}

export function MockQrPlaceholder({
  amountSatang,
  reference,
}: {
  amountSatang: number;
  reference: string;
}) {
  const grid = patternFor(reference);

  return (
    <div className="flex flex-col items-center gap-3 rounded-[var(--radius-control)] border border-border bg-surface-muted p-5">
      <div
        aria-hidden
        className="grid gap-[2px] rounded-lg bg-surface p-3 shadow-sm"
        style={{ gridTemplateColumns: `repeat(${grid.length}, 0.75rem)` }}
      >
        {grid.flatMap((row, rowIndex) =>
          row.map((filled, columnIndex) => (
            <span
              key={`${rowIndex}-${columnIndex}`}
              className={`size-3 rounded-[2px] ${filled ? 'bg-forest-900 dark:bg-emerald-200' : 'bg-transparent'}`}
            />
          )),
        )}
      </div>
      <div className="text-center">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          QR ตัวอย่างสำหรับเดโม — สแกนไม่ได้
        </p>
        <p className="tabular mt-1 text-lg font-semibold">{formatMoney(amountSatang)}</p>
        <p className="tabular text-xs text-muted-foreground">อ้างอิง {reference}</p>
      </div>
    </div>
  );
}
