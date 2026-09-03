# Performance architecture

The traffic shape this platform must survive is not steady load — it is a spike.
In the last minutes before a round closes, a large share of active users are on
one or two lottery pages, refreshing, and then submitting bets almost
simultaneously. Everything below is designed around that shape.

> **No capacity claim is made.** This document describes the architecture and the
> measurements that would justify a number. It does not state one, because no
> load test has been run against production-like infrastructure. See
> [`LOAD_TEST.md`](LOAD_TEST.md).

---

## Principles

1. **The application layer is stateless.** Every request derives what it needs
   from the session cookie and storage. Any instance can serve any request, so
   the tier scales horizontally.
2. **Reads and writes have different rules.** Public catalogue data may be
   cached and served slightly stale. Financial data is always read from the
   source of truth. The cache is never authoritative for a balance.
3. **Nothing unbounded runs inside a request.** Settlement, bulk notifications,
   reports and exports go to the queue.
4. **Payloads are projections.** Pages consume DTOs, not entities; lists are
   paginated server-side.

---

## Current measurements (this build)

From `pnpm build`:

| Metric | Value |
| --- | --- |
| Routes | 39 |
| Shared first-load JS | ~102 kB |
| Homepage first load | ~123 kB |
| Lottery detail (the hot page) | ~156 kB |
| Heaviest route (withdraw form) | ~183 kB |

Charts (Recharts) are `next/dynamic` with `ssr: false`, so the charting bundle
never loads on the betting or cashier paths. `optimizePackageImports` is enabled
for `lucide-react`, `recharts` and `date-fns` so barrel imports do not pull in
whole packages.

---

## Avoiding N+1

The list pages are where an N+1 quietly destroys a page, so every one of them
batches:

| Read | How it stays flat |
| --- | --- |
| Lottery cards | One catalogue read + **one** batched `findCurrentForLotteries` for all lotteries, instead of one query per lottery |
| Results list | One lottery map + one round map, then a pure projection |
| Bet lists | One username map, one bet-type map, one lottery map, one round map — four lookups regardless of page size |
| Transaction / deposit / withdrawal lists | One batched username map |
| Bet slip pricing | **One** `resolveMany` call for all rate lookups on the slip, not one per row |

Repository methods take explicit filter objects rather than arbitrary predicates,
so each one translates to an indexed SQL `WHERE` rather than a table scan.

---

## Database indexing

Every index in `prisma/schema.prisma` is derived from an actual query in
`src/repositories/`. None are speculative.

| Index | Query it serves |
| --- | --- |
| `users.email`, `users.username`, `users.phone` (unique) | Login and registration uniqueness |
| `users(status, createdAt desc)` | Admin user list, filtered by status, newest first |
| `wallet_transactions(userId, createdAt desc)` | The user's ledger — the single hottest authenticated read |
| `wallet_transactions(type, createdAt desc)` | Admin transaction browser filtered by type |
| `wallet_transactions(referenceType, referenceId)` | Reverse lookup from a bet/deposit/withdrawal to its ledger rows; also the exactly-once payout audit |
| `bets(userId, createdAt desc)` | User bet history |
| `bets(roundId, status)` | **Settlement**: eligible bets for a round. The most important index in the schema |
| `bets(lotteryId, createdAt desc)` | Admin bet browser filtered by lottery |
| `bet_items(betId)` | Loading a slip's rows |
| `bet_items(betTypeCode, number)` | Exposure report: total stake on one number |
| `lottery_rounds(lotteryId, closeAt)` | "Current round for this lottery" and "closing soon" |
| `lottery_rounds(status, resultAt)` | Settlement worker scanning for rounds to settle |
| `payout_rates(betTypeCode, lotteryId, isActive, effectiveFrom desc)` | Rate resolution — most specific active row wins |
| `lottery_results(lotteryId, announcedAt desc)` | Results page per lottery |
| `deposits(status, createdAt desc)`, `withdrawals(status, createdAt desc)` | Admin review queues |
| `deposits(userId, status)`, `withdrawals(userId, status)` | A user's own cashier history |
| `audit_logs(actorId, createdAt desc)`, `(resource, resourceId)`, `(action, createdAt desc)` | The three ways the audit log is actually searched |
| `idempotency_records(expiresAt)` | Purge job |

**What is deliberately not indexed:** free-text description fields, low-cardinality
booleans on their own, and every column of every table. Each index costs write
throughput on the hot path, and bet placement is a write.

Planned additions once real query patterns are observed:
- A partial index on `bets(roundId) WHERE status = 'confirmed'` if settlement
  scans become the bottleneck.
