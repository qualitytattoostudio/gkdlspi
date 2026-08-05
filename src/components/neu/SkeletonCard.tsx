import React from 'react';
import { NeuCard } from './NeuCard';
import { cn } from '@/lib/utils';

export function SkeletonCard({ className }: { className?: string }) {
  return (
    <NeuCard className={cn('animate-fade-up', className)}>
      <div className="w-12 h-12 rounded-2xl bg-neu-bg shadow-neu-inset-sm mb-4 animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-white/20 to-transparent bg-[length:200%_100%]" />
      <div className="w-1/3 h-4 rounded-full bg-neu-bg shadow-neu-inset-sm mb-4 animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-white/20 to-transparent bg-[length:200%_100%]" />
      <div className="w-2/3 h-8 rounded-full bg-neu-bg shadow-neu-inset-sm animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-white/20 to-transparent bg-[length:200%_100%]" />
    </NeuCard>
  );
}
