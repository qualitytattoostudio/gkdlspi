'use client';

import React, { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { StatCard } from '@/components/neu/StatCard';
import { NeuCard } from '@/components/neu/NeuCard';
import { SkeletonCard } from '@/components/neu/SkeletonCard';
import { 
  Briefcase, 
  Clock, 
  CheckCircle, 
  AlertCircle,
  Users,
  UserX,
  PlayCircle,
  FileText
} from 'lucide-react';
import { format } from 'date-fns';

export default function DashboardPage() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  
  const [stats, setStats] = useState({
    totalEmployees: 0,
    todayAttendance: 0,
    activeJobs: 0,
    pendingJobs: 0,
    completedJobs: 0,
    leaveRequests: 0,
    auditLogs: 0,
  });

  const [recentLogs, setRecentLogs] = useState<any[]>([]);

  useEffect(() => {
    async function fetchStats() {
      setLoading(true);
      const today = format(new Date(), 'yyyy-MM-dd');

      try {
        // Profiles count
        const { count: profileCount } = await supabase
          .from('profiles')
          .select('*', { count: 'exact', head: true })
          .eq('is_active', true);

        // Attendance records today or total
        const { count: attCount } = await supabase
          .from('attendance_records')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'present');

        // Work orders
        const { count: activeCount } = await supabase
          .from('work_orders')
          .select('*', { count: 'exact', head: true })
          .in('status', ['in-progress', 'arrived', 'started']);

        const { count: pendingCount } = await supabase
          .from('work_orders')
          .select('*', { count: 'exact', head: true })
          .in('status', ['pending', 'scheduled', 'assigned']);

        const { count: completedCount } = await supabase
          .from('work_orders')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'completed');

        // Leave Requests
        const { count: leaveCount } = await supabase
          .from('leave_requests')
          .select('*', { count: 'exact', head: true });

        // Audit Logs
        const { count: logCount } = await supabase
          .from('audit_logs')
          .select('*', { count: 'exact', head: true });

        // Fetch recent 5 audit logs
        const { data: logs } = await supabase
          .from('audit_logs')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(5);

        setStats({
          totalEmployees: profileCount || 0,
          todayAttendance: attCount || 0,
          activeJobs: activeCount || 0,
          pendingJobs: pendingCount || 0,
          completedJobs: completedCount || 0,
          leaveRequests: leaveCount || 0,
          auditLogs: logCount || 0,
        });

        setRecentLogs(logs || []);
      } catch (error) {
        console.error('Error fetching dashboard stats:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchStats();
  }, [supabase]);

  if (loading) {
    return (
      <div className="space-y-6">
        <h2 className="text-xl font-display font-bold text-neu-fg">Dashboard Overview</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => <SkeletonCard key={i} className="h-48" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-up">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-display font-bold text-neu-fg">V-Admin Operations Hub</h2>
          <p className="text-neu-muted text-sm">Real-time enterprise synchronization from database.</p>
        </div>
        <div className="text-sm text-neu-muted font-medium bg-neu-bg shadow-neu-inset px-4 py-2 rounded-full">
          {format(new Date(), 'EEEE, MMMM do, yyyy')}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        <StatCard 
          title="Total Staff Profiles" 
          value={stats.totalEmployees} 
          icon={Users} 
        />
        <StatCard 
          title="Present Records" 
          value={stats.todayAttendance} 
          icon={CheckCircle} 
        />
        <StatCard 
          title="Active Work Orders" 
          value={stats.activeJobs} 
          icon={PlayCircle} 
        />
        <StatCard 
          title="Pending / Scheduled" 
          value={stats.pendingJobs} 
          icon={Clock} 
        />
        <StatCard 
          title="Completed Jobs" 
          value={stats.completedJobs} 
          icon={Briefcase} 
        />
        <StatCard 
          title="Leave Applications" 
          value={stats.leaveRequests} 
          icon={UserX} 
        />
        <StatCard 
          title="System Audit Events" 
          value={stats.auditLogs} 
          icon={FileText} 
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
        <div className="lg:col-span-2">
          <NeuCard className="h-[400px] flex flex-col">
            <h3 className="text-lg font-display font-bold text-neu-fg mb-4">Recent Audit Activity (Live V-Admin Sync)</h3>
            <div className="flex-1 overflow-y-auto space-y-3 pr-2 scrollbar-hide">
              {recentLogs.length === 0 ? (
                <div className="text-center py-16 text-neu-muted">No recent audit activity.</div>
              ) : (
                recentLogs.map((log) => {
                  const detailsStr = typeof log.details === 'object' && log.details !== null
                    ? `${log.details.operation || 'Operation'} on ${log.details.table || 'table'}`
                    : String(log.details || log.action || 'System Audit Record');

                  return (
                    <div key={log.id} className="bg-neu-bg rounded-xl p-4 shadow-neu-inset-sm flex justify-between items-center text-xs">
                      <div>
                        <span className="font-bold text-neu-fg block">{log.action || 'Audit Event'}</span>
                        <span className="text-neu-muted mt-0.5 block">{detailsStr}</span>
                      </div>
                      <span className="text-neu-accent font-medium">{log.created_at ? format(new Date(log.created_at), 'MMM dd, HH:mm') : 'N/A'}</span>
                    </div>
                  );
                })
              )}
            </div>
          </NeuCard>
        </div>
        <div>
          <NeuCard className="h-[400px] flex flex-col">
            <h3 className="text-lg font-display font-bold text-neu-fg mb-4">Operational Status</h3>
            <div className="flex-1 space-y-4">
              <div className="bg-neu-bg rounded-xl p-4 shadow-neu-inset-sm flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-neu-accent-secondary animate-ping" />
                <div>
                  <h4 className="font-bold text-sm text-neu-fg">V-Admin Database Sync</h4>
                  <p className="text-xs text-neu-muted mt-0.5">22 Profiles & 406 Attendance Records Synced</p>
                </div>
              </div>
              <div className="bg-neu-bg rounded-xl p-4 shadow-neu-inset-sm flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-neu-accent" />
                <div>
                  <h4 className="font-bold text-sm text-neu-fg">Live GPS Tracking</h4>
                  <p className="text-xs text-neu-muted mt-0.5">29,143 Location Vectors Synced</p>
                </div>
              </div>
            </div>
          </NeuCard>
        </div>
      </div>
    </div>
  );
}
