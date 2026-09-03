import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { BASE_URL, rampingStages, thresholds } from '../config.js';

/**
 * Scenario: anonymous browsing.
 * The cheapest and most cacheable traffic — establishes the baseline that every
 * other scenario is compared against.
 */
export const options = { stages: rampingStages(), thresholds };

export default function () {
  group('public pages', () => {
    const home = http.get(`${BASE_URL}/`);
    check(home, { 'home 200': (r) => r.status === 200 });

    const lotteries = http.get(`${BASE_URL}/lotteries`);
    check(lotteries, { 'lotteries 200': (r) => r.status === 200 });

    const results = http.get(`${BASE_URL}/results`);
    check(results, { 'results 200': (r) => r.status === 200 });
  });
  sleep(Math.random() * 2 + 1);
}
