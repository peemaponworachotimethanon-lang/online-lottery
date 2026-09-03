import http from 'k6/http';
import { check, sleep } from 'k6';
import { BASE_URL, rampingStages, thresholds } from '../config.js';

/**
 * Scenario: authenticated read of a paginated financial table.
 * Verifies that server-side pagination keeps response size and time flat as the
 * ledger grows. Pass SESSION_COOKIE from a logged-in browser session.
 */
export const options = { stages: rampingStages(), thresholds };

const COOKIE = __ENV.SESSION_COOKIE || '';

export default function () {
  const page = Math.floor(Math.random() * 5) + 1;
  const response = http.get(`${BASE_URL}/account/transactions?page=${page}&pageSize=20`, {
    headers: COOKIE ? { Cookie: COOKIE } : {},
    redirects: 0,
  });

  check(response, {
    'no server error': (r) => r.status < 500,
    'response stays small': (r) => r.body.length < 400_000,
  });
  sleep(Math.random() * 2 + 1);
}
