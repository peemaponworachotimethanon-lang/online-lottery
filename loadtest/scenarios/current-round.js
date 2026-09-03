import http from 'k6/http';
import { check, sleep } from 'k6';
import { BASE_URL, rampingStages, thresholds } from '../config.js';

/**
 * Scenario: everyone refreshing one lottery page as the round approaches close.
 * This is the read pattern that the current-round cache exists to absorb.
 */
export const options = { stages: rampingStages(), thresholds };

const SLUGS = ['thai-government', 'lao', 'hanoi', 'hanoi-vip', 'nikkei'];

export default function () {
  const slug = SLUGS[Math.floor(Math.random() * SLUGS.length)];
  const response = http.get(`${BASE_URL}/lotteries/${slug}`);
  check(response, {
    'lottery detail 200': (r) => r.status === 200,
    'renders a countdown': (r) => r.body.includes('ปิดรับ'),
  });
  sleep(Math.random() + 0.5);
}
