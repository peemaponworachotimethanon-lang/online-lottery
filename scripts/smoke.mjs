/**
 * End-to-end smoke test for the demo flows described in the project brief.
 *
 * Runs against a already-running production server (default http://localhost:3111)
 * and drives the real UI, so it verifies the whole stack: forms, server actions,
 * wallet ledger, settlement, and the admin console.
 *
 *   node scripts/smoke.mjs [baseUrl]
 */
import { chromium } from 'playwright';

const BASE = process.argv[2] ?? 'http://localhost:3111';
const results = [];

function check(name, passed, detail = '') {
  results.push({ name, passed, detail });
  console.log(`${passed ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
}

/** Reads the wallet balance shown in the header, in baht. */
async function headerBalance(page) {
  await page.goto(`${BASE}/wallet`, { waitUntil: 'networkidle' });
  const text = await page.locator('main').getByText(/^฿[\d,]+\.\d{2}$/).first().textContent();
  return Number((text ?? '').replace(/[฿,]/g, ''));
}

async function login(page, email, password) {
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await page.fill('#email', email);
  await page.fill('#password', password);
  await page.click('button[type=submit]');
  await page.waitForURL(/\/(dashboard|admin)/, { timeout: 20000 });
}

const browser = await chromium.launch({ args: ['--no-sandbox'] });

try {
  /* ---------------------------------------------------------------- user */
  const userContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await userContext.newPage();

  await login(page, 'demo@example.com', 'Demo1234!');
  check('Scenario 1a — demo user can log in', page.url().includes('/dashboard'));

  const startBalance = await headerBalance(page);
  check('Scenario 1b — initial balance is 10,000 THB', startBalance === 10000, `got ${startBalance}`);

  // ---- deposit 1,000 ----
  await page.goto(`${BASE}/wallet/deposit`, { waitUntil: 'networkidle' });
  await page.fill('#deposit-amount', '1000');
  await page.getByRole('button', { name: 'จำลองการชำระเงินสำเร็จ' }).click();
  await page.getByRole('button', { name: 'ยืนยันการฝาก' }).click();
  await page.waitForTimeout(2500);

  const afterDeposit = await headerBalance(page);
  check('Scenario 1c — balance is 11,000 after depositing 1,000', afterDeposit === 11000, `got ${afterDeposit}`);

  // ---- bet 100 THB on 3-digit top "123" ----
  await page.goto(`${BASE}/lotteries/thai-government`, { waitUntil: 'networkidle' });
  const betPadVisible = await page.locator('#bet-number').isVisible().catch(() => false);
  check('Scenario 2a — betting pad is available on the lottery page', betPadVisible);

  let betPlaced = false;
  let afterBet = afterDeposit;
  if (betPadVisible) {
    await page.getByRole('radio', { name: /3 ตัวบน/ }).first().click();
    await page.fill('#bet-number', '123');
    await page.fill('#bet-amount', '100');
    await page.getByRole('button', { name: /เพิ่มลงโพย/ }).first().click();
    await page.waitForTimeout(600);

    const payoutShown = await page.getByText('฿85,000.00').first().isVisible().catch(() => false);
    check('Scenario 2b — slip shows the 85,000 THB potential payout (100 x 850)', payoutShown);

    await page.getByRole('button', { name: /ยืนยันการแทง/ }).first().click();
    await page.getByRole('button', { name: 'ยืนยันและหักเงิน' }).click();
    await page.waitForTimeout(2500);

    afterBet = await headerBalance(page);
    betPlaced = afterBet === afterDeposit - 100;
    check('Scenario 2c — wallet decreased by exactly 100 THB', betPlaced, `got ${afterBet}`);

    await page.goto(`${BASE}/account/bets`, { waitUntil: 'networkidle' });
    const inHistory = await page.getByText('123').first().isVisible().catch(() => false);
    check('Scenario 2d — bet appears in the user bet history', inHistory);

    await page.goto(`${BASE}/account/transactions`, { waitUntil: 'networkidle' });
    const inLedger = await page.getByText('แทงหวย').first().isVisible().catch(() => false);
    check('Scenario 2e — a ledger row was written for the bet', inLedger);
  }

  /* --------------------------------------------------------------- admin */
  const adminContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const admin = await adminContext.newPage();
  await login(admin, 'admin@example.com', 'Admin1234!');
  check('Admin — staff can reach the admin console', admin.url().includes('/admin'));

  for (const path of [
    '/admin/users',
    '/admin/lotteries',
    '/admin/rounds',
    '/admin/bet-types',
    '/admin/payout-rates',
    '/admin/bets',
    '/admin/results',
    '/admin/deposits',
    '/admin/withdrawals',
    '/admin/transactions',
    '/admin/wallet',
    '/admin/reports',
    '/admin/notifications',
    '/admin/audit-logs',
    '/admin/settings',
  ]) {
    const response = await admin.goto(`${BASE}${path}`, { waitUntil: 'domcontentloaded' });
    check(`Admin page ${path} renders`, response?.status() === 200, `status ${response?.status()}`);
  }

  /* ------------------------------------------------- ledger consistency */
  await admin.goto(`${BASE}/admin/wallet`, { waitUntil: 'networkidle' });
  await admin.getByRole('button', { name: /ตรวจสอบเดี๋ยวนี้/ }).first().click();
  await admin.waitForTimeout(2000);
  const ledgerOk = await admin.getByText(/ผ่าน —/).first().isVisible().catch(() => false);
  check('Ledger invariant holds across the whole platform', ledgerOk);

  /* ------------------------------------------------- withdrawal flow ---- */
  await page.goto(`${BASE}/wallet/withdraw`, { waitUntil: 'networkidle' });
  await page.fill('#withdraw-amount', '5000');
  await page.fill('#bank-account-number', '123-456789-0');
  await page.fill('#bank-account-name', 'ผู้ใช้ทดลอง (Demo)');
  await page.getByRole('button', { name: 'ส่งคำขอถอนเงิน' }).click();
  await page.getByRole('button', { name: 'ส่งคำขอ' }).click();
  await page.waitForTimeout(2500);

  const afterHold = await headerBalance(page);
  check(
    'Scenario 4a — requesting a 5,000 withdrawal holds the funds immediately',
    afterHold === afterBet - 5000,
    `got ${afterHold}`,
  );

  await admin.goto(`${BASE}/admin/withdrawals?status=pending`, { waitUntil: 'networkidle' });
  const approveButton = admin.getByRole('button', { name: 'อนุมัติ' }).first();
  if (await approveButton.isVisible().catch(() => false)) {
    await approveButton.click();
    await admin.getByRole('button', { name: /^อนุมัติ$/ }).last().click();
    await admin.waitForTimeout(2500);
    check('Scenario 4b — admin can approve a pending withdrawal', true);
  } else {
    check('Scenario 4b — admin can approve a pending withdrawal', false, 'no approve button found');
  }

  /* ------------------------------------------------------- responsive --- */
  const mobileContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const mobile = await mobileContext.newPage();
  for (const path of ['/', '/lotteries', '/results', '/login']) {
    await mobile.goto(`${BASE}${path}`, { waitUntil: 'networkidle' });
    const overflow = await mobile.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    );
    check(`Mobile 390px — ${path} has no horizontal overflow`, !overflow);
  }
  await mobile.goto(`${BASE}/`, { waitUntil: 'networkidle' });
  const bottomNav = await mobile.locator('nav[aria-label="เมนูด้านล่าง"]').isVisible();
  check('Mobile — bottom navigation is present on the public site', bottomNav);
} finally {
  await browser.close();
}

const failed = results.filter((result) => !result.passed);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
if (failed.length > 0) process.exitCode = 1;
