# Emerald Lottery Platform

> **Working name only.** Every user-visible brand string lives in
> `src/config/brand.ts`. Renaming the product is a one-file change.

A fully interactive **mock / demo** online lottery platform, built so it can grow
into a production system without a rewrite. The demo behaves like a real product
end to end — login, deposit, bet, settle, withdraw, admin review — but it
integrates **no real-money payment system** and moves **no real money**.

Design system: **Emerald Wealth** (เขียวเหนี่ยวทรัพย์) — emerald primary, deep
forest secondary, champagne gold reserved for winnings and rewards.

---

## Table of contents

- [Features](#features)
- [Tech stack](#tech-stack)
- [Architecture](#architecture)
- [Folder structure](#folder-structure)
- [Getting started](#getting-started)
- [Environment](#environment)
- [Mock mode](#mock-mode)
- [Demo credentials](#demo-credentials)
- [Demo flows to try](#demo-flows-to-try)
- [Data model](#data-model)
- [Testing](#testing)
- [Build](#build)
- [Deploying to Vercel](#deploying-to-vercel)
- [Known limitations](#known-limitations)
- [Production roadmap](#production-roadmap)

---

## Features

**Player**

- Public homepage, lottery catalogue, lottery detail with payout table and rules
- Fast bet entry: pick type → type number → type amount → Enter, with quick picks
  (สุ่มเลข, กลับเลข, เลขตอง/เลขเบิ้ล, รูดหน้า/รูดหลัง) and an on-screen keypad on mobile
- Bet slip with per-row edit, duplicate, delete, clear-all, live totals and
  balance-after preview; sticky bottom summary on mobile, side panel on desktop
- Ledger-backed wallet, mock QR / bank-transfer deposit, withdrawal requests
- Dashboard with 7-day charts, bet history, transaction history, notifications
- Account area: profile, security (password + login history), settings
- Results browser with lottery and date filters
- Light / dark theme, Thai-language UI, Asia/Bangkok display timezone

**Staff**

- Separate admin console with sidebar (desktop) and drawer (mobile/tablet)
- Dashboard KPIs and charts; operational report
- User management with search, filter, sort, pagination, detail view, suspend,
  mock password reset, and audited wallet adjustment
- Lottery, round, bet type and payout rate management (all data-driven)
- Bet browser (read-only — confirmed bets are immutable)
- Result entry with settlement preview, then idempotent settlement
- Deposit and withdrawal review queues with safe wallet state transitions
- Transaction browser with server-side pagination
- Notification broadcast (queued, not inline), audit log, system settings
- On-demand ledger integrity check

---

## Tech stack

| Layer | Choice |
| --- | --- |
| Framework | Next.js 15 (App Router, Server Components, Server Actions) |
| Language | TypeScript 5.9, `strict` + `noUncheckedIndexedAccess` |
| UI | React 19, Tailwind CSS v4, shadcn/ui-style components on Radix primitives |
| Icons | lucide-react |
| Forms | React Hook Form + Zod (one schema, used by client and server) |
| Client state | Zustand (bet slip only) |
| Charts | Recharts, lazily loaded and client-only |
| Toasts | sonner |
| Auth | HS256 JWT in an HttpOnly cookie (`jose`) |
| Data (demo) | In-memory repository provider with a deterministic seed |
| Data (production) | Prisma + PostgreSQL — schema authored in `prisma/schema.prisma` |
| Tests | Vitest (unit + integration) and a Playwright end-to-end smoke script |
| Load tests | k6 |
| Package manager | pnpm |

---

## Architecture

```
            ┌──────────────────────────────────────────────┐
  browser   │  app/  — server components, server actions   │
            └───────────────┬──────────────────────────────┘
                            │  DTOs only (never entities)
            ┌───────────────▼──────────────────────────────┐
            │  services/  — application + domain logic      │
            │  WalletService · BetService · Settlement      │
            │  Cashier · Auth · Catalog · Query · Reporting │
            └───────────────┬──────────────────────────────┘
                            │  repository interfaces
            ┌───────────────▼──────────────────────────────┐
            │  repositories/  — contracts.ts                │
            │    memory/   (demo)   │   prisma/ (production)│
            └───────────────┬──────────────────────────────┘
                            │
            ┌───────────────▼──────────────────────────────┐
            │  providers/  — cache · queue · rate limit ·   │
            │                lock  (swappable: Redis/BullMQ)│
            └──────────────────────────────────────────────┘
```

Rules that keep the boundaries honest:

1. **No component ever imports a mock array.** UI talks to services; services talk
   to repository interfaces; only `src/repositories/index.ts` knows which provider
   is bound.
2. **`WalletService` is the only code allowed to change a balance.** Every change
   writes exactly one ledger row recording `balanceBefore` / `balanceAfter`.
3. **Domain rules live in `src/lib/lottery-rules.ts`** — pure functions, no I/O,
   unit tested directly. "Does this number win?" has exactly one implementation.
4. **Authorization is server-side.** `src/lib/permissions.ts` is the single source
   of truth; every action calls `requirePermission`. Hiding a button is UX, not
   security.
5. **Validation is written once** in `src/schemas/` and used by both the client
   form and the server action.

### Money

Money is an **integer number of satang** (1 THB = 100 satang) everywhere —
`src/lib/money.ts`. No floating point touches a balance. In PostgreSQL these are
`BIGINT`. Payout rates are stored as `rate × 1000` so a rate like x92.5 is an
exact integer. The rationale is documented at the top of `src/lib/money.ts`.

### Time

All timestamps are stored in UTC ISO-8601. Display conversion to **Asia/Bangkok**
happens only at the presentation edge (`src/lib/datetime.ts`). Round open/close
status is always recomputed from server time — a stale status column can never
let a bet through after close.

### Idempotency

Every money-moving entry point takes an idempotency key: place bet, deposit,
withdrawal request, withdrawal/deposit review, wallet adjustment. A repeated key
returns the stored response instead of executing again; a repeated key with a
*different* payload is rejected as a client bug. Settlement has its own guard (see
below).

### Settlement

`settleLotteryRound()` is idempotent behind three independent guards:

1. a single-run lock per round,
2. only `confirmed` bets are selected, and settlement moves them out of that
   state,
3. every win credit carries `referenceType='bet'` + `referenceId`, so a
   reconciliation job can assert at most one `win` row per bet.

Bets are processed in batches, and the admin console can dispatch settlement to
the job queue (`settle-round`) rather than running it inside the HTTP request.

---

## Folder structure

```
prisma/schema.prisma        Production PostgreSQL schema, indexes, and rationale
loadtest/                   k6 config and six scenarios
scripts/                    Demo-data verification, Playwright smoke test
tests/                      Vitest unit + integration tests
src/
  app/
    (public)/               Home, lotteries, lottery detail, results, help
    (auth)/                 Login, register, forgot password
    (app)/                  Dashboard, wallet, bet slip, account (auth required)
    admin/                  Admin console (staff only)
    error.tsx not-found.tsx unauthorized/ forbidden/
  components/
    ui/                     Design-system primitives (button, dialog, table, …)
    layout/                 Header, footer, navigation, admin shell, theme
    charts/                 Recharts wrappers + lazy loaders
  features/
    betting/                Bet pad, bet slip, betting board
    lottery/                Lottery card, result card, filters
    wallet/                 Deposit and withdrawal forms, mock QR
    account/                Profile, security, notification list
    admin/                  Admin forms, review actions, result console
    marketing/              FAQ
  services/                 Application + domain services, composition root
  repositories/             contracts.ts + memory/ provider
  providers/                cache, queue, rate-limit, lock abstractions
  schemas/                  Zod schemas (auth, betting, admin)
  server/                   Session, request context, server actions
  lib/                      money, datetime, permissions, lottery-rules, errors…
  stores/                   Zustand bet-slip store
  config/                   app, brand, demo credentials
  mocks/                    Catalogue seed input, name pools, seeder
  types/                    Domain entities and DTOs
```

---

## Getting started

Requirements: **Node 20+** and **pnpm 9+**.

```bash
pnpm install
cp .env.example .env.local     # optional for local dev; see below
pnpm dev                       # http://localhost:3000
```

No database or Redis is required in mock mode.

### Scripts

| Command | What it does |
| --- | --- |
| `pnpm dev` | Development server |
| `pnpm build` | Production build |
| `pnpm start` | Serve the production build |
| `pnpm lint` | ESLint (next/core-web-vitals + next/typescript, `no-explicit-any` on) |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm test` | Vitest unit + integration suite |
| `pnpm seed:reset` | Rebuild the seeded dataset and verify the ledger invariant |
| `pnpm loadtest` | k6 peak-traffic scenario (requires k6 installed) |

End-to-end smoke test (needs a running server). Playwright is intentionally not
a declared dependency — it ships a browser-downloading postinstall that would
slow every CI and Vercel install — so add it only when you want to run the smoke
test:

```bash
pnpm add -D playwright && pnpm exec playwright install chromium
pnpm build && pnpm start -p 3111 &
pnpm smoke http://localhost:3111
```

---

## Environment

See `.env.example`. In mock mode only these matter:

| Variable | Required | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_APP_MODE` | no | `mock` (default) or `live` |
| `NEXT_PUBLIC_APP_URL` | no | Absolute URL used in metadata. On Vercel this is derived from the platform automatically — an empty or invalid value is treated as unset, never a build failure |
| `AUTH_SECRET` | **in production** | ≥32 chars, HS256 signing key. `openssl rand -base64 48` |

`DATABASE_URL`, `DIRECT_URL` and `REDIS_URL` are unused in mock mode and are
documented for the production path. Never commit a real `.env`.

---

## Mock mode

`NEXT_PUBLIC_APP_MODE=mock` binds the repository interfaces to an **in-memory
provider** seeded deterministically at startup (`src/mocks/seed.ts`). The seed is
generated relative to "now", so the demo always has genuinely open, closing-soon
and historical rounds whenever you start it.

Seeded volume:

| Entity | Count |
| --- | --- |
| Users (incl. 4 demo accounts) | 54 |
| Lotteries | 9 |
| Rounds | 192 |
| Bet types | 6 |
| Payout rates | 6 |
| Bet slips | 129 |
| Wallet transactions | 279 |
| Deposits | 90 |
| Withdrawals | 34 |
| Notifications | 62 |
| Audit logs | 110 |
| Login events | 131 |

Names are synthetic Thai-style combinations and do not refer to real people.

Setting `NEXT_PUBLIC_APP_MODE=live` deliberately **throws at startup** until a
persistent provider is wired in — a deployment must never silently serve demo
data while believing it is talking to a real database.

---

## Demo credentials

Demo-only, intentionally public, and printed on the login page.

| Role | Email | Password |
| --- | --- | --- |
| Player | `demo@example.com` | `Demo1234!` |
| Admin / superadmin | `admin@example.com` | `Admin1234!` |
| Finance | `finance@example.com` | `Finance1234!` |
| Support | `support@example.com` | `Support1234!` |

The demo player starts with exactly **฿10,000.00**.

---

## Demo flows to try

**1 — Deposit**
Log in as the player → *กระเป๋าเงิน → ฝากเงิน* → 1,000 → *จำลองการชำระเงินสำเร็จ*.
Balance goes 10,000 → 11,000 and a ledger row appears in
*บัญชีของฉัน → ประวัติธุรกรรม*.

**2 — Place a bet**
*หวยทั้งหมด → หวยรัฐบาลไทย* → 3 ตัวบน → `123` → `100` → Enter → *ยืนยันการแทง*.
The slip previews ฿85,000 (100 × 850). The wallet drops by exactly 100, the bet
appears in *ประวัติการแทง*, and a `bet` ledger row is written.

**3 — Result and settlement**
Log in as admin → *ผลรางวัลและเคลียร์* → pick that round → 3 ตัวบน `123`, 2 ตัวล่าง
`45` → *บันทึกผลรางวัล* → *ดูตัวอย่างผลการเคลียร์* → *เคลียร์รางวัลและจ่ายเงิน*.
The bet becomes *ถูกรางวัล*, a `win` ledger row is created, and ฿85,000 lands in
the wallet. Running settlement again reports "already settled" and pays nothing.

**4 — Withdrawal**
Player → *ถอนเงิน* → 5,000 → submit. The amount leaves the spendable balance
immediately and appears under *กันไว้*. Admin → *การถอนเงิน* → *อนุมัติ*. The hold
is released, the ledger stays consistent, and an audit record exists.

**Bonus** — Admin → *กระเป๋าเงิน* → *ตรวจสอบเดี๋ยวนี้* runs the ledger invariant
check across every wallet on the platform.

---

## Data model

Full schema with indexes and rationale: [`prisma/schema.prisma`](prisma/schema.prisma).

| Aggregate | Tables |
| --- | --- |
| Identity | `users`, `roles`, `permissions`, `role_permissions`, `user_roles`, `login_events` |
| Wallet | `wallets`, `wallet_transactions` |
| Catalogue | `lotteries`, `lottery_rounds`, `bet_types`, `payout_rates` |
| Betting | `bets`, `bet_items` |
| Results | `lottery_results` |
| Cashier | `deposits`, `withdrawals` |
| Platform | `notifications`, `audit_logs`, `idempotency_records` |

Every table carries `createdAt` / `updatedAt`; entities that may need to be seen
after removal carry `deletedAt` (soft delete). Immutable financial records —
wallet transactions, audit logs, results — are never deleted; they are corrected
with compensating entries.

---

## Testing

```
pnpm test
```

66 tests across 8 files, all passing:

| File | Covers |
| --- | --- |
| `unit/money.test.ts` | Satang conversion, exact rate application, rounding never over-pays |
| `unit/lottery-rules.test.ts` | Every match strategy, round status from server time, quick-pick helpers |
| `unit/permissions.test.ts` | Role → permission matrix, role unions, anonymous denial |
| `unit/providers.test.ts` | Cache read-through and stampede collapse, rate limiting, keyed lock, queue, idempotency |
| `integration/wallet.test.ts` | Ledger invariant, overdraft refusal, **20 concurrent debits against a 1,000 balance** |
| `integration/betting.test.ts` | Quote pricing, immutable bets, idempotent placement, closed-round rejection, per-number limits, concurrent bets |
| `integration/settlement.test.ts` | Win/lose evaluation, exactly-once payout, duplicate settlement, `rateAtBet` immutability, preview |
| `integration/cashier.test.ts` | Deposit idempotency, hold/debit/release, double-review refusal, audited adjustment |

Plus `scripts/smoke.mjs` — a Playwright run over the real UI covering all four
demo scenarios, every admin page, the ledger check, and mobile layout at 390px.

---

## Build

```
pnpm lint && pnpm typecheck && pnpm test && pnpm build
```

All four pass. The production build emits 39 routes; shared first-load JS is
~102 kB, and the heaviest route is ~183 kB first load. Charts are code-split so
they never load on the betting path.

---

## Deploying to Vercel

1. Push the repository to GitHub/GitLab/Bitbucket.
2. Import the project in Vercel. The framework preset (Next.js), build command
   (`pnpm build`) and output are detected automatically.
3. Set environment variables in **Project → Settings → Environment Variables**:
   - `AUTH_SECRET` — **required**. `openssl rand -base64 48`. Without it, pages
     render but signing in fails: the code refuses to fall back to a development
     key in production.
   - `NEXT_PUBLIC_APP_MODE` — leave as `mock` for the demo
   - `NEXT_PUBLIC_APP_URL` — optional; Vercel's own URL is used when it is absent

   Environment variables only apply to builds that run *after* they are saved, so
   redeploy once after adding them.
4. Deploy.

No database, Redis or queue worker is needed for the demo deployment. Read
[Known limitations](#known-limitations) before showing it to a customer — the
in-memory store behaves differently on serverless than it does locally.

---

## Known limitations

These are honest limits of the current phase, not bugs.

1. **Demo state is per-instance and non-durable.** The in-memory provider lives
   in the server process. On Vercel, a cold start or a request routed to a
   different instance sees the freshly seeded dataset again, so a deposit made a
   minute ago can appear to vanish. Within one warm instance the flows are fully
   consistent. Fix: implement the Prisma provider.
2. **No real payments.** Deposits complete instantly with no provider; the QR is
   a deliberately non-scannable placeholder.
3. **Rate limiting is per-instance.** With N instances the effective limit is
   N × the configured value. Needs Redis in production.
4. **The cache is per-instance** for the same reason. It only holds public,
   reconstructible data, so this is a hit-rate issue, not a correctness one.
5. **The queue runs in-process.** Jobs execute on the same instance that enqueued
   them and do not survive a restart. Needs BullMQ + Redis and a worker process.
6. **Password reset is mocked** — no email is sent, and the admin reset shows a
   temporary password to the operator, which a real system must never do.
7. **Two-factor authentication is a stored flag only**, not enforced.
8. **No capacity claim is made.** The k6 scripts exist, but no load test has been
   run against production-like infrastructure, so this project states no
   concurrent-user figure. See `LOAD_TEST.md`.
9. **Cross-aggregate writes are not transactional** in the memory provider. Bet
   placement compensates with a refund ledger entry if persistence fails after
   the debit; production must wrap both in one database transaction.
10. **Admin catalogue changes are not versioned.** Editing a bet type changes it
    in place; only payout rates keep effective-dated history.

---

## Production roadmap

**Phase A — persistence (blocking)**

- Implement `createPrismaRepositories()` against `RepositoryBundle`, wire it in
  `src/repositories/index.ts`, and run the existing test suite against it.
- Wrap bet placement, settlement and cashier operations in database transactions
  with `SELECT … FOR UPDATE` on the wallet row (or keep the optimistic `version`
  CAS, which is already correct across processes).
- Move `idempotency_records` to the database with `INSERT … ON CONFLICT`.
- Add a pooled connection (PgBouncer / Neon / Supabase / Prisma Accelerate) —
  see `PERFORMANCE.md`.

**Phase B — infrastructure**

- Redis-backed cache, rate limiter (atomic Lua), and BullMQ queue + worker.
- Scheduled jobs: settlement dispatch, idempotency purge, ledger reconciliation.

**Phase C — security and compliance**

- Auth.js with refresh-token rotation and server-side revocation; argon2id.
- Real password reset (single-use, expiring links), enforced 2FA for staff.
- KYC, AML monitoring, responsible-gambling limits, and the licensing work that
  real-money operation requires.

**Phase D — payments**

- Integrate a licensed payment provider behind a `PaymentProvider` interface;
  deposits complete only on a verified, signed webhook.

**Phase E — operations**

- Structured logging, tracing, error reporting, uptime and financial alerting.
- Run the k6 suite on production-like infrastructure and only then publish
  capacity numbers.

See also [`SECURITY.md`](SECURITY.md), [`PERFORMANCE.md`](PERFORMANCE.md) and
[`LOAD_TEST.md`](LOAD_TEST.md).