- BRIN on `wallet_transactions(createdAt)` once the table is large and mostly
  append-only.

---

## Database connections

Serverless creates many short-lived instances, each wanting its own connection.
PostgreSQL's connection limit is small (often 100–500), so an unpooled setup
exhausts it long before CPU is the constraint.

**Rule: never open unbounded connections from serverless functions.**

Recommended options, any one of which is sufficient:

| Option | Notes |
| --- | --- |
| **PgBouncer** (transaction mode) | Self-hosted standard. Set `DATABASE_URL` to the pooler and `DIRECT_URL` to the unpooled port so `prisma migrate` works. Prepared statements must be disabled (`?pgbouncer=true`). |
| **Neon pooled connection** | Built-in PgBouncer; use the `-pooler` host for `DATABASE_URL`. |
| **Supabase pooler** | Port 6543 for pooled, 5432 for direct. |
| **Prisma Accelerate** | Managed pooling plus an optional query cache; simplest for Vercel. |

The schema already declares `directUrl`, so migrations bypass the pooler.

Additional guidance:
- Keep `connection_limit` per instance low (1–5). Many instances × few
  connections is the correct shape.
- Run the settlement worker as a long-lived process with its own, larger pool —
  not as a serverless function.
- Put read-only reporting on a replica once reports start competing with the
  betting path.

---

## Cache

`src/providers/cache.ts` defines the abstraction. The demo uses an in-process TTL
map with **stampede protection** (concurrent misses for one key collapse into a
single loader call). Production swaps in Redis behind the same interface.

| Key | TTL | Why that TTL |
| --- | --- | --- |
| `lottery:list:v1` | 300 s | Catalogue changes are admin-driven and explicitly invalidated |
| `lottery:{id}:round:current:v1` | 15 s | Bounded staleness; the countdown is recomputed client-side from `closeAt`, so a slightly stale round record does not show a wrong timer |
| `lottery:{id}:rates:v1` | 120 s | Rates change rarely and are invalidated on write |
| `results:latest:v1` | 30 s | Invalidated the moment a result is published |
| `stats:public:v1` | 60 s | Cosmetic counters |

**Invalidation contract.** Every admin mutation calls exactly one of
`invalidateCatalogue()`, `invalidateRates()`, `invalidateResults()` or
`invalidateRounds()`. Keeping them in one module is what prevents "which keys do
I clear?" bugs. Keys are versioned (`:v1`) so a shape change is a rename rather
than a stale-read incident.

**Hard rule: Redis is never the authoritative wallet balance.** Balances, ledger
rows, bets and settlement state are always read from the database. Only public,
reconstructible data is cached.

---

## Queue

`src/providers/queue.ts` defines `JobQueue`. The demo provider runs handlers
in-process so the flows are observable; production uses **BullMQ + Redis** with a
dedicated worker process.

| Job | Why it must not run in a request |
| --- | --- |
| `settle-round` | A round with 100k bets would exceed any request budget and hold a connection for minutes |
| `settle-round-batch` | Chunked continuation for very large rounds |
| `broadcast-notification` | Fan-out to every active user |
| `generate-report`, `export-data` | Long scans |
| `send-email` | External I/O with its own failure modes |
| `analytics-rollup` | Nightly aggregation; also purges expired idempotency records |

Settlement already processes bets in batches of 200 and the admin console can
dispatch it to the queue (`settleRoundAction(roundId, 'queue')`), which returns
immediately with a job id.

---

## Hot path: placing a bet

This is the only latency-critical write, so it is worth stating exactly what it
does:

1. Load round → reject if not accepting bets (server time).
2. Load lottery, bet types (one batched call), rates (one batched call).
3. Validate and price every row; check per-number exposure.
4. `WalletService.debit` — read wallet, CAS on `version`, append one ledger row.
5. Persist the bet with its items.
6. Fire notification and audit record.

Steps 4–5 are two writes that production must wrap in a single transaction. The
in-process keyed lock serialises same-wallet requests on one instance to avoid
burning CAS retries; correctness does not depend on it.

---

## Scaling checklist, in order

1. Move to PostgreSQL with a connection pooler. *(Blocking — everything else is
   theoretical until this is done.)*
2. Redis for cache and rate limiting.
3. BullMQ worker for settlement and fan-out.
4. Read replica for reporting.
5. CDN/edge caching for public pages (they are already `revalidate`-friendly).
6. Only then, run the k6 suite on production-like infrastructure and publish
   measured numbers.
