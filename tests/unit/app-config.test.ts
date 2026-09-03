import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * Regression tests for app URL resolution.
 *
 * A production deployment once failed at "Collecting page data" with
 * `TypeError: Invalid URL — input: ''` because NEXT_PUBLIC_APP_URL existed on the
 * hosting dashboard with an empty value, and `??` does not fall back on empty
 * strings, so `new URL('')` reached `metadataBase`. These tests pin the fix.
 *
 * `appConfig` reads the environment at module load, so each case resets the
 * module registry and re-imports.
 */
const ENV_KEYS = [
  'NEXT_PUBLIC_APP_URL',
  'NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL',
  'VERCEL_PROJECT_PRODUCTION_URL',
  'NEXT_PUBLIC_VERCEL_URL',
  'VERCEL_URL',
] as const;

async function loadConfig(env: Partial<Record<(typeof ENV_KEYS)[number], string>>) {
  vi.resetModules();
  for (const key of ENV_KEYS) delete process.env[key];
  for (const [key, value] of Object.entries(env)) process.env[key] = value;
  const configModule = await import('@/config/app');
  return configModule.appConfig;
}

afterEach(() => {
  for (const key of ENV_KEYS) delete process.env[key];
  vi.restoreAllMocks();
});

describe('appConfig.url', () => {
  it('uses an explicitly configured URL', async () => {
    const config = await loadConfig({ NEXT_PUBLIC_APP_URL: 'https://lottery.example.com' });
    expect(config.url).toBe('https://lottery.example.com');
  });

  it('treats an empty value as unset instead of throwing', async () => {
    const config = await loadConfig({ NEXT_PUBLIC_APP_URL: '' });
    expect(config.url).toBe('http://localhost:3000');
    expect(() => new URL(config.url)).not.toThrow();
  });

  it('treats a whitespace-only value as unset', async () => {
    const config = await loadConfig({ NEXT_PUBLIC_APP_URL: '   ' });
    expect(config.url).toBe('http://localhost:3000');
  });

  it('falls back to the Vercel production domain when no URL is configured', async () => {
    const config = await loadConfig({
      NEXT_PUBLIC_APP_URL: '',
      VERCEL_PROJECT_PRODUCTION_URL: 'online-lottery.vercel.app',
    });
    expect(config.url).toBe('https://online-lottery.vercel.app');
  });

  it('falls back to the per-deployment Vercel URL for previews', async () => {
    const config = await loadConfig({ VERCEL_URL: 'online-lottery-abc123.vercel.app' });
    expect(config.url).toBe('https://online-lottery-abc123.vercel.app');
  });

  it('prefers an explicit URL over the injected Vercel one', async () => {
    const config = await loadConfig({
      NEXT_PUBLIC_APP_URL: 'https://www.example.com',
      VERCEL_URL: 'online-lottery-abc123.vercel.app',
    });
    expect(config.url).toBe('https://www.example.com');
  });

  it('degrades to localhost on a malformed value rather than failing the build', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const config = await loadConfig({ NEXT_PUBLIC_APP_URL: 'ht!tp://not a url' });
    expect(config.url).toBe('http://localhost:3000');
    expect(warn).toHaveBeenCalled();
  });

  it('always produces a value that new URL() accepts', async () => {
    for (const value of ['', '   ', 'example.com', 'https://example.com/path?x=1']) {
      const config = await loadConfig({ NEXT_PUBLIC_APP_URL: value });
      expect(() => new URL(config.url)).not.toThrow();
    }
  });
});
