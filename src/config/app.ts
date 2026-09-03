/**
 * Central application configuration.
 *
 * Branding lives here (and in `src/config/brand.ts`) so the final brand name can
 * change without touching component source. Never import literal brand strings
 * into components — import from `brand.ts`.
 */

export type AppMode = 'mock' | 'live';

function readMode(): AppMode {
  const raw = process.env.NEXT_PUBLIC_APP_MODE;
  return raw === 'live' ? 'live' : 'mock';
}

export const appConfig = {
  /** `mock` runs the in-memory demo provider. `live` expects a real database. */
  mode: readMode(),
  /** Canonical public URL, used for absolute URLs in metadata. */
  url: process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000',
  /** All timestamps are stored in UTC; this is the default *display* zone. */
  displayTimeZone: 'Asia/Bangkok',
  locale: 'th-TH',
  currency: {
    code: 'THB',
    symbol: '฿',
    /** 1 THB = 100 satang. All money is stored as an integer number of satang. */
    minorUnitsPerUnit: 100,
  },
  session: {
    cookieName: 'elp_session',
    /** Seconds. */
    maxAge: 60 * 60 * 8,
  },
  pagination: {
    defaultPageSize: 20,
    pageSizeOptions: [10, 20, 50, 100],
    maxPageSize: 100,
  },
} as const;

export const isMockMode = appConfig.mode === 'mock';
