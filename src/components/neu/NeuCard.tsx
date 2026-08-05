import React from 'react';
import { cn } from '@/lib/utils';

interface NeuCardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'raised' | 'flat' | 'inset';
}

export function NeuCard({ className, variant = 'raised', children, ...props }: NeuCardProps) {
  const variantClasses = {
    raised: 'shadow-neu-raised hover:-translate-y-0.5 hover:shadow-neu-lifted transition-all duration-300 ease-out',
    flat: 'shadow-neu-small',
    inset: 'shadow-neu-inset-deep',
  };

  return (
    <div
      className={cn(
        'bg-neu-bg rounded-neu-card p-8',
        variantClasses[variant],
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
