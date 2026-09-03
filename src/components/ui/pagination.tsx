'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { appConfig } from '@/config/app';
import { Button } from './button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './select';

/**
 * Server-side pagination control.
 *
 * Page state lives in the URL so a page of a financial table is shareable,
 * bookmarkable, and survives a refresh — and so the server can render exactly the
 * rows requested instead of shipping the whole table to the browser.
 */
export function Pagination({
  page,
  pageCount,
  pageSize,
  total,
}: {
  page: number;
  pageCount: number;
  pageSize: number;
  total: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const go = (next: Record<string, string>) => {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(next)) params.set(key, value);
    router.push(`${pathname}?${params.toString()}`);
  };

  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);

  return (
    <div className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-xs text-muted-foreground">
        แสดง <span className="tabular font-medium text-foreground">{from}</span>–
        <span className="tabular font-medium text-foreground">{to}</span> จาก{' '}
        <span className="tabular font-medium text-foreground">{total.toLocaleString('th-TH')}</span> รายการ
      </p>

      <div className="flex items-center gap-2">
        <Select value={String(pageSize)} onValueChange={(value) => go({ pageSize: value, page: '1' })}>
          <SelectTrigger className="h-8 w-24 text-xs" aria-label="จำนวนต่อหน้า">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {appConfig.pagination.pageSizeOptions.map((option) => (
              <SelectItem key={option} value={String(option)}>
                {option} / หน้า
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="หน้าก่อนหน้า"
            disabled={page <= 1}
            onClick={() => go({ page: String(page - 1) })}
          >
            <ChevronLeft />
          </Button>
          <span className="tabular px-2 text-xs text-muted-foreground">
            {page} / {pageCount}
          </span>
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="หน้าถัดไป"
            disabled={page >= pageCount}
            onClick={() => go({ page: String(page + 1) })}
          >
            <ChevronRight />
          </Button>
        </div>
      </div>
    </div>
  );
}
