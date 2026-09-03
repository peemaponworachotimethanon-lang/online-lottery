import http from 'k6/http';
import { check, sleep } from 'k6';
import { BASE_URL, rampingStages, thresholds } from '../config.js';

/**
 * Scenario: the write path.
 *
 * Placing a bet is the only hot path that takes a lock, writes a ledger row, and
 * must stay strongly consistent — it is the scenario that decides real capacity.
 *
 * Server actions are POSTed to the page URL with the Next-Action header. Capture
 * the current action id from a browser session and pass it as ACTION_ID; the id
 * changes on every build, which is why it is not hard-coded here.
 */
export const options = {
  stages: rampingStages(),
  thresholds: { ...thresholds, http_req_duration: ['p(95)<1200', 'p(99)<2500'] },
};

const ACTION_ID = __ENV.ACTION_ID || '';
const ROUND_ID = __ENV.ROUND_ID || '';
const COOKIE = __ENV.SESSION_COOKIE || '';

function randomNumber(digits) {
  let out = '';
  for (let i = 0; i < digits; i++) out += Math.floor(Math.random() * 10);
  return out;
}

export default function () {
  if (!ACTION_ID || !ROUND_ID || !COOKIE) {
    // Without a real session this scenario degrades to a read check so the
    // script still reports something useful instead of silently passing.
    const response = http.get(`${BASE_URL}/lotteries`);
    check(response, { 'fallback read 200': (r) => r.status === 200 });
    sleep(1);
    return;
  }

  const payload = JSON.stringify([
    {
      roundId: ROUND_ID,
      items: [{ betTypeCode: 'two-top', number: randomNumber(2), stakeBaht: 10 }],
      idempotencyKey: `k6-${__VU}-${__ITER}-${Date.now()}`,
    },
  ]);

  const response = http.post(`${BASE_URL}/lotteries/thai-government`, payload, {
    headers: {
      'Content-Type': 'text/plain;charset=UTF-8',
      'Next-Action': ACTION_ID,
      Cookie: COOKIE,
    },
  });

  check(response, {
    'bet accepted or cleanly rejected': (r) => r.status < 500,
  });
  sleep(Math.random() * 2 + 0.5);
}
