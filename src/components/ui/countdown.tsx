'use client';

import * as React from 'react';
import { countdownParts, formatCountdown } from '@/lib/datetime';
import { cn } from '@/lib/utils';

/**
 * Server-synchronised countdown.
 *
 * The server renders `closeAt` (UTC) plus the server clock at render time; the
 * client measures its own drift once and applies it, so a device with a wrong
 * clock still sees the correct remaining time. The countdown is display only —
 * whether a bet is accepted is decided by the server, never by this component.
 */
export function Countdown({
  targetIso,
  serverNowMs,
  className,
  onExpire,
  compact = false,
}: {
  targetIso: string;
  serverNowMs?: number;
  className?: string;
  onExpire?: () => void;
  compact?: boolean;
}) {
  const driftRef = React.useRef(serverNowMs ? serverNowMs - Date.now() : 0);
  const [parts, setParts] = React.useState(() => countdownParts(targetIso, Date.now() + driftRef.current));
  const firedRef = React.useRef(false);

  React.useEffect(() => {
    const tick = () => {
      const next = countdownParts(targetIso, Date.now() + driftRef.current);
      setParts(next);
      if (next.expired && !firedRef.current) {
        firedRef.current = true;
        onExpire?.();
      }
    };
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [targetIso, onExpire]);

  const urgent = !parts.expired && parts.totalMs <= 30 * 60_000;

  return (
    <span
      className={cn(
        'tabular font-medium',
        compact ? 'text-sm' : 'text-base',
        parts.expired ? 'text-muted-foreground' : urgent ? 'text-warning-foreground' : 'text-foreground',
        className,
      )}
      // Announce roughly, not every second, so screen readers are not flooded.
      aria-live="off"
    >
      {formatCountdown(parts)}
    </span>
  );
}
