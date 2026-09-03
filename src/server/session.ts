import { cookies } from 'next/headers';
import { SignJWT, jwtVerify } from 'jose';
import { appConfig } from '@/config/app';
import type { RoleName } from '@/types/domain';

/**
 * Session handling.
 *
 * A signed (HS256) JWT in an HttpOnly, SameSite=Lax, Secure-in-production cookie.
 * The token carries only an id and roles — never a balance, never a permission
 * list — so a stale token can widen nothing: authorization is always recomputed
 * server-side from the stored user record.
 *
 * PRODUCTION: swap for Auth.js with rotating refresh tokens and server-side
 * session revocation. The rest of the app depends only on `getSessionUser()`.
 */

export interface SessionPayload {
  sub: string;
  roles: RoleName[];
  username: string;
}

const DEV_SECRET = 'development-only-insecure-secret-change-me-please-32';

function secretKey(): Uint8Array {
  const raw = process.env.AUTH_SECRET;
  if (!raw || raw.length < 32) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('AUTH_SECRET must be set to at least 32 characters in production');
    }
    return new TextEncoder().encode(DEV_SECRET);
  }
  return new TextEncoder().encode(raw);
}

export async function createSessionToken(payload: SessionPayload): Promise<string> {
  return new SignJWT({ roles: payload.roles, username: payload.username })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(`${appConfig.session.maxAge}s`)
    .sign(secretKey());
}

export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey(), { algorithms: ['HS256'] });
    if (typeof payload.sub !== 'string') return null;
    const roles = Array.isArray(payload.roles) ? (payload.roles as RoleName[]) : [];
    return {
      sub: payload.sub,
      roles,
      username: typeof payload.username === 'string' ? payload.username : '',
    };
  } catch {
    return null;
  }
}

export async function setSessionCookie(payload: SessionPayload): Promise<void> {
  const token = await createSessionToken(payload);
  const store = await cookies();
  store.set(appConfig.session.cookieName, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: appConfig.session.maxAge,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.delete(appConfig.session.cookieName);
}

export async function readSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  const token = store.get(appConfig.session.cookieName)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}
