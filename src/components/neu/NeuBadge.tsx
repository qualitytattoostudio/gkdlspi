import React from 'react';
import { cn } from '@/lib/utils';

export type BadgeVariant = 'success' | 'warning' | 'error' | 'info' | 'neutral';

interface NeuBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  pulse?: boolean;
}

export function NeuBadge({ className, variant = 'neutral', pulse, children, ...props }: NeuBadgeProps) {
  const variantClasses = {
    success: 'text-neu-accent-secondary',
    warning: 'text-amber-500',
    error: 'text-red-500',
    info: 'text-blue-500',
    neutral: 'text-neu-muted',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center justify-center px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-neu-bg shadow-neu-small',
        variantClasses[variant],
        pulse && 'animate-[pulse-ring_2s_infinite]',
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}
