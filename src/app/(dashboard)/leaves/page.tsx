'use client';

import React, { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { NeuCard } from '@/components/neu/NeuCard';
import { NeuTable } from '@/components/neu/NeuTable';
import { NeuButton } from '@/components/neu/NeuButton';
import { NeuInput } from '@/components/neu/NeuInput';
import { NeuSelect } from '@/components/neu/NeuSelect';
import { NeuBadge, BadgeVariant } from '@/components/neu/NeuBadge';
import { NeuModal } from '@/components/neu/NeuModal';
import { EmptyState } from '@/components/neu/EmptyState';
import { SkeletonCard } from '@/components/neu/SkeletonCard';
import { StatCard } from '@/components/neu/StatCard';
import { CalendarDays, Plus, Search, CheckCircle, XCircle, Clock, Trash2, Download, Filter } from 'lucide-react';
import { format, isAfter, subDays, subMonths } from 'date-fns';
import Papa from 'papaparse';
import { toast } from '@/store/toastStore';
import { playSuccess, playError } from '@/lib/audio';

export default function LeavesPage() {
  const supabase = createClient();
  const [leaves, setLeaves] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [timeFilter, setTimeFilter] = useState('all');
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form State
  const [selectedStaffId, setSelectedStaffId] = useState('');
  const [leaveType, setLeaveType] = useState('Casual Leave');
  const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [reason, setReason] = useState('');

  useEffect(() => {
    async function fetchLeavesAndEmployees() {
      setLoading(true);
      try {
        // Fetch real staff members from profiles table
        const { data: profData } = await supabase
          .from('profiles')
          .select('id, full_name, role')
          .order('full_name', { ascending: true });

        setEmployees(profData || []);
        if (profData && profData.length > 0) {
          setSelectedStaffId(profData[0].id);
        }

        const profileMap = new Map<string, string>();
        (profData || []).forEach(p => {
          if (p.id) profileMap.set(p.id, p.full_name || 'Staff Member');
        });

        // Fetch leave requests
        const { data, error } = await supabase
          .from('leave_requests')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) throw error;

        const mapped = (data || []).map(d => ({
          ...d,
          employee_name: profileMap.get(d.user_id) || 'Staff Member'
        }));

        setLeaves(mapped);
      } catch (err) {
        console.error('Error fetching leave_requests:', err);
        setLeaves([]);
      } finally {
        setLoading(false);
      }
    }
    fetchLeavesAndEmployees();
  }, [supabase]);

  const handleApplyLeave = async (e: React.FormEvent) => {
    e.preventDefault();

    const selectedEmp = employees.find(emp => emp.id === selectedStaffId);
    const empName = selectedEmp?.full_name || 'Staff Member';

    const newLeave = {
      user_id: selectedStaffId || null,
      leave_type: leaveType,
      start_date: startDate,
      end_date: endDate,
      reason,
      status: 'pending',
      created_at: new Date().toISOString(),
    };

    try {
      const { data, error } = await supabase.from('leave_requests').insert([newLeave]).select('*');
      if (!error && data) {
        setLeaves([{
          ...data[0],
          employee_name: empName
        }, ...leaves]);
        playSuccess();
        toast.success('Leave Request Submitted', 'The application has been successfully logged.');
      } else {
        throw error || new Error('Failed to apply leave');
      }
    } catch (err) {
      console.error(err);
      playError();
      toast.error('Submission Failed', 'Could not submit leave request.');
    }

    setIsModalOpen(false);
    setReason('');
  };

  const handleStatusChange = async (id: string, newStatus: string) => {
    try {
      const { error } = await supabase.from('leave_requests').update({ status: newStatus }).eq('id', id);
      if (error) throw error;
      setLeaves(leaves.map(l => l.id === id ? { ...l, status: newStatus } : l));
      playSuccess();
      toast.success('Status Updated', `Leave request is now ${newStatus}.`);
    } catch (err) {
      console.error('Status update error:', err);
      playError();
      toast.error('Update Failed', 'Could not change status.');
    }
  };

  const handleDeleteLeave = async (id: string) => {
    try {
      const { error } = await supabase.from('leave_requests').delete().eq('id', id);
      if (error) throw error;
      setLeaves(prev => prev.filter(l => l.id !== id));
      playSuccess();
      toast.success('Record Deleted', 'Leave request removed.');
    } catch (err) {
      console.error('Leave delete error:', err);
      playError();
      toast.error('Deletion Failed', 'Could not delete the record.');
    }
  };

  const getStatusBadge = (st: string) => {
    let variant: BadgeVariant = 'neutral';
    if (st === 'approved') variant = 'success';
    if (st === 'pending') variant = 'warning';
    if (st === 'rejected') variant = 'error';
    return <NeuBadge variant={variant}>{st || 'pending'}</NeuBadge>;
  };

  const filtered = leaves.filter(l => {
    const matchesSearch = 
      (l.employee_name || '').toLowerCase().includes(search.toLowerCase()) ||
      (l.leave_type || '').toLowerCase().includes(search.toLowerCase()) ||
      (l.reason || '').toLowerCase().includes(search.toLowerCase());

    let matchesTime = true;
    if (timeFilter === 'today') {
      matchesTime = isAfter(new Date(l.created_at), subDays(new Date(), 1));
    } else if (timeFilter === 'week') {
      matchesTime = isAfter(new Date(l.created_at), subDays(new Date(), 7));
    } else if (timeFilter === 'month') {
      matchesTime = isAfter(new Date(l.created_at), subMonths(new Date(), 1));
    }

    return matchesSearch && matchesTime;
  });

  const exportCSV = () => {
    if (filtered.length === 0) {
      toast.warning('No Data', 'There is no data to export.');
      return;
    }
    const csvData = filtered.map(l => ({
      'Employee': l.employee_name,
      'Leave Type': l.leave_type,
      'Start Date': l.start_date,
      'End Date': l.end_date,
      'Reason': l.reason,
      'Status': l.status,
      'Applied Date': l.created_at ? format(new Date(l.created_at), 'MMM dd, yyyy HH:mm') : 'N/A'
    }));
    const csv = Papa.unparse(csvData);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `leaves_report_${format(new Date(), 'yyyy-MM-dd')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    playSuccess();
    toast.success('Export Successful', 'Your CSV file has been downloaded.');
  };

  const pendingCount = leaves.filter(l => l.status === 'pending').length;
  const approvedCount = leaves.filter(l => l.status === 'approved').length;

  const columns = [
    {
      accessorKey: 'employee_name',
      header: 'Employee Name',
      cell: (info: any) => <span className="font-bold text-neu-fg">{info.getValue() || 'Staff Member'}</span>
    },
    {
      accessorKey: 'leave_type',
      header: 'Leave Type',
      cell: (info: any) => <span className="font-medium text-neu-muted">{info.getValue() || 'Leave'}</span>
    },
    {
      accessorKey: 'start_date',
      header: 'Start Date',
      cell: (info: any) => info.getValue() ? format(new Date(info.getValue()), 'MMM dd, yyyy') : 'N/A'
    },
    {
      accessorKey: 'end_date',
      header: 'End Date',
      cell: (info: any) => info.getValue() ? format(new Date(info.getValue()), 'MMM dd, yyyy') : 'N/A'
    },
    {
      accessorKey: 'reason',
      header: 'Reason',
      cell: (info: any) => <span className="truncate max-w-[200px] block text-neu-muted">{info.getValue() || 'N/A'}</span>
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: (info: any) => getStatusBadge(info.getValue())
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: (info: any) => {
        const item = info.row.original;
        return (
          <div className="flex items-center gap-2">
            {item.status === 'pending' && (
              <>
                <button 
                  onClick={() => handleStatusChange(item.id, 'approved')} 
                  className="p-1 text-neu-accent-secondary hover:scale-110 transition-transform cursor-pointer" 
                  title="Approve"
                >
                  <CheckCircle size={18} />
                </button>
                <button 
                  onClick={() => handleStatusChange(item.id, 'rejected')} 
                  className="p-1 text-red-500 hover:scale-110 transition-transform cursor-pointer" 
                  title="Reject"
                >
                  <XCircle size={18} />
                </button>
              </>
            )}
            <button 
              onClick={() => handleDeleteLeave(item.id)} 
              className="p-1 text-neu-muted hover:text-red-500 hover:scale-110 transition-transform cursor-pointer ml-1" 
              title="Delete Leave Request"
            >
              <Trash2 size={16} />
            </button>
          </div>
        );
      }
    }
  ];

  if (loading) {
    return (
      <div className="space-y-6">
        <h2 className="text-xl font-display font-bold text-neu-fg">Leave Applications</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => <SkeletonCard key={i} className="h-32" />)}
        </div>
        <SkeletonCard className="h-[400px]" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-up">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-xl font-display font-bold text-neu-fg">Leave Applications (V-Admin Synced)</h2>
          <p className="text-neu-muted text-sm">Directly synchronized with system database ({leaves.length} records).</p>
        </div>
        <NeuButton onClick={() => setIsModalOpen(true)}>
          <Plus size={18} />
          Record Staff Leave Request
        </NeuButton>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <StatCard title="Total Database Records" value={leaves.length} icon={CalendarDays} />
        <StatCard title="Pending Review" value={pendingCount} icon={Clock} />
        <StatCard title="Approved Leaves" value={approvedCount} icon={CheckCircle} />
      </div>

      <NeuCard className="p-4 flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="w-full md:max-w-md">
          <NeuInput 
            placeholder="Search by employee, leave type, or reason..." 
            icon={<Search size={18} />}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="w-full md:w-48">
            <NeuSelect 
              value={timeFilter}
              onChange={(e) => setTimeFilter(e.target.value)}
              options={[
                { label: 'All Time', value: 'all' },
                { label: 'Applied Today', value: 'today' },
                { label: 'Applied This Week', value: 'week' },
                { label: 'Applied This Month', value: 'month' },
              ]}
            />
          </div>
          <NeuButton variant="secondary" onClick={exportCSV} className="shrink-0">
            <Download size={18} />
            <span className="hidden sm:inline">Export</span>
          </NeuButton>
        </div>
      </NeuCard>

      {filtered.length === 0 ? (
        <NeuCard>
          <EmptyState 
            icon={CalendarDays} 
            title="No leave records found" 
            description="No leave applications match your search in the system database."
            action={
              <NeuButton variant="secondary" onClick={() => setIsModalOpen(true)}>
                <Plus size={18} />
                Record Staff Leave Request
              </NeuButton>
            }
          />
        </NeuCard>
      ) : (
        <NeuTable data={filtered} columns={columns} />
      )}

      {/* Record Staff Leave Modal */}
      <NeuModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Record Staff Leave Request">
        <form onSubmit={handleApplyLeave} className="space-y-4">
          <NeuSelect 
            label="Select Staff Member (Profiles)" 
            options={employees.map(e => ({ 
              label: `${e.full_name || 'Staff Member'} (${e.role || 'Staff'})`, 
              value: e.id 
            }))} 
            value={selectedStaffId}
            onChange={(e) => setSelectedStaffId(e.target.value)}
          />

          <NeuSelect 
            label="Leave Type" 
            options={[
              { label: 'Casual Leave (CL)', value: 'Casual Leave' },
              { label: 'Sick Leave (SL)', value: 'Sick Leave' },
              { label: 'Paid Leave (PL)', value: 'Paid Leave' },
              { label: 'Emergency Leave', value: 'Emergency Leave' },
            ]} 
            value={leaveType}
            onChange={(e) => setLeaveType(e.target.value)}
          />

          <div className="grid grid-cols-2 gap-4">
            <NeuInput 
              label="Start Date" 
              type="date"
              value={startDate} 
              onChange={(e) => setStartDate(e.target.value)} 
              required 
            />
            <NeuInput 
              label="End Date" 
              type="date"
              value={endDate} 
              onChange={(e) => setEndDate(e.target.value)} 
              required 
            />
          </div>

          <NeuInput 
            label="Reason / Remarks" 
            placeholder="Enter reason for leave application..." 
            value={reason} 
            onChange={(e) => setReason(e.target.value)} 
            required 
          />

          <div className="flex justify-end gap-3 pt-4">
            <NeuButton type="button" variant="secondary" onClick={() => setIsModalOpen(false)}>
              Cancel
            </NeuButton>
            <NeuButton type="submit">
              Submit Leave Request
            </NeuButton>
          </div>
        </form>
      </NeuModal>
    </div>
  );
}
