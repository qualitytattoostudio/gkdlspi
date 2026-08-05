import React from 'react';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';
import { playClick } from '@/lib/audio';

interface NeuButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost';
  isLoading?: boolean;
}

export function NeuButton({
  className,
  variant = 'primary',
  isLoading,
  children,
  disabled,
  ...props
}: NeuButtonProps) {
  const baseClasses =
    'rounded-neu-btn px-6 py-3 h-12 font-medium transition-all duration-300 ease-out focus:outline-none focus:ring-2 focus:ring-neu-accent focus:ring-offset-2 focus:ring-offset-neu-bg flex items-center justify-center gap-2';

  const variantClasses = {
    primary:
      'bg-neu-accent text-white shadow-neu-small hover:-translate-y-px hover:shadow-neu-lifted active:translate-y-0.5 active:shadow-neu-inset-sm disabled:opacity-50 disabled:hover:translate-y-0 disabled:active:translate-y-0',
    secondary:
      'bg-neu-bg text-neu-fg shadow-neu-raised hover:-translate-y-px hover:shadow-neu-lifted active:translate-y-0.5 active:shadow-neu-inset-sm disabled:opacity-50',
    ghost:
      'bg-transparent text-neu-muted hover:text-neu-fg active:text-neu-accent',
  };

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    playClick();
    if (props.onClick) {
      props.onClick(e);
    }
  };

  return (
    <button
      className={cn(baseClasses, variantClasses[variant], className)}
      disabled={disabled || isLoading}
      {...props}
      onClick={handleClick}
    >
      {isLoading && <Loader2 className="w-5 h-5 animate-spin" />}
      {children}
    </button>
  );
}
