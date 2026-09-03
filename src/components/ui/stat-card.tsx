import * as React from 'react';
import { cn } from '@/lib/utils';

export function StatCard({
  label,
  value,
  hint,
  icon,
  tone = 'default',
  className,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon?: React.ReactNode;
  tone?: 'default' | 'emerald' | 'gold' | 'warning';
  className?: string;
}) {
  return (
    <div className={cn('surface-card flex flex-col gap-1.5 p-4', className)}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        {icon ? (
          <span
            className={cn(
              'flex size-7 items-center justify-center rounded-lg [&_svg]:size-4',
              tone === 'emerald' && 'bg-primary-soft text-primary-soft-foreground',
              tone === 'gold' && 'bg-accent-soft text-accent-foreground',
              tone === 'warning' && 'bg-warning-soft text-warning-foreground',
              tone === 'default' && 'bg-surface-muted text-muted-foreground',
            )}
          >
            {icon}
          </span>
        ) : null}
      </div>
      <div className="tabular text-xl font-semibold tracking-tight sm:text-2xl">{value}</div>
      {hint ? <div className="text-xs text-muted-foreground">{hint}</div> : null}
    </div>
  );
}

export function PageHeader({
  title,
  description,
  actions,
  className,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between', className)}>
      <div className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{title}</h1>
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}
