'use client';

import React, { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { NeuTable } from '@/components/neu/NeuTable';
import { NeuCard } from '@/components/neu/NeuCard';
import { NeuButton } from '@/components/neu/NeuButton';
import { NeuInput } from '@/components/neu/NeuInput';
import { NeuSelect } from '@/components/neu/NeuSelect';
import { NeuModal } from '@/components/neu/NeuModal';
import { EmptyState } from '@/components/neu/EmptyState';
import { SkeletonCard } from '@/components/neu/SkeletonCard';
import { StatCard } from '@/components/neu/StatCard';
import { Plus, Search, UserCheck, Users, ShieldCheck, Trash2, Download, AlertTriangle } from 'lucide-react';
import { format, isAfter, subDays, subMonths } from 'date-fns';
import Papa from 'papaparse';
import { toast } from '@/store/toastStore';
import { playSuccess, playError } from '@/lib/audio';

export default function TeamsPage() {
  const supabase = createClient();
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [timeFilter, setTimeFilter] = useState('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);

  // Form State
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState('field_executive');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');

  const fetchEmployees = async () => {
    setLoading(true);
    try {
      // Query ONLY active users (exclude deleted/inactive accounts)
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('is_active', true)
        .order('full_name', { ascending: true });

      if (error) throw error;
      setEmployees(data || []);
    } catch (err) {
      console.error('Error fetching employees:', err);
      setEmployees([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmployees();

    const profilesChannel = supabase
      .channel('realtime_profiles_teams')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => {
        fetchEmployees();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(profilesChannel);
    };
  }, [supabase]);

  const handleAddStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    const newStaff = {
      full_name: fullName || 'New Staff',
      role,
      phone: phone || null,
      email: email || null,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    try {
      const { data, error } = await supabase
        .from('profiles')
        .insert([newStaff])
        .select('*');

      if (!error && data) {
        setEmployees(prev => [...prev, data[0]].sort((a, b) => (a.full_name || '').localeCompare(b.full_name || '')));
        playSuccess();
        toast.success('Staff Registered', `${fullName} has been added to active team.`);
      } else {
        throw error;
      }
    } catch (err) {
      console.error('Error adding staff:', err);
      playError();
      toast.error('Registration Failed', 'Could not register staff member.');
    }
    
    setIsModalOpen(false);
    setFullName('');
    setPhone('');
    setEmail('');
  };

  const [isDeleting, setIsDeleting] = useState(false);

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);

    try {
      // Soft-delete: mark is_active = false so historical attendance records remain intact while user is removed from portal
      const { error } = await supabase
        .from('profiles')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('id', deleteTarget.id);

      if (error) throw error;

      // Create audit log entry
      try {
        await supabase.from('audit_logs').insert([{
          action: 'Staff Deactivated',
          table_name: 'profiles',
          record_id: deleteTarget.id,
          user_id: deleteTarget.id,
          created_at: new Date().toISOString()
        }]);
      } catch (auditErr) {
        console.warn('Audit log write error:', auditErr);
      }

      setEmployees(prev => prev.filter(e => e.id !== deleteTarget.id));
      playSuccess();
      toast.success('Staff Deactivated', `${deleteTarget.full_name} has been removed from active staff.`);
      setDeleteTarget(null);
    } catch (err: any) {
      console.error('Error removing staff:', err);
      playError();
      toast.error('Deactivation Failed', err?.message || 'Could not deactivate staff member.');
    } finally {
      setIsDeleting(false);
    }
  };

  const filteredEmployees = employees.filter(e => {
    if (e.is_active === false) return false;

    const matchesSearch = 
      (e.full_name || '').toLowerCase().includes(search.toLowerCase()) ||
      (e.phone || '').includes(search) ||
      (e.email || '').toLowerCase().includes(search.toLowerCase()) ||
      (e.role || '').toLowerCase().includes(search.toLowerCase());

    let matchesTime = true;
    if (timeFilter === 'today') {
      matchesTime = isAfter(new Date(e.created_at), subDays(new Date(), 1));
    } else if (timeFilter === 'week') {
      matchesTime = isAfter(new Date(e.created_at), subDays(new Date(), 7));
    } else if (timeFilter === 'month') {
      matchesTime = isAfter(new Date(e.created_at), subMonths(new Date(), 1));
    }

    return matchesSearch && matchesTime;
  });

  const exportCSV = () => {
    if (filteredEmployees.length === 0) {
      toast.warning('No Data', 'There is no data to export.');
      return;
    }
    const csvData = filteredEmployees.map(e => ({
      'Full Name': e.full_name,
      'Role': e.role,
      'Email': e.email || 'N/A',
      'Phone': e.phone || 'N/A',
      'Status': 'Active',
      'Created At': e.created_at ? format(new Date(e.created_at), 'yyyy-MM-dd HH:mm') : 'N/A'
    }));
    const csv = Papa.unparse(csvData);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Active_Staff_Team_${format(new Date(), 'yyyy-MM-dd')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    playSuccess();
    toast.success('Export Successful', 'Active staff CSV downloaded.');
  };

  const columns = [
    {
      accessorKey: 'full_name',
      header: 'Full Name',
      cell: (info: any) => (
        <div className="flex items-center gap-2">
          <UserCheck size={16} className="text-neu-accent shrink-0" />
          <span className="font-bold text-neu-fg">{info.getValue() || 'Staff Member'}</span>
        </div>
      )
    },
    {
      accessorKey: 'role',
      header: 'Assigned Role',
      cell: (info: any) => (
        <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-neu-accent/10 text-neu-accent">
          {info.getValue() || 'Executive'}
        </span>
      )
    },
    {
      accessorKey: 'email',
      header: 'Email Address',
      cell: (info: any) => <span className="text-neu-muted text-xs font-mono">{info.getValue() || 'N/A'}</span>
    },
    {
      accessorKey: 'phone',
      header: 'Phone Number',
      cell: (info: any) => <span className="text-neu-fg text-xs font-mono">{info.getValue() || 'N/A'}</span>
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: (info: any) => {
        const item = info.row.original;
        return (
          <button 
            onClick={() => setDeleteTarget(item)} 
            className="p-1.5 rounded-lg bg-neu-bg shadow-neu-small hover:shadow-neu-lifted text-neu-muted hover:text-red-500 transition-all cursor-pointer" 
            title={`Remove ${item.full_name}`}
          >
            <Trash2 size={14} />
          </button>
        );
      }
    }
  ];

  if (loading) {
    return (
      <div className="space-y-6">
        <h2 className="text-xl font-display font-bold text-neu-fg">Active Personnel Management</h2>
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
          <h2 className="text-xl font-display font-bold text-neu-fg">Active Personnel & Staff Team</h2>
          <p className="text-neu-muted text-sm">Managing active authorized staff accounts ({filteredEmployees.length} active members).</p>
        </div>
        <div className="flex gap-3">
          <NeuButton variant="secondary" onClick={exportCSV}>
            <Download size={16} />
            Export CSV
          </NeuButton>
          <NeuButton onClick={() => setIsModalOpen(true)}>
            <Plus size={18} />
            Register New Staff
          </NeuButton>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <StatCard title="Active Team Members" value={filteredEmployees.length} icon={Users} />
        <StatCard title="Field Operations" value={filteredEmployees.filter(e => e.role === 'field_executive' || e.role === 'cleaner').length} icon={UserCheck} />
        <StatCard title="Supervisors & Admins" value={filteredEmployees.filter(e => e.role === 'admin' || e.role === 'manager' || e.role === 'supervisor').length} icon={ShieldCheck} />
      </div>

      <NeuCard className="p-4 flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="w-full md:max-w-md">
          <NeuInput 
            placeholder="Search active staff by name, email, role, or phone..." 
            icon={<Search size={18} />}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="w-full md:w-48">
          <NeuSelect 
            value={timeFilter}
            onChange={(e) => setTimeFilter(e.target.value)}
            options={[
              { label: 'All Active Staff', value: 'all' },
              { label: 'Registered Today', value: 'today' },
              { label: 'Registered This Week', value: 'week' },
              { label: 'Registered This Month', value: 'month' },
            ]}
          />
        </div>
      </NeuCard>

      {filteredEmployees.length === 0 ? (
        <NeuCard>
          <EmptyState 
            icon={Users} 
            title="No active staff members found" 
            description="No active employees matching your filter."
            action={
              <NeuButton variant="secondary" onClick={() => setIsModalOpen(true)}>
                <Plus size={18} />
                Register New Staff
              </NeuButton>
            }
          />
        </NeuCard>
      ) : (
        <NeuTable data={filteredEmployees} columns={columns} />
      )}

      {/* Register Staff Modal */}
      <NeuModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Register Active Staff Member">
        <form onSubmit={handleAddStaff} className="space-y-4">
          <NeuInput 
            label="Full Name" 
            placeholder="e.g. Anand Kumar" 
            value={fullName} 
            onChange={(e) => setFullName(e.target.value)} 
            required 
          />

          <NeuSelect 
            label="Staff Role" 
            options={[
              { label: 'Field Executive', value: 'field_executive' },
              { label: 'Facility Supervisor', value: 'supervisor' },
              { label: 'General Manager', value: 'manager' },
              { label: 'Operations Admin', value: 'admin' },
              { label: 'Support Executive', value: 'support' },
              { label: 'Sales Executive', value: 'sales' },
            ]} 
            value={role}
            onChange={(e) => setRole(e.target.value)}
          />

          <NeuInput 
            label="Email Address" 
            type="email"
            placeholder="e.g. anand@vyess.com" 
            value={email} 
            onChange={(e) => setEmail(e.target.value)} 
          />

          <NeuInput 
            label="Phone Number" 
            type="tel"
            placeholder="e.g. +91 9876543210" 
            value={phone} 
            onChange={(e) => setPhone(e.target.value)} 
          />

          <div className="flex justify-end gap-3 pt-4">
            <NeuButton type="button" variant="secondary" onClick={() => setIsModalOpen(false)}>
              Cancel
            </NeuButton>
            <NeuButton type="submit">
              Register Staff Member
            </NeuButton>
          </div>
        </form>
      </NeuModal>

      {/* Double Confirmation Delete Modal */}
      <NeuModal isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Confirm Staff Deactivation">
        <div className="space-y-4">
          <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-start gap-3">
            <AlertTriangle className="text-amber-500 shrink-0 mt-0.5" size={20} />
            <div>
              <p className="font-bold text-sm text-neu-fg">Remove Staff Member?</p>
              <p className="text-xs text-neu-muted mt-1">
                Are you sure you want to deactivate <strong className="text-neu-fg font-bold">{deleteTarget?.full_name}</strong> ({deleteTarget?.email || 'Staff'})? They will be immediately removed from all active lists, dropdowns, and portal views.
              </p>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <NeuButton variant="secondary" onClick={() => setDeleteTarget(null)} disabled={isDeleting}>
              Cancel
            </NeuButton>
            <button 
              onClick={handleConfirmDelete}
              disabled={isDeleting}
              className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 active:scale-95 text-white font-bold text-xs shadow-neu-raised transition-all cursor-pointer disabled:opacity-50"
            >
              {isDeleting ? 'Deactivating...' : 'Confirm Deactivation'}
            </button>
          </div>
        </div>
      </NeuModal>
    </div>
  );
}
