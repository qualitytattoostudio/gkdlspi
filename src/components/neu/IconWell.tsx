import React from 'react';
import { cn } from '@/lib/utils';

interface IconWellProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
  float?: boolean;
}

export function IconWell({ className, children, size = 'md', float, ...props }: IconWellProps) {
  const sizeClasses = {
    sm: 'w-10 h-10 rounded-xl',
    md: 'w-12 h-12 rounded-2xl',
    lg: 'w-16 h-16 rounded-3xl',
  };

  return (
    <div
      className={cn(
        'bg-neu-bg shadow-neu-inset-deep flex items-center justify-center shrink-0 text-neu-accent',
        sizeClasses[size],
        float && 'animate-[float_3s_ease-in-out_infinite]',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
