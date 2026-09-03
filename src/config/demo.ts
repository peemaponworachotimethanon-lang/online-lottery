/**
 * Demo credentials.
 *
 * Kept in its own module — with no server-only imports — so client components
 * (the login form's "fill demo account" buttons) can reference them without
 * dragging `node:crypto` and the whole seeder into the browser bundle.
 *
 * These are demo accounts for a mock deployment. They are intentionally public
 * and are documented in the README. Nothing here is a production secret.
 */
export const DEMO_CREDENTIALS = {
  user: { email: 'demo@example.com', password: 'Demo1234!' },
  admin: { email: 'admin@example.com', password: 'Admin1234!' },
  finance: { email: 'finance@example.com', password: 'Finance1234!' },
  support: { email: 'support@example.com', password: 'Support1234!' },
} as const;

/** Starting balance for the demo player, in baht. */
export const DEMO_INITIAL_BALANCE_BAHT = 10_000;
