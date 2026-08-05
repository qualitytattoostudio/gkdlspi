'use client';

import React, { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Bell, User, LogOut, Menu } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useAppStore } from '@/store/appStore';
import { playClick, playToggle } from '@/lib/audio';

export function TopBar() {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const [userName, setUserName] = useState<string>('');
  const [userRole, setUserRole] = useState<string>('');
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const { toggleSidebar } = useAppStore();

  useEffect(() => {
    async function loadUser() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase.from('profiles').select('full_name, role').eq('id', user.id).single();
        if (data) {
          setUserName(data.full_name || user.email || 'Admin Manager');
          setUserRole(data.role || 'Manager');
        } else {
          setUserName(user.email || 'Admin Manager');
          setUserRole('Manager');
        }
      }
    }

    async function loadNotifications() {
      const { data } = await supabase
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5);
      
      if (data) {
        setNotifications(data);
        setUnreadCount(data.length);
      }
    }

    loadUser();
    loadNotifications();
  }, [supabase]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  const getPageTitle = () => {
    const path = pathname.split('/')[1];
    if (!path) return 'Dashboard';
    return path.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  };

  return (
    <header className="h-16 lg:h-20 shrink-0 px-4 lg:px-6 flex items-center justify-between z-10 border-b border-neu-muted/10">
      <div className="flex items-center gap-3">
        <button
          onClick={() => { playToggle(); toggleSidebar(); }}
          className="lg:hidden w-10 h-10 rounded-xl flex items-center justify-center bg-neu-bg shadow-neu-small text-neu-muted hover:text-neu-accent active:shadow-neu-inset transition-all"
          aria-label="Toggle Navigation"
        >
          <Menu size={20} />
        </button>
        <h1 className="text-xl lg:text-2xl font-display font-bold text-neu-fg tracking-tight hidden sm:block">{getPageTitle()}</h1>
        <span className="text-[9px] lg:text-[10px] font-black uppercase tracking-wider text-neu-accent bg-neu-accent/15 px-2 lg:px-2.5 py-0.5 rounded-full shadow-neu-small border border-neu-accent/20 select-none hidden sm:block">
          V-Syncer Pro
        </span>
      </div>

      <div className="flex items-center gap-3 lg:gap-6 relative">
        <div className="relative">
          <button 
            onClick={() => {
              playClick();
              setShowNotifications(!showNotifications);
              setUnreadCount(0);
            }}
            className="w-11 h-11 rounded-full bg-neu-bg shadow-neu-small flex items-center justify-center text-neu-muted hover:text-neu-accent hover:shadow-neu-lifted active:shadow-neu-inset transition-all cursor-pointer relative"
            title="Notifications"
          >
            <Bell size={18} />
            {unreadCount > 0 && (
              <span className="absolute top-2 right-2 w-2 h-2 bg-neu-accent rounded-full animate-pulse"></span>
            )}
          </button>

          {showNotifications && (
            <div className="absolute top-14 right-0 w-80 bg-neu-bg shadow-neu-lifted rounded-2xl p-4 z-50 border border-neu-muted/10 animate-fade-in-down">
              <div className="flex items-center justify-between mb-3 border-b border-neu-muted/10 pb-2">
                <h3 className="font-bold text-sm text-neu-fg">System Notifications</h3>
                <span className="text-[10px] text-neu-accent font-bold bg-neu-accent/10 px-2 py-0.5 rounded-full">Recent</span>
              </div>
              <div className="space-y-3 max-h-64 overflow-y-auto scrollbar-hide">
                {notifications.length === 0 ? (
                  <p className="text-xs text-neu-muted text-center py-4">No new notifications</p>
                ) : (
                  notifications.map((notif, i) => (
                    <div key={i} className="flex flex-col gap-1 p-2 rounded-lg hover:bg-neu-bg hover:shadow-neu-inset-sm transition-all">
                      <p className="text-xs font-bold text-neu-fg">{notif.action || 'System Action'}</p>
                      <p className="text-[10px] text-neu-muted truncate">
                        {notif.entity ? `Updated ${notif.entity}` : (notif.details ? JSON.stringify(notif.details).substring(0, 50) + '...' : 'New activity recorded')}
                      </p>
                      <span className="text-[9px] text-neu-muted/70">
                        {notif.created_at ? new Date(notif.created_at).toLocaleString() : 'Just now'}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 lg:gap-4 pl-2 lg:pl-4 border-l border-neu-muted/20">
          <div className="hidden md:flex flex-col items-end">
            <span className="text-sm font-bold text-neu-fg">{userName}</span>
            <span className="text-xs text-neu-muted capitalize font-medium">{userRole}</span>
          </div>
          <div className="w-9 h-9 lg:w-11 lg:h-11 rounded-full bg-neu-bg shadow-neu-inset-deep flex items-center justify-center text-neu-accent shrink-0">
            <User size={16} className="lg:w-[18px] lg:h-[18px]" />
          </div>
          <button 
            onClick={() => { playClick(); handleLogout(); }} 
            className="w-9 h-9 rounded-xl bg-neu-bg shadow-neu-small flex items-center justify-center text-neu-muted hover:text-red-500 hover:shadow-neu-lifted active:shadow-neu-inset transition-all ml-2 cursor-pointer"
            title="Sign Out"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </header>
  );
}
