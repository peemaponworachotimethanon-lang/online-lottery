/**
 * Regenerates the seeded demo dataset and prints a summary.
 *
 *   pnpm seed:reset
 *
 * In `mock` mode the demo store lives in the server process, so this script is a
 * verification tool: it rebuilds the same deterministic dataset the running app
 * builds at startup and asserts the ledger invariant holds. To reset a *running*
 * server, restart it (or redeploy) — there is no shared database to truncate.
 */
import { buildSeededDatabase } from '../src/mocks/seed';
import { createMemoryRepositories } from '../src/repositories/memory';
import { createServices } from '../src/services/container';
import { formatMoney } from '../src/lib/money';
import { DEMO_CREDENTIALS } from '../src/config/demo';

async function main() {
  const startedAt = Date.now();
  const db = buildSeededDatabase();
  const repos = createMemoryRepositories(db);
  const services = createServices(repos);

  const counts = {
    users: db.users.size,
    wallets: db.wallets.size,
    walletTransactions: db.walletTransactions.size,
    lotteries: db.lotteries.size,
    rounds: db.rounds.size,
    betTypes: db.betTypes.size,
    payoutRates: db.payoutRates.size,
    bets: db.bets.size,
    results: db.results.size,
    deposits: db.deposits.size,
    withdrawals: db.withdrawals.size,
    notifications: db.notifications.size,
    auditLogs: db.auditLogs.size,
    loginEvents: db.loginEvents.size,
  };

  const ledger = await services.wallet.verifyLedger();
  const demo = await repos.users.findByEmail(DEMO_CREDENTIALS.user.email);
  const demoWallet = demo ? await repos.wallets.findByUserId(demo.id) : null;

  console.log('\nSeeded demo dataset');
  console.log('===================');
  for (const [key, value] of Object.entries(counts)) {
    console.log(`  ${key.padEnd(20)} ${String(value).padStart(6)}`);
  }
  console.log('\nDemo player');
  console.log(`  email                ${DEMO_CREDENTIALS.user.email}`);
  console.log(`  balance              ${demoWallet ? formatMoney(demoWallet.balance) : 'n/a'}`);
  console.log('\nLedger integrity');
  console.log(`  consistent           ${ledger.consistent ? 'yes' : 'NO'}`);
  console.log(`  wallet total         ${formatMoney(ledger.balance)}`);
  console.log(`  ledger total         ${formatMoney(ledger.ledgerSum)}`);
  console.log(`\nBuilt in ${Date.now() - startedAt}ms\n`);

  if (!ledger.consistent) {
    console.error('Ledger invariant violated in the seeded dataset.');
    process.exitCode = 1;
  }
}

void main();
