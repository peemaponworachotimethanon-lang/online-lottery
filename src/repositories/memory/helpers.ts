import { appConfig } from '@/config/app';
import { clamp } from '@/lib/utils';
import type { Page } from '@/types/domain';

export function paginate<T>(
  items: readonly T[],
  page = 1,
  pageSize: number = appConfig.pagination.defaultPageSize,
): Page<T> {
  const safeSize = clamp(Math.trunc(pageSize) || appConfig.pagination.defaultPageSize, 1, appConfig.pagination.maxPageSize);
  const total = items.length;
  const pageCount = Math.max(1, Math.ceil(total / safeSize));
  const safePage = clamp(Math.trunc(page) || 1, 1, pageCount);
  const start = (safePage - 1) * safeSize;
  return {
    items: items.slice(start, start + safeSize),
    total,
    page: safePage,
    pageSize: safeSize,
    pageCount,
  };
}

export function withinRange(iso: string, from?: string, to?: string): boolean {
  const value = new Date(iso).getTime();
  if (from && value < new Date(from).getTime()) return false;
  if (to && value > new Date(to).getTime()) return false;
  return true;
}

export function byCreatedAtDesc(a: { createdAt: string }, b: { createdAt: string }): number {
  return b.createdAt.localeCompare(a.createdAt);
}

export function notDeleted<T extends { deletedAt: string | null }>(item: T): boolean {
  return item.deletedAt === null;
}

export function matches(haystack: readonly (string | null | undefined)[], needle: string): boolean {
  const term = needle.trim().toLowerCase();
  if (!term) return true;
  return haystack.some((value) => (value ?? '').toLowerCase().includes(term));
}

/** Deep clone so callers cannot mutate stored objects by reference. */
export function clone<T>(value: T): T {
  return structuredClone(value);
}
