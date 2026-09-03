'use client';

import * as React from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { RotateCcw, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const ALL = '__all__';

export interface FilterSelect {
  key: string;
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
}

/**
 * URL-driven filter bar for admin tables.
 *
 * Filters live in the query string so the server renders exactly the requested
 * page — no client-side filtering of a fully downloaded table, which is what
 * makes these screens stay fast as the data grows.
 */
export function AdminFilterBar({
  searchKey = 'q',
  searchValue = '',
  searchPlaceholder = 'ค้นหา…',
  selects = [],
  dateKeys,
}: {
  searchKey?: string;
  searchValue?: string;
  searchPlaceholder?: string;
  selects?: FilterSelect[];
  dateKeys?: { from: string; to: string; fromValue: string; toValue: string };
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [term, setTerm] = React.useState(searchValue);

  const apply = (patch: Record<string, string>) => {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(patch)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    params.set('page', '1');
    router.push(`${pathname}?${params.toString()}`);
  };

  return (
    <form
      className="surface-card grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4"
      onSubmit={(event) => {
        event.preventDefault();
        apply({ [searchKey]: term });
      }}
    >
      <div className="space-y-1.5">
        <Label htmlFor="admin-search">ค้นหา</Label>
        <div className="flex gap-2">
          <Input
            id="admin-search"
            value={term}
            placeholder={searchPlaceholder}
            onChange={(event) => setTerm(event.target.value)}
          />
          <Button type="submit" variant="secondary" size="icon" aria-label="ค้นหา">
            <Search />
          </Button>
        </div>
      </div>

      {selects.map((select) => (
        <div key={select.key} className="space-y-1.5">
          <Label htmlFor={`filter-${select.key}`}>{select.label}</Label>
          <Select
            value={select.value || ALL}
            onValueChange={(value) => apply({ [select.key]: value === ALL ? '' : value })}
          >
            <SelectTrigger id={`filter-${select.key}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>ทั้งหมด</SelectItem>
              {select.options.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ))}

      {dateKeys ? (
        <>
          <div className="space-y-1.5">
            <Label htmlFor="filter-from">ตั้งแต่วันที่</Label>
            <Input
              id="filter-from"
              type="date"
              value={dateKeys.fromValue}
              onChange={(event) => apply({ [dateKeys.from]: event.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="filter-to">ถึงวันที่</Label>
            <Input
              id="filter-to"
              type="date"
              value={dateKeys.toValue}
              onChange={(event) => apply({ [dateKeys.to]: event.target.value })}
            />
          </div>
        </>
      ) : null}

      <div className="flex items-end">
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            setTerm('');
            router.push(pathname);
          }}
        >
          <RotateCcw /> ล้างตัวกรอง
        </Button>
      </div>
    </form>
  );
}
