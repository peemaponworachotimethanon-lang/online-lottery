import { formatInTimeZone } from 'date-fns-tz';
import { appConfig } from '@/config/app';

/**
 * Storage is always UTC ISO-8601. Display always goes through these helpers so
 * the display zone (Asia/Bangkok by default) is applied consistently on server
 * and client — no hydration drift.
 */

export const DISPLAY_TZ = appConfig.displayTimeZone;

export function nowIso(): string {
  return new Date().toISOString();
}

export function toIso(value: Date | string | number): string {
  return new Date(value).toISOString();
}

export function formatDateTime(value: string | Date, tz: string = DISPLAY_TZ): string {
  return formatInTimeZone(new Date(value), tz, 'dd/MM/yyyy HH:mm');
}

export function formatDateTimeSeconds(value: string | Date, tz: string = DISPLAY_TZ): string {
  return formatInTimeZone(new Date(value), tz, 'dd/MM/yyyy HH:mm:ss');
}

export function formatDate(value: string | Date, tz: string = DISPLAY_TZ): string {
  return formatInTimeZone(new Date(value), tz, 'dd/MM/yyyy');
}

export function formatTime(value: string | Date, tz: string = DISPLAY_TZ): string {
  return formatInTimeZone(new Date(value), tz, 'HH:mm');
}

export function formatIsoDateKey(value: string | Date, tz: string = DISPLAY_TZ): string {
  return formatInTimeZone(new Date(value), tz, 'yyyy-MM-dd');
}

export function formatShortDay(value: string | Date, tz: string = DISPLAY_TZ): string {
  return formatInTimeZone(new Date(value), tz, 'dd/MM');
}

export interface CountdownParts {
  totalMs: number;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  expired: boolean;
}

export function countdownParts(targetIso: string, fromMs: number = Date.now()): CountdownParts {
  const totalMs = Math.max(0, new Date(targetIso).getTime() - fromMs);
  const totalSeconds = Math.floor(totalMs / 1000);
  return {
    totalMs,
    days: Math.floor(totalSeconds / 86400),
    hours: Math.floor((totalSeconds % 86400) / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60,
    expired: totalMs <= 0,
  };
}

export function formatCountdown(parts: CountdownParts): string {
  if (parts.expired) return 'ปิดรับแล้ว';
  const pad = (n: number) => String(n).padStart(2, '0');
  if (parts.days > 0) return `${parts.days} วัน ${pad(parts.hours)}:${pad(parts.minutes)}:${pad(parts.seconds)}`;
  return `${pad(parts.hours)}:${pad(parts.minutes)}:${pad(parts.seconds)}`;
}

export function addDays(iso: string, days: number): string {
  const date = new Date(iso);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString();
}

export function addMinutes(iso: string, minutes: number): string {
  return new Date(new Date(iso).getTime() + minutes * 60_000).toISOString();
}

export function startOfUtcDay(iso: string): string {
  const date = new Date(iso);
  date.setUTCHours(0, 0, 0, 0);
  return date.toISOString();
}

/** True when `iso` falls on the same Asia/Bangkok calendar day as `reference`. */
export function isSameDisplayDay(iso: string, referenceIso: string = nowIso()): boolean {
  return formatIsoDateKey(iso) === formatIsoDateKey(referenceIso);
}

export function relativeFromNow(iso: string, nowMs = Date.now()): string {
  const diff = nowMs - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return 'เมื่อสักครู่';
  if (minutes < 60) return `${minutes} นาทีที่แล้ว`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ชั่วโมงที่แล้ว`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} วันที่แล้ว`;
  return formatDate(iso);
}
