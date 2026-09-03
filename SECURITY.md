# Security

This document describes what the current phase actually does, and — just as
importantly — what it deliberately does **not** do yet.

> **This is a demo build.** It handles no real money and stores no real personal
> data. Do not point it at production users, and do not treat the controls below
> as sufficient for a real-money operation. See
> [Before real money](#before-real-money).

---

## Threat model for this phase

| In scope | Out of scope (this phase) |
| --- | --- |
| Privilege escalation between demo roles | KYC / AML / sanctions screening |
| Overdraft, double-spend, double-payout | Payment-provider fraud |
| Duplicate submission of money-moving actions | DDoS at the network layer |
| Session forgery and fixation | Physical / insider threat |
| Enumeration of accounts | Regulatory licensing |

---

## Authentication

- **Hashing** — scrypt (`node:crypto`), N=16384, r=8, p=1, 64-byte key, unique
  16-byte salt per password. The stored string is self-describing
  (`scrypt$N$r$p$salt$hash`), so parameters can be raised later without
  invalidating existing hashes. Verification uses `timingSafeEqual`.
- **Sessions** — HS256 JWT in a cookie that is `HttpOnly`, `SameSite=Lax`,
  `Secure` in production, `Path=/`, 8-hour lifetime. The token carries only
  `sub`, `username` and `roles`.
- **`AUTH_SECRET`** must be ≥32 characters. In production, a missing or short
  secret **throws at startup** rather than falling back to a development key.
- **Roles are re-read from storage on every request** (`getCurrentUser`). A token
  issued before a demotion cannot retain the old permissions, and a suspended or
  closed account is rejected even with a valid token.

### Account enumeration

Login returns the same message and does comparable work whether or not the email
exists. Password reset always reports success. Registration is the one place that
must tell the user a field is taken, which is an accepted trade-off.

---

## Authorization

`src/lib/permissions.ts` is the single source of truth. Roles are additive; the
effective permission set is the union across a user's roles.

| Permission | user | support | finance | admin | superadmin |
| --- | :-: | :-: | :-: | :-: | :-: |
| `user.view` | | ✓ | ✓ | ✓ | ✓ |
| `user.edit` | | | | ✓ | ✓ |
| `wallet.view` | | ✓ | ✓ | ✓ | ✓ |
| `wallet.adjust` | | | ✓ | ✓ | ✓ |
| `deposit.approve` | | | ✓ | ✓ | ✓ |
| `withdrawal.approve` | | | ✓ | ✓ | ✓ |
| `lottery.manage` | | | | ✓ | ✓ |
| `result.manage` | | | | ✓ | ✓ |
| `report.view` | | ✓ | ✓ | ✓ | ✓ |
| `audit.view` | | | ✓ | ✓ | ✓ |
| `bet.view` | | ✓ | ✓ | ✓ | ✓ |
| `settings.manage` | | | | | ✓ |

Enforcement rules:

- Every server action begins with `requireUser()`, `requireStaff()` or
  `requirePermission(...)`. Hiding a button is a UX affordance, never a control.
- The admin layout applies a coarse staff gate; each page and action still
  re-checks the specific permission it needs.
- An admin cannot change their own account status (prevents self-lockout and
  makes the audit trail meaningful).

---

## Input validation

Every input is validated with a Zod schema in `src/schemas/`, and the **same
schema** runs on the client (for feedback) and on the server (for enforcement).
There is deliberately no second copy of any rule.

Server-side, additionally:

- Bet prices are **recomputed from stored payout rates**. A client-supplied rate
  or payout is never trusted.
- Round acceptance is decided by `isRoundAcceptingBets()` against server time,
  re-checked immediately before the wallet is debited.
- Per-item and per-number stake limits are enforced from `bet_types`, counting
  bets already placed in the same round.

---

## Financial integrity

1. **One writer.** `WalletService` is the only code that changes a balance.
2. **Ledger invariant.** `balance == Σ(amount)` over completed transactions.
   Enforced by construction, asserted in tests, and checkable on demand from
   *Admin → กระเป๋าเงิน → ตรวจสอบเดี๋ยวนี้*.
3. **No overdraft.** A debit that would take the spendable balance below zero is
   rejected before anything is written.
4. **Optimistic concurrency.** Wallet writes are a compare-and-set on `version`;
   a lost race is retried from a fresh read (up to 5 attempts). This is correct
   across processes — the in-process keyed lock is only a latency optimisation.
   Verified by a test that fires 20 concurrent 100 THB debits at a 1,000 THB
   balance and asserts exactly 10 succeed and the balance never goes negative.
5. **Withdrawal hold model.** Funds leave the spendable balance at *request*
   time, not at approval. Debiting only on approval would let a user request a
   withdrawal and spend the same money on bets while it waits for review.
6. **Immutable confirmed bets.** Numbers, stakes and `rateAtBet` cannot be edited
   after confirmation — by anyone, including staff. Corrections are compensating
   ledger entries.
7. **Exactly-once settlement.** Three independent guards (single-run lock,
   status transition out of `confirmed`, and a reference-keyed win row) mean a
   second run pays nothing. Tested.

---

## Idempotency and duplicate submission

Money-moving actions require an idempotency key generated per user intent:
place bet, deposit, withdrawal request, deposit/withdrawal review, wallet
adjustment.

- First request executes and stores its response.
- Repeat with the same key returns the stored response.
- Repeat with the same key and a *different* payload is rejected (`CONFLICT`) —
  that is a client bug, and silently returning the wrong response would be worse.
- A failed attempt releases the key so the user can fix the input and retry.

The UI adds the second half of the protection: confirm buttons disable while a
request is in flight, and every confirmation generates a fresh key.

---

## Rate limiting

Budgets live in `src/providers/rate-limit.ts`:

| Action | Limit | Window |
| --- | --- | --- |
| Login | 8 | 5 min (per email) |
| Register | 5 | 1 hour (per IP) |
| Forgot password | 4 | 1 hour (per email) |
| Place bet | 60 | 1 min (per user) |
| Deposit | 15 | 5 min (per user) |
| Withdrawal | 6 | 1 hour (per user) |
| Admin action | 120 | 1 min (per staff user) |
| Admin sensitive | 20 | 1 min (per staff user) |

> **Known weakness.** The demo limiter is a per-instance fixed-window counter.
> With N serverless instances the effective limit is N × the configured value,
> and the window resets on cold start. Production must back this with Redis using
> an atomic sliding-window or token-bucket Lua script, plus an edge rate limiter
> for volumetric abuse. Per-account lockout on repeated login failure is also not
> implemented yet.

---

## Audit logging

Every action that touches money or privilege writes an audit record with actor,
role, action, resource, before/after snapshots, IP and user agent. Covered
actions include `USER_CREATE_BET`, `ADMIN_ADJUST_WALLET`,
`ADMIN_APPROVE_WITHDRAWAL`, `ADMIN_CREATE_RESULT`, `ADMIN_SETTLE_ROUND`,
`ADMIN_UPDATE_RATE`, `ADMIN_UPDATE_USER_STATUS` and `ADMIN_RESET_PASSWORD`.

Audit records are append-only and are never soft-deleted.

---

## Transport and headers

Set in `next.config.ts` for every response:

- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=(), interest-cohort=()`
- `poweredByHeader: false`

Vercel terminates TLS and serves HSTS. A strict `Content-Security-Policy` is
**not** yet applied — Next.js injects inline bootstrap scripts, so a correct CSP
needs per-request nonces. That is tracked as production work.

---

## Data handling

- Passwords are only ever stored hashed and never leave the server: the
  `PublicUser` projection has no `passwordHash` field, and DTOs are what cross
  the network.
- Bank account numbers are masked in list views (`maskAccountNumber`).
- All demo data is synthetic. Names are generated from Thai name *elements* and
  do not identify real people; emails use `example.com`.
- Errors are mapped to typed `AppError` codes; unexpected errors log
  server-side and return a generic message. No stack trace reaches the client.

---

## Before real money

Non-negotiable work before this system handles a single real baht:

1. Persistent, transactional storage (Prisma + PostgreSQL) with the wallet row
   locked inside the transaction.
2. Redis-backed rate limiting and account lockout.
3. Auth.js with refresh-token rotation, server-side revocation, argon2id, and
   enforced 2FA for all staff accounts.
4. Real password reset via single-use, expiring links. Remove the temporary
   password display from the admin reset flow entirely.
5. A licensed payment provider behind a `PaymentProvider` interface; deposits
   complete only on a signature-verified webhook, never on a client call.
6. Strict CSP with nonces; dependency and container scanning in CI.
7. Independent security review and penetration test.
8. KYC/AML, responsible-gambling controls, jurisdiction analysis and licensing.
9. Financial reconciliation job with alerting on any ledger drift.
10. Structured audit log shipping to append-only, tamper-evident storage.

## Reporting a vulnerability

This is a demo project. For the real deployment, publish a security contact and a
disclosure policy here before launch.
