'use client';

import React, { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { NeuCard } from '@/components/neu/NeuCard';
import { NeuButton } from '@/components/neu/NeuButton';
import { NeuBadge, BadgeVariant } from '@/components/neu/NeuBadge';
import { StatCard } from '@/components/neu/StatCard';
import { EmptyState } from '@/components/neu/EmptyState';
import { SkeletonCard } from '@/components/neu/SkeletonCard';
import { CheckSquare, XCircle, CheckCircle, Clock, Users } from 'lucide-react';
import { format } from 'date-fns';

export default function ApprovalsPage() {
  const supabase = createClient();
  const [leaves, setLeaves] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'leaves' | 'all'>('leaves');

  useEffect(() => {
    async function fetchPendingItems() {
      setLoading(true);
      try {
        // Fetch profiles map
        const { data: profiles } = await supabase.from('profiles').select('id, full_name');
        const profileMap = new Map<string, string>();
        (profiles || []).forEach(p => { if (p.id) profileMap.set(p.id, p.full_name || 'Staff'); });

        // Fetch ALL leave requests (pending + recent decisions)
        const { data: leaveData, error } = await supabase
          .from('leave_requests')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) throw error;

        const mapped = (leaveData || []).map(l => ({
          ...l,
          employee_name: profileMap.get(l.user_id) || 'Staff Member',
        }));
        setLeaves(mapped);
      } catch (err) {
        console.error('Error fetching approvals:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchPendingItems();
  }, [supabase]);

  const handleApprove = async (id: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    try {
      const { error } = await supabase
        .from('leave_requests')
        .update({ status: 'approved', reviewed_by: user?.id, reviewed_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
      setLeaves(prev => prev.map(l => l.id === id ? { ...l, status: 'approved' } : l));
    } catch (err) {
      console.error('Approve failed:', err);
    }
  };

  const handleReject = async (id: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    try {
      const { error } = await supabase
        .from('leave_requests')
        .update({ status: 'rejected', reviewed_by: user?.id, reviewed_at: new Date().toISOString(), rejection_reason: 'Rejected by Manager' })
        .eq('id', id);
      if (error) throw error;
      setLeaves(prev => prev.map(l => l.id === id ? { ...l, status: 'rejected' } : l));
    } catch (err) {
      console.error('Reject failed:', err);
    }
  };

  const handleApproveAll = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    const pending = leaves.filter(l => l.status === 'pending');
    try {
      for (const l of pending) {
        await supabase.from('leave_requests').update({ status: 'approved', reviewed_by: user?.id, reviewed_at: new Date().toISOString() }).eq('id', l.id);
      }
      setLeaves(prev => prev.map(l => l.status === 'pending' ? { ...l, status: 'approved' } : l));
    } catch (err) {
      console.error('Approve all failed:', err);
    }
  };

  const pending = leaves.filter(l => l.status === 'pending');
  const approved = leaves.filter(l => l.status === 'approved');
  const rejected = leaves.filter(l => l.status === 'rejected');

  const getStatusBadge = (status: string) => {
    const variants: Record<string, BadgeVariant> = { pending: 'warning', approved: 'success', rejected: 'error' };
    return <NeuBadge variant={variants[status] || 'neutral'}>{status}</NeuBadge>;
  };

  const getLeaveTypeBadge = (type: string) => {
    const variants: Record<string, BadgeVariant> = { CL: 'info', SL: 'warning', PL: 'success', LOP: 'error' };
    return <NeuBadge variant={variants[type] || 'neutral'}>{type || 'Leave'}</NeuBadge>;
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <h2 className="text-xl font-display font-bold text-neu-fg">Approval Center</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1,2,3].map(i => <SkeletonCard key={i} className="h-32" />)}
        </div>
        <SkeletonCard className="h-[400px]" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-up">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-xl font-display font-bold text-neu-fg">Manager Approval Center</h2>
          <p className="text-neu-muted text-sm">Review and action leave requests synced from v-attendee ({leaves.length} total records).</p>
        </div>
        {pending.length > 0 && (
          <NeuButton onClick={handleApproveAll}>
            <CheckCircle size={18} />
            Approve All Pending ({pending.length})
          </NeuButton>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <StatCard title="Pending Review" value={pending.length} icon={Clock} />
        <StatCard title="Approved" value={approved.length} icon={CheckCircle} />
        <StatCard title="Rejected" value={rejected.length} icon={XCircle} />
      </div>

      {leaves.length === 0 ? (
        <NeuCard>
          <EmptyState icon={CheckSquare} title="No leave requests found" description="All leave requests submitted via v-attendee mobile app will appear here for review." />
        </NeuCard>
      ) : (
        <div className="space-y-4">
          {leaves.map(leave => (
            <NeuCard key={leave.id} className="p-5">
              <div className="flex flex-col md:flex-row justify-between items-start gap-4">
                <div className="flex-1 space-y-2">
                  <div className="flex items-center flex-wrap gap-2">
                    <span className="font-display font-bold text-neu-fg">{leave.employee_name}</span>
                    {getLeaveTypeBadge(leave.leave_type)}
                    {getStatusBadge(leave.status)}
                  </div>
                  <div className="text-sm text-neu-muted">
                    <span className="font-medium">{leave.start_date ? format(new Date(leave.start_date), 'MMM dd') : '—'}</span>
                    {' → '}
                    <span className="font-medium">{leave.end_date ? format(new Date(leave.end_date), 'MMM dd, yyyy') : '—'}</span>
                  </div>
                  {leave.reason && <p className="text-xs text-neu-muted bg-neu-bg shadow-neu-inset-sm rounded-lg px-3 py-2 max-w-lg">{leave.reason}</p>}
                  {leave.rejection_reason && <p className="text-xs text-red-500 font-medium">Rejection Note: {leave.rejection_reason}</p>}
                  <p className="text-[11px] text-neu-muted">Submitted: {leave.created_at ? format(new Date(leave.created_at), 'MMM dd, yyyy hh:mm a') : 'N/A'}</p>
                </div>
                {leave.status === 'pending' && (
                  <div className="flex gap-3 shrink-0">
                    <NeuButton onClick={() => handleApprove(leave.id)} variant="secondary">
                      <CheckCircle size={16} className="text-green-600" />
                      Approve
                    </NeuButton>
                    <NeuButton onClick={() => handleReject(leave.id)} variant="secondary">
                      <XCircle size={16} className="text-red-500" />
                      Reject
                    </NeuButton>
                  </div>
                )}
              </div>
            </NeuCard>
          ))}
        </div>
      )}
    </div>
  );
}
