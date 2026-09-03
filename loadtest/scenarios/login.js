import http from 'k6/http';
import { check, sleep } from 'k6';
import { BASE_URL, DEMO_USER, rampingStages, thresholds } from '../config.js';

/**
 * Scenario: login storm.
 *
 * NOTE: password hashing is deliberately expensive (scrypt), so this scenario is
 * CPU bound by design. Its purpose is to size the login path and to verify that
 * the rate limiter sheds load instead of letting hashing starve the event loop.
 * Expect (and want) 429s once the per-account budget is exceeded.
 */
export const options = {
  stages: rampingStages(),
  thresholds: {
    ...thresholds,
    // 429 is a correct answer here, so only 5xx counts as a failure.
    http_req_failed: ['rate<0.05'],
  },
};

export default function () {
  const page = http.get(`${BASE_URL}/login`);
  check(page, { 'login page 200': (r) => r.status === 200 });
  sleep(1);

  const attempt = http.post(
    `${BASE_URL}/login`,
    JSON.stringify(DEMO_USER),
    { headers: { 'Content-Type': 'application/json' } },
  );
  check(attempt, { 'no server error': (r) => r.status < 500 });
  sleep(Math.random() * 3 + 1);
}
