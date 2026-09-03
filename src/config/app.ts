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

const LOCAL_URL = 'http://localhost:3000';

/**
 * Resolves the canonical public URL.
 *
 * Three rules, each of which exists because of a real failure mode:
 *
 * 1. An env var that is DEFINED BUT EMPTY counts as unset. `??` only falls back
 *    on null/undefined, so `NEXT_PUBLIC_APP_URL=""` used to reach
 *    `new URL('')` in `metadataBase` and fail the production build during page
 *    data collection. Creating the variable and filling the value in later is a
 *    completely normal thing to do on a hosting dashboard, so it must not break
 *    the build.
 *
 * 2. On Vercel, fall back to the URL the platform already injects. That makes
 *    the variable optional for a standard deployment instead of a trap.
 *
 * 3. A malformed value degrades to localhost with a warning rather than taking
 *    the whole deployment down. A typo in one metadata field is not worth a
 *    failed build.
 */
function readUrl(): string {
  const candidates = [
    process.env.NEXT_PUBLIC_APP_URL,
    // Stable production domain, injected by Vercel.
    process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL,
    process.env.VERCEL_PROJECT_PRODUCTION_URL,
    // Per-deployment URL (preview builds).
    process.env.NEXT_PUBLIC_VERCEL_URL,
    process.env.VERCEL_URL,
  ];

  for (const candidate of candidates) {
    const value = candidate?.trim();
    if (!value) continue;
    const absolute = /^https?:\/\//i.test(value) ? value : `https://${value}`;

    let parsed: URL;
    try {
      parsed = new URL(absolute);
    } catch {
      console.warn(`[config] Ignoring invalid app URL: ${JSON.stringify(value)}`);
      continue;
    }

    // `new URL` is lenient — it happily accepts a hostname like "ht!tp" — so the
    // host is validated separately rather than trusted.
    const isHttp = parsed.protocol === 'http:' || parsed.protocol === 'https:';
    const hostLooksReal =
      /^[a-z0-9.-]+$/i.test(parsed.hostname) &&
      (parsed.hostname.includes('.') || parsed.hostname === 'localhost');

    if (isHttp && hostLooksReal) return parsed.origin;
    console.warn(`[config] Ignoring invalid app URL: ${JSON.stringify(value)}`);
  }

  return LOCAL_URL;
}

export const appConfig = {
  /** `mock` runs the in-memory demo provider. `live` expects a real database. */
  mode: readMode(),
  /** Canonical public URL, used for absolute URLs in metadata. Always valid. */
  url: readUrl(),
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
