/**
 * Shared k6 configuration.
 *
 * Pick a profile with the VUS env var, e.g.
 *   k6 run -e VUS=500 -e BASE_URL=https://example.com loadtest/scenarios/mixed-peak.js
 *
 * IMPORTANT: numbers produced by these scripts describe the environment they
 * were run against. Do not quote a concurrency figure for this platform unless
 * it came from a run on production-like infrastructure — see LOAD_TEST.md.
 */
export const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
export const VUS = Number(__ENV.VUS || 100);
export const DURATION = __ENV.DURATION || '1m';
export const RAMP = __ENV.RAMP || '30s';

/** Latency budgets. A run that breaches these is a failed run, not a slow one. */
export const thresholds = {
  http_req_failed: ['rate<0.01'],
  http_req_duration: ['p(95)<800', 'p(99)<2000'],
  checks: ['rate>0.99'],
};

export function rampingStages() {
  return [
    { duration: RAMP, target: Math.ceil(VUS / 2) },
    { duration: RAMP, target: VUS },
    { duration: DURATION, target: VUS },
    { duration: '20s', target: 0 },
  ];
}

export const DEMO_USER = {
  email: __ENV.DEMO_EMAIL || 'demo@example.com',
  password: __ENV.DEMO_PASSWORD || 'Demo1234!',
};
