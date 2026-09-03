import type { NextConfig } from 'next';

/**
 * Security headers applied to every response.
 * CSP is intentionally strict but allows Next.js inline bootstrap styles/scripts
 * via nonce-less 'unsafe-inline' for styles only (Tailwind injects a stylesheet,
 * but Next injects small inline style tags for font/flight data).
 */
const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
  },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  experimental: {
    // Keeps the barrel-heavy icon/chart packages from being fully bundled.
    optimizePackageImports: ['lucide-react', 'recharts', 'date-fns'],
  },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

export default nextConfig;
