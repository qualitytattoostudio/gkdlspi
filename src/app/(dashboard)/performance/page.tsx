'use client';

import React, { useState } from 'react';
import { NeuCard } from '@/components/neu/NeuCard';
import { NeuButton } from '@/components/neu/NeuButton';
import { NeuBadge } from '@/components/neu/NeuBadge';
import { Target, Award, Sparkles, Bell, TrendingUp, CheckCircle, Clock } from 'lucide-react';
import { toast } from '@/store/toastStore';
import { playSuccess } from '@/lib/audio';

export default function PerformancePage() {
  const [subscribed, setSubscribed] = useState(false);

  const handleNotify = () => {
    setSubscribed(true);
    playSuccess();
    toast.success('Notification Preference Saved', 'You will be notified as soon as Performance & Goals goes live!');
  };

  return (
    <div className="space-y-8 animate-fade-up">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-display font-bold text-neu-fg">Performance & Goals</h2>
            <NeuBadge variant="warning">Coming Soon</NeuBadge>
          </div>
          <p className="text-neu-muted text-sm mt-1">
            Enterprise employee appraisal, KPI tracking, and automated goal metrics engine.
          </p>
        </div>
        <NeuButton 
          onClick={handleNotify}
          variant={subscribed ? 'secondary' : 'primary'}
          disabled={subscribed}
        >
          <Bell size={18} />
          {subscribed ? 'Subscribed for Launch' : 'Notify GM on Release'}
        </NeuButton>
      </div>

      {/* Feature Preview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <NeuCard className="p-6 space-y-3 relative overflow-hidden">
          <div className="w-12 h-12 rounded-2xl bg-neu-bg shadow-neu-small flex items-center justify-center text-neu-accent">
            <Target size={24} />
          </div>
          <h3 className="font-display font-bold text-lg text-neu-fg">KPI & Goal Tracking</h3>
          <p className="text-sm text-neu-muted leading-relaxed">
            Assign monthly SLA goals, field visit completion targets, and track supervisor efficiency metrics automatically.
          </p>
          <div className="pt-2">
            <NeuBadge variant="neutral">Phase 1 Integration</NeuBadge>
          </div>
        </NeuCard>

        <NeuCard className="p-6 space-y-3 relative overflow-hidden">
          <div className="w-12 h-12 rounded-2xl bg-neu-bg shadow-neu-small flex items-center justify-center text-emerald-600">
            <Award size={24} />
          </div>
          <h3 className="font-display font-bold text-lg text-neu-fg">Appraisal Scores</h3>
          <p className="text-sm text-neu-muted leading-relaxed">
            Calculated scorecards combining punctuality, quality audit ratings, and client feedback into a single score.
          </p>
          <div className="pt-2">
            <NeuBadge variant="neutral">Phase 2 Integration</NeuBadge>
          </div>
        </NeuCard>

        <NeuCard className="p-6 space-y-3 relative overflow-hidden">
          <div className="w-12 h-12 rounded-2xl bg-neu-bg shadow-neu-small flex items-center justify-center text-purple-600">
            <TrendingUp size={24} />
          </div>
          <h3 className="font-display font-bold text-lg text-neu-fg">AI Performance Analytics</h3>
          <p className="text-sm text-neu-muted leading-relaxed">
            Smart insights highlighting high-performing teams, bottleneck operational sites, and training recommendations.
          </p>
          <div className="pt-2">
            <NeuBadge variant="neutral">Phase 3 Integration</NeuBadge>
          </div>
        </NeuCard>
      </div>

      {/* Roadmap & Timeline Preview */}
      <NeuCard className="p-8 space-y-6">
        <div className="flex items-center gap-3">
          <Sparkles className="text-amber-500" size={24} />
          <h3 className="font-display font-bold text-xl text-neu-fg">Module Release Roadmap</h3>
        </div>

        <div className="space-y-4">
          <div className="flex items-start gap-4 p-4 rounded-2xl bg-neu-bg shadow-neu-inset-sm">
            <CheckCircle className="text-emerald-500 shrink-0 mt-0.5" size={20} />
            <div>
              <h4 className="font-bold text-sm text-neu-fg">Fleet & Vehicles Management (`/fleet`)</h4>
              <p className="text-xs text-neu-muted">Status: Operational & Deployed in V-Syncer Portal</p>
            </div>
          </div>

          <div className="flex items-start gap-4 p-4 rounded-2xl bg-neu-bg shadow-neu-inset-sm">
            <CheckCircle className="text-emerald-500 shrink-0 mt-0.5" size={20} />
            <div>
              <h4 className="font-bold text-sm text-neu-fg">Procurement & Suppliers (`/procurement`)</h4>
              <p className="text-xs text-neu-muted">Status: Operational & Deployed in V-Syncer Portal</p>
            </div>
          </div>

          <div className="flex items-start gap-4 p-4 rounded-2xl bg-neu-bg shadow-neu-inset-sm">
            <CheckCircle className="text-emerald-500 shrink-0 mt-0.5" size={20} />
            <div>
              <h4 className="font-bold text-sm text-neu-fg">Sales Pipeline & Quotes (`/sales`)</h4>
              <p className="text-xs text-neu-muted">Status: Operational & Deployed in V-Syncer Portal</p>
            </div>
          </div>

          <div className="flex items-start gap-4 p-4 rounded-2xl bg-neu-bg shadow-neu-inset-sm">
            <CheckCircle className="text-emerald-500 shrink-0 mt-0.5" size={20} />
            <div>
              <h4 className="font-bold text-sm text-neu-fg">Advanced Rostering & Sites (`/rostering`)</h4>
              <p className="text-xs text-neu-muted">Status: Operational & Deployed in V-Syncer Portal</p>
            </div>
          </div>

          <div className="flex items-start gap-4 p-4 rounded-2xl bg-neu-bg shadow-neu-inset-sm border-2 border-amber-400/40">
            <Clock className="text-amber-500 shrink-0 mt-0.5" size={20} />
            <div>
              <h4 className="font-bold text-sm text-neu-fg">Performance & Goals (`/performance`)</h4>
              <p className="text-xs text-amber-600 font-medium">Status: In Active Backend Syncing — Launching Soon!</p>
            </div>
          </div>
        </div>
      </NeuCard>
    </div>
  );
}
