'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAppStore } from '@/store/appStore';
import { VSyncerLogo } from '@/components/brand/Logo';
import { cn } from '@/lib/utils';
import { playClick, playToggle } from '@/lib/audio';
import {
  LayoutDashboard,
  ClipboardList,
  Users,
  UserCheck,
  Clock,
  MapPin,
  Package,
  Wrench,
  Receipt,
  CalendarDays,
  AlertTriangle,
  CheckCircle,
  FileText,
  Calendar,
  Target,
  IndianRupee,
  BarChart,
  CheckSquare,
  Settings,
  Menu,
  ChevronLeft,
  X,
  Star,
  Truck,
  ShoppingBag,
  TrendingUp,
  CalendarRange,
  Award
} from 'lucide-react';

const MENU_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/jobs', label: 'Jobs', icon: ClipboardList },
  { href: '/customers', label: 'Customers', icon: Users },
  { href: '/teams', label: 'Teams', icon: UserCheck },
  { href: '/attendance', label: 'Attendance', icon: Clock },
  { href: '/live-tracking', label: 'Live Tracking', icon: MapPin },
  { href: '/inventory', label: 'Inventory', icon: Package },
  { href: '/assets', label: 'Assets', icon: Wrench },
  { href: '/fleet', label: 'Fleet & Vehicles', icon: Truck },
  { href: '/procurement', label: 'Procurement', icon: ShoppingBag },
  { href: '/sales', label: 'Sales & Quotes', icon: TrendingUp },
  { href: '/rostering', label: 'Rostering & Sites', icon: CalendarRange },
  { href: '/performance', label: 'Performance', icon: Award },
  { href: '/expenses', label: 'Expenses', icon: Receipt },
  { href: '/leaves', label: 'Leaves', icon: CalendarDays },
  { href: '/complaints', label: 'Complaints', icon: AlertTriangle },
  { href: '/quality', label: 'Quality', icon: CheckCircle },
  { href: '/reviews', label: 'Reviews', icon: Star },
  { href: '/contracts', label: 'Contracts', icon: FileText },
  { href: '/calendar', label: 'Calendar', icon: Calendar },
  { href: '/targets', label: 'Targets', icon: Target },
  { href: '/financials', label: 'Financials', icon: IndianRupee },
  { href: '/reports', label: 'Reports', icon: BarChart },
  { href: '/approvals', label: 'Approvals', icon: CheckSquare },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const { isSidebarOpen, toggleSidebar } = useAppStore();

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {isSidebarOpen && (
        <div 
          onClick={toggleSidebar}
          className="fixed inset-0 bg-slate-950/20 backdrop-blur-xs z-30 lg:hidden transition-opacity" 
        />
      )}

      <aside
        className={cn(
          'fixed lg:static inset-y-0 left-0 z-40 bg-neu-bg transition-all duration-300 ease-in-out flex flex-col border-r border-neu-muted/10 shrink-0',
          isSidebarOpen ? 'w-64 translate-x-0' : '-translate-x-full lg:translate-x-0 lg:w-20'
        )}
      >
        {/* Header with Brand Logo */}
        <div className="h-20 flex items-center justify-between px-5 shrink-0 border-b border-neu-muted/10">
          <Link href="/dashboard" className={cn('overflow-hidden', !isSidebarOpen && 'hidden')}>
            <VSyncerLogo size="sm" showText={true} />
          </Link>
          {!isSidebarOpen && (
            <Link href="/dashboard" className="mx-auto">
              <VSyncerLogo size="sm" showText={false} />
            </Link>
          )}
          
          <button
            onClick={() => { playToggle(); toggleSidebar(); }}
            className="hidden lg:flex w-9 h-9 rounded-xl items-center justify-center bg-neu-bg shadow-neu-small hover:shadow-neu-lifted active:shadow-neu-inset transition-all shrink-0 ml-auto"
            aria-label="Toggle Navigation"
          >
            {isSidebarOpen ? <ChevronLeft size={18} /> : <Menu size={18} />}
          </button>
        </div>

        {/* Scrollable Navigation Items */}
        <nav className="flex-1 overflow-y-auto px-3.5 py-4 space-y-1.5 pb-24 scrollbar-hide">
          {MENU_ITEMS.map((item) => {
            const isActive = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center h-11 rounded-2xl transition-all duration-300 group',
                  isSidebarOpen ? 'px-4 gap-3.5' : 'justify-center',
                  isActive
                    ? 'bg-neu-bg shadow-neu-inset-deep text-neu-accent font-bold'
                    : 'text-neu-muted hover:text-neu-fg hover:shadow-neu-small hover:-translate-y-px'
                )}
                onClick={playClick}
                title={!isSidebarOpen ? item.label : undefined}
              >
                <item.icon size={19} className={cn('shrink-0', isActive ? 'text-neu-accent' : '')} />
                {isSidebarOpen && (
                  <span className="font-medium text-sm truncate">{item.label}</span>
                )}
              </Link>
            );
          })}
        </nav>
      </aside>
    </>
  );
}
