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
import { Plus, Search, UserCheck, Users, ShieldCheck, Trash2, Download, Filter } from 'lucide-react';
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
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Form State
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState('cleaner');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');

  useEffect(() => {
    async function fetchEmployees() {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .order('full_name', { ascending: true });

        if (error) throw error;
        setEmployees((data || []).filter(e => e.is_active !== false));
      } catch (err) {
        console.error('Error fetching employees:', err);
        setEmployees([]);
      } finally {
        setLoading(false);
      }
    }
    fetchEmployees();
  }, [supabase]);

  const handleAddStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    const newStaff = {
      full_name: fullName || 'New Staff',
      role,
      phone: phone || null,
      email: email || null,
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
        toast.success('Staff Added', 'New staff member registered successfully.');
      } else {
        throw error;
      }
    } catch (err) {
      console.error('Error adding staff:', err);
      playError();
      toast.error('Registration Failed', 'Could not add the staff member.');
    }
    
    setIsModalOpen(false);
    setFullName('');
    setPhone('');
    setEmail('');
  };

  const handleDeleteStaff = async (id: string) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .delete()
        .eq('id', id);

      if (error) {
        // If it fails due to foreign key constraints, fallback to soft delete
        if (error.code === '23503' || error.message?.includes('foreign key')) {
          const { error: softError } = await supabase
            .from('profiles')
            .update({ is_active: false, enabled: false })
            .eq('id', id);
            
          if (softError) throw softError;
          
          setEmployees(prev => prev.filter(e => e.id !== id));
          playSuccess();
          toast.success('Staff Deactivated', 'Staff has history records, so their profile was deactivated instead of deleted.');
          setDeleteId(null);
          return;
        }
        throw error;
      }

      setEmployees(prev => prev.filter(e => e.id !== id));
      playSuccess();
      toast.success('Staff Removed', 'The staff profile has been deleted.');
    } catch (err) {
      console.error('Error deleting staff:', err);
      playError();
      toast.error('Deletion Failed', 'Could not remove the staff member.');
    }
    setDeleteId(null);
  };

  const filteredEmployees = employees.filter(e => {
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
      'Phone': e.phone,
      'Email': e.email,
      'Registered Date': e.created_at ? format(new Date(e.created_at), 'MMM dd, yyyy') : 'N/A'
    }));
    const csv = Papa.unparse(csvData);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `teams_report_${format(new Date(), 'yyyy-MM-dd')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    playSuccess();
    toast.success('Export Successful', 'Your CSV file has been downloaded.');
  };

  const columns = [
    {
      accessorKey: 'full_name',
      header: 'Full Name',
      cell: (info: any) => <span className="font-bold text-neu-fg">{info.getValue() || 'Employee'}</span>
    },
    {
      accessorKey: 'role',
      header: 'Role',
      cell: (info: any) => <span className="capitalize font-semibold text-neu-accent">{info.getValue() || 'Staff'}</span>
    },
    {
      accessorKey: 'phone',
      header: 'Phone',
      cell: (info: any) => info.getValue() || 'N/A'
    },
    {
      accessorKey: 'email',
      header: 'Email',
      cell: (info: any) => info.getValue() || 'N/A'
    },
    {
      accessorKey: 'created_at',
      header: 'Registered',
      cell: (info: any) => info.getValue() ? format(new Date(info.getValue()), 'MMM dd, yyyy') : 'N/A'
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: (info: any) => (
        <button 
          onClick={(e) => {
            e.stopPropagation();
            setDeleteId(info.row.original.id);
          }}
          className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
          title="Delete Staff"
        >
          <Trash2 size={18} />
        </button>
      )
    },
  ];

  if (loading) {
    return (
      <div className="space-y-6">
        <h2 className="text-xl font-display font-bold text-neu-fg">Team & Staff Directory</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => <SkeletonCard key={i} className="h-32" />)}
        </div>
        <SkeletonCard className="h-[400px]" />
      </div>
    );
  }

  const supervisorsCount = employees.filter(e => e.role === 'supervisor' || e.role === 'manager' || e.role === 'gm').length;
  const cleanersCount = employees.filter(e => e.role === 'cleaner' || e.role === 'worker' || e.role === 'staff').length;

  return (
    <div className="space-y-6 animate-fade-up">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-xl font-display font-bold text-neu-fg">Team & Staff Directory (V-Admin Synced)</h2>
          <p className="text-neu-muted text-sm">Directly synchronized with system database ({employees.length} records).</p>
        </div>
        <NeuButton onClick={() => setIsModalOpen(true)}>
          <Plus size={18} />
          Add Staff
        </NeuButton>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <StatCard title="Total Registered Staff" value={employees.length} icon={Users} />
        <StatCard title="Supervisors & Managers" value={supervisorsCount} icon={ShieldCheck} />
        <StatCard title="Field Operations Staff" value={cleanersCount || (employees.length - supervisorsCount)} icon={UserCheck} />
      </div>

      <NeuCard className="p-4 flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="w-full md:max-w-md">
          <NeuInput 
            placeholder="Search by name, role, phone, or email..." 
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
                { label: 'Registered Today', value: 'today' },
                { label: 'Registered This Week', value: 'week' },
                { label: 'Registered This Month', value: 'month' },
              ]}
            />
          </div>
          <NeuButton variant="secondary" onClick={exportCSV} className="shrink-0">
            <Download size={18} />
            <span className="hidden sm:inline">Export</span>
          </NeuButton>
        </div>
      </NeuCard>

      {filteredEmployees.length === 0 ? (
        <NeuCard>
          <EmptyState 
            icon={UserCheck} 
            title="No staff profiles found" 
            description="No profiles match your search in the system database."
          />
        </NeuCard>
      ) : (
        <NeuTable data={filteredEmployees} columns={columns} />
      )}

      {/* Add Staff Modal */}
      <NeuModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Manually Add Staff Record">
        <form onSubmit={handleAddStaff} className="space-y-4">
          <NeuInput 
            label="Full Name" 
            placeholder="e.g. John Doe" 
            value={fullName} 
            onChange={(e) => setFullName(e.target.value)} 
          />
          <NeuSelect 
            label="Role / Designation" 
            options={[
              { label: 'General Cleaner', value: 'cleaner' },
              { label: 'Supervisor', value: 'supervisor' },
              { label: 'Manager', value: 'manager' },
              { label: 'Technician', value: 'worker' },
            ]} 
            value={role}
            onChange={(e) => setRole(e.target.value)}
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <NeuInput 
              label="Phone Number (Optional)" 
              placeholder="+91..." 
              value={phone} 
              onChange={(e) => setPhone(e.target.value)} 
            />
            <NeuInput 
              label="Email Address (Optional)" 
              type="email"
              placeholder="name@example.com" 
              value={email} 
              onChange={(e) => setEmail(e.target.value)} 
            />
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <NeuButton type="button" variant="secondary" onClick={() => setIsModalOpen(false)}>
              Cancel
            </NeuButton>
            <NeuButton type="submit">
              Save Staff Profile
            </NeuButton>
          </div>
        </form>
      </NeuModal>

      {/* Delete Confirmation Modal */}
      <NeuModal isOpen={!!deleteId} onClose={() => setDeleteId(null)} title="Confirm Deletion">
        <div className="space-y-4">
          <p className="text-neu-fg">Are you sure you want to permanently delete this staff member? This action cannot be undone.</p>
          <div className="flex justify-end gap-3 pt-4">
            <NeuButton type="button" variant="secondary" onClick={() => setDeleteId(null)}>
              Cancel
            </NeuButton>
            <NeuButton onClick={() => { if (deleteId) handleDeleteStaff(deleteId); }}>
              Yes, Delete
            </NeuButton>
          </div>
        </div>
      </NeuModal>
    </div>
  );
}
