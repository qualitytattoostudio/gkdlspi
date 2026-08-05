import React from 'react';
import { IconWell } from './IconWell';
import { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: React.ReactNode;
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center animate-fade-up">
      <IconWell size="lg" float className="mb-6">
        <Icon size={32} />
      </IconWell>
      <h3 className="text-xl font-display font-bold text-neu-fg mb-2">{title}</h3>
      <p className="text-neu-muted max-w-sm mb-8">{description}</p>
      {action && <div>{action}</div>}
    </div>
  );
}
