import http from 'k6/http';
import { check, sleep } from 'k6';
import { BASE_URL, VUS, thresholds } from '../config.js';

/**
 * Scenario: the pre-close peak.
 *
 * Traffic mix modelled on the minutes before a round closes:
 *   70% browsing / refreshing the lottery page
 *   20% checking results
 *   10% authenticated account reads
 *
 * This is the scenario to run before quoting ANY capacity number, and it must be
 * run against production-like infrastructure to mean anything.
 */
export const options = {
  scenarios: {
    peak: {
      executor: 'ramping-arrival-rate',
      startRate: Math.ceil(VUS / 10),
      timeUnit: '1s',
      preAllocatedVUs: VUS,
      maxVUs: VUS * 2,
      stages: [
        { duration: '30s', target: Math.ceil(VUS / 4) },
        { duration: '1m', target: Math.ceil(VUS / 2) },
        { duration: '2m', target: VUS },
        { duration: '30s', target: 0 },
      ],
    },
  },
  thresholds,
};

const SLUGS = ['thai-government', 'lao', 'hanoi', 'hanoi-vip', 'nikkei', 'hang-seng'];
const COOKIE = __ENV.SESSION_COOKIE || '';

export default function () {
  const roll = Math.random();

  if (roll < 0.7) {
    const slug = SLUGS[Math.floor(Math.random() * SLUGS.length)];
    const response = http.get(`${BASE_URL}/lotteries/${slug}`);
    check(response, { 'lottery detail ok': (r) => r.status === 200 });
  } else if (roll < 0.9) {
    const response = http.get(`${BASE_URL}/results`);
    check(response, { 'results ok': (r) => r.status === 200 });
  } else {
    const response = http.get(`${BASE_URL}/dashboard`, {
      headers: COOKIE ? { Cookie: COOKIE } : {},
      redirects: 0,
    });
    check(response, { 'dashboard no server error': (r) => r.status < 500 });
  }

  sleep(Math.random());
}
