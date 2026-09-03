/**
 * Rate limiting abstraction.
 *
 * The demo uses a per-instance fixed-window counter. That is deliberately NOT
 * production-grade: with N serverless instances the effective limit is N x the
 * configured value, and the window resets on cold start.
 *
 * PRODUCTION: back this with Redis using a sliding-window or token-bucket script
 * (`INCR` + `PEXPIRE` in one Lua call so it is atomic across instances), or an
 * edge rate limiter in front of the app. See SECURITY.md § Rate limiting.
 */

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  limit: number;
  /** Epoch ms when the current window resets. */
  resetAt: number;
  retryAfterSeconds: number;
}

export interface RateLimiter {
  consume(key: string, rule: RateLimitRule): Promise<RateLimitResult>;
  reset(key: string): Promise<void>;
}

export interface RateLimitRule {
  limit: number;
  windowSeconds: number;
}

/** Every protected action's budget lives here, not scattered across handlers. */
export const RATE_LIMITS = {
  login: { limit: 8, windowSeconds: 300 },
  register: { limit: 5, windowSeconds: 3600 },
  forgotPassword: { limit: 4, windowSeconds: 3600 },
  placeBet: { limit: 60, windowSeconds: 60 },
  deposit: { limit: 15, windowSeconds: 300 },
  withdrawal: { limit: 6, windowSeconds: 3600 },
  adminAction: { limit: 120, windowSeconds: 60 },
  adminSensitive: { limit: 20, windowSeconds: 60 },
} as const satisfies Record<string, RateLimitRule>;

export type RateLimitName = keyof typeof RATE_LIMITS;

interface Window {
  count: number;
  resetAt: number;
}

export function createMemoryRateLimiter(): RateLimiter {
  const windows = new Map<string, Window>();

  return {
    async consume(key, rule) {
      const now = Date.now();
      const existing = windows.get(key);
      const window =
        existing && existing.resetAt > now
          ? existing
          : { count: 0, resetAt: now + rule.windowSeconds * 1000 };

      window.count += 1;
      windows.set(key, window);

      // Opportunistic cleanup keeps the map from growing without bound.
      if (windows.size > 5000) {
        for (const [candidate, value] of windows) {
          if (value.resetAt <= now) windows.delete(candidate);
        }
      }

      const allowed = window.count <= rule.limit;
      return {
        allowed,
        remaining: Math.max(0, rule.limit - window.count),
        limit: rule.limit,
        resetAt: window.resetAt,
        retryAfterSeconds: Math.max(1, Math.ceil((window.resetAt - now) / 1000)),
      };
    },
    async reset(key) {
      windows.delete(key);
    },
  };
}

const GLOBAL_KEY = Symbol.for('elp.rateLimiter');

interface GlobalWithLimiter {
  [GLOBAL_KEY]?: RateLimiter;
}

export function getRateLimiter(): RateLimiter {
  const container = globalThis as unknown as GlobalWithLimiter;
  const existing = container[GLOBAL_KEY];
  if (existing) return existing;
  const created = createMemoryRateLimiter();
  container[GLOBAL_KEY] = created;
  return created;
}
