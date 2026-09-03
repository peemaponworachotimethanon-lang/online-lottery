import { createHash } from 'node:crypto';
import { AppError } from '@/lib/errors';
import { nowIso } from '@/lib/datetime';
import { stableStringify } from '@/lib/utils';
import type { RepositoryBundle } from '@/repositories/contracts';

/**
 * Idempotency for money-moving operations.
 *
 * Contract: the caller supplies a key (generated once on the client, per attempt
 * of a user intent — NOT per retry). The first request with that key executes and
 * stores its response; every later request with the same key returns the stored
 * response instead of executing again. A double-clicked "confirm" button, a
 * retried fetch, and a duplicated webhook all collapse to one effect.
 *
 * A mismatched payload under the same key is a client bug and is rejected, rather
 * than silently returning the wrong response.
 */

export const IDEMPOTENCY_TTL_SECONDS = 24 * 3600;

export interface IdempotentOutcome<T> {
  data: T;
  replayed: boolean;
}

export class IdempotencyService {
  constructor(private readonly repos: RepositoryBundle) {}

  private hash(payload: unknown): string {
    return createHash('sha256').update(stableStringify(payload)).digest('hex');
  }

  async run<T>(
    options: { key: string; scope: string; userId: string | null; payload: unknown },
    operation: () => Promise<T>,
  ): Promise<IdempotentOutcome<T>> {
    const requestHash = this.hash(options.payload);
    const now = Date.now();

    const { claimed, existing } = await this.repos.idempotency.claim({
      key: `${options.scope}:${options.key}`,
      scope: options.scope,
      userId: options.userId,
      requestHash,
      status: 'in-progress',
      responseJson: null,
      createdAt: nowIso(),
      completedAt: null,
      expiresAt: new Date(now + IDEMPOTENCY_TTL_SECONDS * 1000).toISOString(),
    });

    if (!claimed && existing) {
      if (existing.requestHash !== requestHash) {
        throw new AppError('CONFLICT', 'คีย์ idempotency ถูกใช้กับข้อมูลอื่นแล้ว');
      }
      if (existing.status === 'in-progress') {
        throw new AppError('IDEMPOTENCY_IN_PROGRESS', 'รายการนี้กำลังดำเนินการอยู่ กรุณารอสักครู่');
      }
      return {
        data: JSON.parse(existing.responseJson ?? 'null') as T,
        replayed: true,
      };
    }

    try {
      const data = await operation();
      await this.repos.idempotency.complete(`${options.scope}:${options.key}`, JSON.stringify(data));
      return { data, replayed: false };
    } catch (error) {
      // Failed attempts must not poison the key — the user should be able to fix
      // the input and retry with the same intent.
      await this.repos.idempotency.release(`${options.scope}:${options.key}`);
      throw error;
    }
  }

  async purge(): Promise<number> {
    return this.repos.idempotency.purgeExpired(nowIso());
  }
}
