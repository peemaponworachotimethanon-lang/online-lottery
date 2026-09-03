/**
 * Typed domain errors.
 *
 * Server entry points translate these into `ActionResult` payloads; nothing else
 * is allowed to leak a raw stack trace to the client.
 */

export type AppErrorCode =
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'VALIDATION'
  | 'CONFLICT'
  | 'INSUFFICIENT_FUNDS'
  | 'ROUND_CLOSED'
  | 'LIMIT_EXCEEDED'
  | 'RATE_LIMITED'
  | 'IDEMPOTENCY_IN_PROGRESS'
  | 'INTERNAL';

export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly details?: Record<string, string>;
  readonly httpStatus: number;

  constructor(
    code: AppErrorCode,
    message: string,
    options?: { details?: Record<string, string>; httpStatus?: number; cause?: unknown },
  ) {
    super(message, options?.cause !== undefined ? { cause: options.cause } : undefined);
    this.name = 'AppError';
    this.code = code;
    if (options?.details) this.details = options.details;
    this.httpStatus = options?.httpStatus ?? DEFAULT_STATUS[code];
  }
}

const DEFAULT_STATUS: Record<AppErrorCode, number> = {
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  VALIDATION: 422,
  CONFLICT: 409,
  INSUFFICIENT_FUNDS: 409,
  ROUND_CLOSED: 409,
  LIMIT_EXCEEDED: 422,
  RATE_LIMITED: 429,
  IDEMPOTENCY_IN_PROGRESS: 409,
  INTERNAL: 500,
};

export const unauthenticated = (message = 'กรุณาเข้าสู่ระบบ') =>
  new AppError('UNAUTHENTICATED', message);
export const forbidden = (message = 'คุณไม่มีสิทธิ์ในการดำเนินการนี้') =>
  new AppError('FORBIDDEN', message);
export const notFound = (message = 'ไม่พบข้อมูลที่ต้องการ') => new AppError('NOT_FOUND', message);
export const validation = (message: string, details?: Record<string, string>) =>
  new AppError('VALIDATION', message, details ? { details } : undefined);
export const conflict = (message: string) => new AppError('CONFLICT', message);
export const insufficientFunds = (message = 'ยอดเงินคงเหลือไม่เพียงพอ') =>
  new AppError('INSUFFICIENT_FUNDS', message);
export const roundClosed = (message = 'งวดนี้ปิดรับแทงแล้ว') => new AppError('ROUND_CLOSED', message);
export const limitExceeded = (message: string) => new AppError('LIMIT_EXCEEDED', message);
export const rateLimited = (message = 'ดำเนินการถี่เกินไป กรุณาลองใหม่อีกครั้ง') =>
  new AppError('RATE_LIMITED', message);

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

/** Discriminated result returned by every server action. */
export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; code: AppErrorCode; message: string; details?: Record<string, string> };

export function ok<T>(data: T): ActionResult<T> {
  return { ok: true, data };
}

export function fail(error: unknown): ActionResult<never> {
  if (isAppError(error)) {
    return error.details
      ? { ok: false, code: error.code, message: error.message, details: error.details }
      : { ok: false, code: error.code, message: error.message };
  }
  // Never surface internals to the client.
  console.error('[unhandled]', error);
  return { ok: false, code: 'INTERNAL', message: 'เกิดข้อผิดพลาดภายในระบบ' };
}
