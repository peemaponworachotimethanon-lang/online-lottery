# Load testing

## The rule

**This project makes no claim about how many concurrent users it supports.**

Not "tens of thousands", not any other number. A capacity figure is only
meaningful when it names the infrastructure it was measured on, the traffic mix,
the latency budget it held, and the date. Until the suite below has been run
against production-like infrastructure, the honest answer to "how many users can
it handle?" is *we have not measured it yet*.

What we can say today: the architecture is stateless at the application tier, the
hot read paths are batched and cacheable, and the one hot write path is a single
wallet CAS plus one ledger row. Those are the properties that make a system
scalable. They are not a measurement.

---

## Scripts

```
loadtest/
  config.js                    Shared profile, thresholds, ramping stages
  scenarios/
    browse-public.js           Anonymous browsing — the baseline
    current-round.js           Everyone on one lottery page before close
    login.js                   Login storm (CPU bound by design — scrypt)
    place-bet.js               The write path
    transaction-history.js     Authenticated paginated financial read
    mixed-peak.js              Realistic pre-close traffic mix
```

Install k6: <https://k6.io/docs/get-started/installation/>

---

## Running

```bash
# Baseline, 100 virtual users, against a local production build
k6 run -e VUS=100 -e BASE_URL=http://localhost:3000 loadtest/scenarios/browse-public.js

# The scenario that matters — realistic peak mix
k6 run -e VUS=1000 -e BASE_URL=https://your-deployment loadtest/scenarios/mixed-peak.js

# Or via the package script (mixed-peak, default profile)
pnpm loadtest
```

Supported profiles: `VUS=100 | 500 | 1000 | 5000 | 10000 | 20000`.

Other knobs: `DURATION` (steady-state length, default `1m`), `RAMP` (default
`30s`), `SESSION_COOKIE`, `ACTION_ID`, `ROUND_ID`.

### Authenticated scenarios

`transaction-history.js`, `place-bet.js` and the authenticated slice of
`mixed-peak.js` need a session:

1. Log in as the demo player in a browser.
2. Copy the `elp_session` cookie.
3. Pass it: `-e SESSION_COOKIE="elp_session=<value>"`.

`place-bet.js` additionally needs `ACTION_ID` (the `Next-Action` header value for
the place-bet server action, visible in DevTools → Network) and `ROUND_ID`. The
action id changes on every build, which is why it is a parameter rather than a
constant. Without these the script degrades to a read check and says so, rather
than silently "passing".

---

## Thresholds

A run that breaches these is a **failed run**, not a slow one:

| Metric | Budget |
| --- | --- |
| `http_req_failed` | < 1% (login scenario: < 5%, because 429 is a correct answer) |
| `http_req_duration` p95 | < 800 ms (bet placement: < 1200 ms) |
| `http_req_duration` p99 | < 2000 ms (bet placement: < 2500 ms) |
| `checks` | > 99% |

---

## Method

Run in this order. Each step answers a different question.

1. **Baseline** — `browse-public.js` at 100 VUs. Establishes the floor. If this
   is slow, nothing else is worth measuring.
2. **Read spike** — `current-round.js`, doubling VUs each run. Find where cache
   hit rate stops keeping p95 flat.
3. **Write path** — `place-bet.js`. This is the real capacity limit. Watch
   database connection saturation and wallet CAS retry rate, not just latency.
4. **Login storm** — `login.js`. scrypt is intentionally expensive; confirm the
   rate limiter sheds load instead of letting hashing starve the event loop.
5. **Peak mix** — `mixed-peak.js` at the target level, for at least 5 minutes.
   This is the only run whose number may be quoted.
6. **Soak** — the peak mix for 1 hour. Catches leaks, connection exhaustion and
   queue backlog that a short run hides.

### Environment requirements

Results are worthless unless the target is production-shaped:

- PostgreSQL with the production instance class **and a connection pooler**.
- Redis for cache, rate limiting and the queue.
- The settlement worker running as a separate process.
- Representative data volume — at minimum hundreds of thousands of bets and
  ledger rows. Testing against the 129-bet demo seed measures nothing.
- Load generators outside the application network, distributed across regions.

> The in-memory demo provider is **not** a valid load-test target. It has no
> connection limit, no network hop, and no durability, so it will produce
> flattering numbers that mean nothing.

---

## What to watch

| Layer | Signal | What it tells you |
| --- | --- | --- |
| App | p95/p99, error rate, event-loop lag | User-visible health |
| App | Wallet CAS retry rate | Contention on hot wallets |
| Database | Active connections vs pool size | The usual first ceiling |
| Database | Slow query log, seq scans | A missing or unused index |
| Database | Lock waits on `wallets` | Whether row locking is the bottleneck |
| Redis | Hit rate, evictions, latency | Cache sizing |
| Queue | Depth, oldest job age, failure rate | Whether settlement keeps up |
| Infra | CPU, memory, instance count, cold starts | Where to scale next |

---

## Recording a result

Every run gets an entry. A result without its context is not a result.

```markdown
### 2026-09-10 — mixed-peak, 1000 VUs

Target:      Vercel Pro (iad1) + Neon Scale (pooled, 4 vCPU) + Upstash Redis
Data:        520k bets, 1.4M ledger rows, 60 lotteries
Generators:  3 × k6 cloud (us-east, eu-west, ap-southeast)
Duration:    5m steady state after a 3m30s ramp

Result:      PASS
  http_req_failed        0.14%
  http_req_duration p95  410 ms
  http_req_duration p99  980 ms
  checks                 99.8%
  DB connections         62 / 120 peak
  Queue depth            max 340, drained in 45 s

Notes:       Two 429s per second on login, as designed. No CAS retries above 1%.
```

Only after such a run may the project state a supported concurrency figure — and
it must be stated together with the infrastructure it was measured on.
