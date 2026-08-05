import React from 'react';
import { cn } from '@/lib/utils';

export interface NeuInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  icon?: React.ReactNode;
  label?: string;
  error?: string;
}

export const NeuInput = React.forwardRef<HTMLInputElement, NeuInputProps>(
  ({ className, icon, label, error, ...props }, ref) => {
    return (
      <div className="w-full flex flex-col gap-2">
        {label && (
          <label className="text-sm font-medium text-neu-fg ml-2">
            {label}
          </label>
        )}
        <div className="relative flex items-center">
          {icon && (
            <div className="absolute left-4 text-neu-muted flex items-center justify-center">
              {icon}
            </div>
          )}
          <input
            ref={ref}
            className={cn(
              'bg-neu-bg rounded-neu-inner px-4 py-3 w-full shadow-neu-inset placeholder-neu-muted/70 text-neu-fg focus:shadow-neu-inset-deep focus:ring-2 focus:ring-neu-accent focus:ring-offset-2 focus:ring-offset-neu-bg outline-none transition-all duration-300',
              icon && 'pl-11',
              error && 'focus:ring-red-500 shadow-neu-inset-deep ring-1 ring-red-400',
              className
            )}
            {...props}
          />
        </div>
        {error && (
          <span className="text-xs font-medium text-red-500 ml-2">
            {error}
          </span>
        )}
      </div>
    );
  }
);

NeuInput.displayName = 'NeuInput';
