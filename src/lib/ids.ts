/**
 * Identifier helpers.
 *
 * Application-generated ids are prefixed ULID-ish strings: monotonic (sortable by
 * creation time), collision-resistant, and readable in logs. In PostgreSQL the
 * same values are stored as `TEXT` primary keys, which keeps the demo provider and
 * the production provider byte-identical.
 */

const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

function randomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  globalThis.crypto.getRandomValues(bytes);
  return bytes;
}

function encodeTime(time: number, length: number): string {
  let out = '';
  let value = time;
  for (let i = length - 1; i >= 0; i--) {
    out = ALPHABET[value % 32] + out;
    value = Math.floor(value / 32);
  }
  return out;
}

function encodeRandom(length: number): string {
  const bytes = randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i++) out += ALPHABET[(bytes[i] ?? 0) % 32];
  return out;
}

export function ulid(now: number = Date.now()): string {
  return encodeTime(now, 10) + encodeRandom(16);
}

export function id(prefix: string, now?: number): string {
  return `${prefix}_${ulid(now)}`;
}

const REFERENCE_ALPHABET = '0123456789ABCDEFGHJKLMNPQRSTUVWXYZ';

/** Short human-quotable reference, e.g. `BET-7K3Q9X2M`. */
export function reference(prefix: string, size = 8): string {
  const bytes = randomBytes(size);
  let out = '';
  for (let i = 0; i < size; i++) out += REFERENCE_ALPHABET[(bytes[i] ?? 0) % REFERENCE_ALPHABET.length];
  return `${prefix}-${out}`;
}
