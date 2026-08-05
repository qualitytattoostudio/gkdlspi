import React, { useEffect, useState } from 'react';
import { NeuCard } from './NeuCard';
import { IconWell } from './IconWell';
import { LucideIcon } from 'lucide-react';
import { Sparkline } from '../charts/Sparkline';

interface StatCardProps {
  title: string;
  value: number;
  icon: LucideIcon;
  prefix?: string;
  suffix?: string;
  trend?: number; // percentage e.g. 15 for +15%, -5 for -5%
}

export function StatCard({ title, value, icon: Icon, prefix = '', suffix = '', trend }: StatCardProps) {
  const [displayValue, setDisplayValue] = useState(0);
  const [sparklineData, setSparklineData] = useState<number[]>([]);

  useEffect(() => {
    setSparklineData(Array.from({length: 10}, () => Math.random() * 100));
  }, []);

  useEffect(() => {
    let start = 0;
    const duration = 1500; // 1.5s
    const startTime = performance.now();

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // easeOutExpo
      const easeProgress = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      
      setDisplayValue(Math.floor(easeProgress * value));

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        setDisplayValue(value);
      }
    };

    requestAnimationFrame(animate);
  }, [value]);

  return (
    <NeuCard className="flex flex-col animate-fade-up h-full">
      <div className="flex items-start justify-between mb-4">
        <IconWell size="sm">
          <Icon size={20} />
        </IconWell>
        {trend !== undefined && (
          <div className={`text-xs font-bold px-2 py-1 rounded-lg bg-neu-bg shadow-neu-inset-sm ${trend >= 0 ? 'text-neu-accent-secondary' : 'text-red-500'}`}>
            {trend > 0 ? '+' : ''}{trend}%
          </div>
        )}
      </div>
      <h3 className="text-neu-muted text-sm font-medium mb-1">{title}</h3>
      <div className="text-3xl font-display font-bold text-neu-fg mb-4">
        {prefix}{displayValue.toLocaleString()}{suffix}
      </div>
      <div className="h-10 mt-auto">
        {sparklineData.length > 0 && (
          <Sparkline data={sparklineData} color={trend !== undefined && trend < 0 ? '#EF4444' : '#6C63FF'} />
        )}
      </div>
    </NeuCard>
  );
}
