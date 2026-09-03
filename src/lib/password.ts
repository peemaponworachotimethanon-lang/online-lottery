import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

/**
 * Password hashing — scrypt from the Node standard library.
 *
 * scrypt is memory-hard and ships with the runtime, so the demo has no native
 * dependency to compile. Format: `scrypt$N$r$p$saltHex$hashHex`, which is
 * self-describing so parameters can be raised later without invalidating stored
 * hashes (verify reads the parameters from the stored string).
 *
 * PRODUCTION NOTE: move this behind an auth provider (Auth.js + a managed
 * identity service, or argon2id via a native module) before real users exist,
 * and add per-account lockout on top of the rate limiter.
 */

const N = 16384;
const R = 8;
const P = 1;
const KEY_LENGTH = 64;

export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const derived = scryptSync(password.normalize('NFKC'), salt, KEY_LENGTH, { N, r: R, p: P });
  return `scrypt$${N}$${R}$${P}$${salt.toString('hex')}$${derived.toString('hex')}`;
}

/** Deterministic variant used only by the demo seeder so data stays reproducible. */
export function hashPasswordWithSalt(password: string, saltHex: string): string {
  const salt = Buffer.from(saltHex, 'hex');
  const derived = scryptSync(password.normalize('NFKC'), salt, KEY_LENGTH, { N, r: R, p: P });
  return `scrypt$${N}$${R}$${P}$${saltHex}$${derived.toString('hex')}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const n = Number(parts[1]);
  const r = Number(parts[2]);
  const p = Number(parts[3]);
  const saltHex = parts[4] ?? '';
  const hashHex = parts[5] ?? '';
  if (!Number.isFinite(n) || !Number.isFinite(r) || !Number.isFinite(p)) return false;

  const expected = Buffer.from(hashHex, 'hex');
  const actual = scryptSync(password.normalize('NFKC'), Buffer.from(saltHex, 'hex'), expected.length, {
    N: n,
    r,
    p,
  });
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
