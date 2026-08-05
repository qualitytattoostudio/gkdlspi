import React from 'react';
import { cn } from '@/lib/utils';
import { ChevronDown } from 'lucide-react';

export interface NeuSelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: { label: string; value: string }[];
}

export const NeuSelect = React.forwardRef<HTMLSelectElement, NeuSelectProps>(
  ({ className, label, error, options, ...props }, ref) => {
    return (
      <div className="w-full flex flex-col gap-2">
        {label && (
          <label className="text-sm font-medium text-neu-fg ml-2">
            {label}
          </label>
        )}
        <div className="relative flex items-center">
          <select
            ref={ref}
            className={cn(
              'bg-neu-bg rounded-neu-inner px-4 py-3 w-full shadow-neu-inset text-neu-fg focus:shadow-neu-inset-deep focus:ring-2 focus:ring-neu-accent focus:ring-offset-2 focus:ring-offset-neu-bg outline-none appearance-none transition-all duration-300',
              error && 'focus:ring-red-500 shadow-neu-inset-deep ring-1 ring-red-400',
              className
            )}
            {...props}
          >
            <option value="" disabled hidden>Select an option</option>
            {options.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <div className="absolute right-4 text-neu-muted pointer-events-none">
            <ChevronDown size={18} />
          </div>
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

NeuSelect.displayName = 'NeuSelect';
