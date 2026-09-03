import { appConfig } from '@/config/app';
import { clamp } from './utils';

export type RawSearchParams = Record<string, string | string[] | undefined>;

export function readParam(params: RawSearchParams, key: string, fallback = ''): string {
  const value = params[key];
  if (Array.isArray(value)) return value[0] ?? fallback;
  return value ?? fallback;
}

export function readPage(params: RawSearchParams): number {
  const value = Number(readParam(params, 'page'));
  return Number.isFinite(value) && value > 0 ? Math.trunc(value) : 1;
}

export function readPageSize(params: RawSearchParams): number {
  const value = Number(readParam(params, 'pageSize'));
  if (!Number.isFinite(value) || value <= 0) return appConfig.pagination.defaultPageSize;
  return clamp(Math.trunc(value), 1, appConfig.pagination.maxPageSize);
}

/** `2026-09-03` -> start-of-day UTC ISO, so date filters bound whole days. */
export function readDateFrom(params: RawSearchParams, key = 'from'): string | undefined {
  const value = readParam(params, key);
  if (!value) return undefined;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

export function readDateTo(params: RawSearchParams, key = 'to'): string | undefined {
  const value = readParam(params, key);
  if (!value) return undefined;
  const date = new Date(`${value}T23:59:59.999Z`);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

/** Narrows an arbitrary query value to a known union, falling back to `all`. */
export function readEnum<T extends string>(
  params: RawSearchParams,
  key: string,
  allowed: readonly T[],
): T | 'all' {
  const value = readParam(params, key);
  return (allowed as readonly string[]).includes(value) ? (value as T) : 'all';
}
