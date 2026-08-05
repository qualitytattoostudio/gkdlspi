'use client';

import React from 'react';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  showText?: boolean;
  className?: string;
}

export function VSyncerLogo({ size = 'md', showText = true, className = '' }: LogoProps) {
  const iconSizes = {
    sm: 'w-8 h-8',
    md: 'w-11 h-11',
    lg: 'w-16 h-16',
  };

  const svgSizes = {
    sm: 20,
    md: 26,
    lg: 38,
  };

  return (
    <div className={`flex items-center gap-3.5 select-none ${className}`}>
      {/* Neumorphic Raised Icon Pod */}
      <div 
        className={`${iconSizes[size]} rounded-2xl bg-neu-bg shadow-neu-raised hover:shadow-neu-lifted active:shadow-neu-inset transition-all duration-300 flex items-center justify-center shrink-0 relative overflow-hidden group`}
      >
        {/* Ambient Glow */}
        <div className="absolute inset-0 bg-gradient-to-tr from-neu-accent/10 to-neu-accent-secondary/20 opacity-60 group-hover:opacity-100 transition-opacity" />
        
        {/* Pure SVG Vector Brand Icon */}
        <svg 
          width={svgSizes[size]} 
          height={svgSizes[size]} 
          viewBox="0 0 40 40" 
          fill="none" 
          xmlns="http://www.w3.org/2000/svg"
          className="relative z-10 transition-transform duration-300 group-hover:scale-105"
        >
          <defs>
            <linearGradient id="vLogoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#2563EB" />
              <stop offset="50%" stopColor="#0F4C81" />
              <stop offset="100%" stopColor="#10B981" />
            </linearGradient>
            <filter id="glowShadow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#2563EB" floodOpacity="0.35" />
            </filter>
          </defs>
          {/* Main Dynamic V Structure */}
          <path 
            d="M7 11L20 31L33 11" 
            stroke="url(#vLogoGrad)" 
            strokeWidth="5" 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            filter="url(#glowShadow)"
          />
          {/* Sync Nodes */}
          <circle cx="7" cy="11" r="3.2" fill="#2563EB" />
          <circle cx="33" cy="11" r="3.2" fill="#10B981" />
          <circle cx="20" cy="31" r="3.8" fill="#0F4C81" />
        </svg>
      </div>

      {/* Brand Name Typography */}
      {showText && (
        <div className="flex flex-col">
          <div className="flex items-center gap-1.5">
            <span className="font-display font-black text-xl tracking-tight text-neu-fg">
              V-SYNCER
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-neu-accent/15 text-neu-accent shadow-neu-small">
              PRO
            </span>
          </div>
          <span className="text-[11px] font-bold text-neu-muted uppercase tracking-widest -mt-0.5">
            General Manager
          </span>
        </div>
      )}
    </div>
  );
}
