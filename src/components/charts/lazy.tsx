'use client';

import dynamic from 'next/dynamic';
import { Skeleton } from '@/components/ui/feedback';

/**
 * Charts are code-split and client-only.
 *
 * Recharts is large and pulls in D3 modules; loading it lazily keeps it off the
 * critical path for the betting and cashier pages, which must stay fast during
 * the pre-close traffic spike.
 */
function fallback(height: number) {
  function ChartFallback() {
    return <Skeleton className="w-full" style={{ height }} />;
  }
  return ChartFallback;
}

export const StakeAreaChart = dynamic(
  () => import('./basic-charts').then((module) => module.StakeAreaChart),
  { ssr: false, loading: fallback(220) },
);

export const WinLossChart = dynamic(
  () => import('./basic-charts').then((module) => module.WinLossChart),
  { ssr: false, loading: fallback(220) },
);

export const AdminDailyChart = dynamic(
  () => import('./basic-charts').then((module) => module.AdminDailyChart),
  { ssr: false, loading: fallback(260) },
);

export const NewUsersChart = dynamic(
  () => import('./basic-charts').then((module) => module.NewUsersChart),
  { ssr: false, loading: fallback(220) },
);

export const TopLotteriesChart = dynamic(
  () => import('./basic-charts').then((module) => module.TopLotteriesChart),
  { ssr: false, loading: fallback(260) },
);
