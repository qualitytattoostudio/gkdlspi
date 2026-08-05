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
import { AlertTriangle, Plus, Search, CheckCircle, Clock, Download, Filter, Trash2 } from 'lucide-react';
import { format, isAfter, subDays, subMonths } from 'date-fns';
import Papa from 'papaparse';
import { toast } from '@/store/toastStore';
import { playSuccess, playError } from '@/lib/audio';

export default function ComplaintsPage() {
  const supabase = createClient();
  const [complaints, setComplaints] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [timeFilter, setTimeFilter] = useState('all');
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form State
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState('medium');
  const [description, setDescription] = useState('');

  useEffect(() => {
    async function fetchComplaints() {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('complaints')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) throw error;
        setComplaints(data || []);
      } catch (err) {
        console.error('Error fetching complaints:', err);
        setComplaints([]);
      } finally {
        setLoading(false);
      }
    }
    fetchComplaints();
  }, [supabase]);

  const handleCreateComplaint = async (e: React.FormEvent) => {
    e.preventDefault();
    const newComplaint = {
      title: title || 'Draft Complaint',
      description: description || null,
      priority,
      status: 'open',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    try {
      const { data, error } = await supabase
        .from('complaints')
        .insert([newComplaint])
        .select('*');

      if (!error && data) {
        setComplaints([data[0], ...complaints]);
        playSuccess();
        toast.success('Complaint Logged', 'The new customer complaint has been registered.');
      } else {
        throw error;
      }
    } catch (err) {
      console.error('Error creating complaint:', err);
      playError();
      toast.error('Logging Failed', 'Could not register the complaint.');
    }

    setIsModalOpen(false);
    setTitle('');
    setDescription('');
  };

  const handleDeleteComplaint = async (id: string) => {
    try {
      const { error } = await supabase.from('complaints').delete().eq('id', id);
      if (error) throw error;
      setComplaints(complaints.filter(c => c.id !== id));
      playSuccess();
      toast.success('Complaint Deleted', 'The record has been permanently removed.');
    } catch (err) {
      playError();
      toast.error('Deletion Failed', 'Could not remove the complaint record.');
    }
  };

  const handleStatusChange = async (id: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('complaints')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (!error) {
        setComplaints(prev => prev.map(c => c.id === id ? { ...c, status: newStatus } : c));
        playSuccess();
        toast.success('Status Updated', `Complaint is now ${newStatus}.`);
      } else {
        throw error;
      }
    } catch (err) {
      console.error('Error updating complaint status:', err);
      playError();
      toast.error('Update Failed', 'Could not change the complaint status.');
    }
  };

  const getPriorityBadge = (p: string) => {
    let variant: BadgeVariant = 'neutral';
    if (p === 'high' || p === 'urgent') variant = 'error';
    if (p === 'medium') variant = 'warning';
    if (p === 'low') variant = 'info';
    return <NeuBadge variant={variant}>{p || 'medium'}</NeuBadge>;
  };

  const getStatusBadge = (s: string) => {
    let variant: BadgeVariant = 'neutral';
    if (s === 'resolved' || s === 'closed') variant = 'success';
    if (s === 'investigating' || s === 'in-progress') variant = 'info';
    if (s === 'open') variant = 'error';
    return <NeuBadge variant={variant}>{s || 'open'}</NeuBadge>;
  };

  const filtered = complaints.filter(c => {
    const matchesSearch = 
      (c.title || '').toLowerCase().includes(search.toLowerCase()) ||
      (c.description || '').toLowerCase().includes(search.toLowerCase());

    let matchesTime = true;
    if (timeFilter === 'today') {
      matchesTime = isAfter(new Date(c.created_at), subDays(new Date(), 1));
    } else if (timeFilter === 'week') {
      matchesTime = isAfter(new Date(c.created_at), subDays(new Date(), 7));
    } else if (timeFilter === 'month') {
      matchesTime = isAfter(new Date(c.created_at), subMonths(new Date(), 1));
    }

    return matchesSearch && matchesTime;
  });

  const exportCSV = () => {
    if (filtered.length === 0) {
      toast.warning('No Data', 'There is no data to export.');
      return;
    }
    const csvData = filtered.map(c => ({
      'Title': c.title,
      'Description': c.description,
      'Priority': c.priority,
      'Status': c.status,
      'Date Logged': format(new Date(c.created_at), 'MMM dd, yyyy HH:mm')
    }));
    const csv = Papa.unparse(csvData);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `complaints_report_${format(new Date(), 'yyyy-MM-dd')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    playSuccess();
    toast.success('Export Successful', 'Your CSV file has been downloaded.');
  };

  const columns = [
    {
      accessorKey: 'title',
      header: 'Complaint Title',
      cell: (info: any) => <span className="font-bold text-neu-fg">{info.getValue() || 'Service Issue'}</span>
    },
    {
      accessorKey: 'description',
      header: 'Description',
      cell: (info: any) => <span className="text-xs text-neu-muted line-clamp-1">{info.getValue() || '—'}</span>
    },
    {
      accessorKey: 'priority',
      header: 'Priority',
      cell: (info: any) => getPriorityBadge(info.getValue())
    },
    {
      accessorKey: 'created_at',
      header: 'Logged Date',
      cell: (info: any) => info.getValue() ? format(new Date(info.getValue()), 'MMM dd, yyyy') : 'N/A'
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: (info: any) => (
        <div className="flex items-center gap-2">
          <select
            value={info.getValue() || 'open'}
            onChange={(e) => handleStatusChange(info.row.original.id, e.target.value)}
            className="bg-neu-bg shadow-neu-inset-sm text-xs font-bold text-neu-fg rounded-lg px-2 py-1 outline-none cursor-pointer"
          >
            <option value="open">Open</option>
            <option value="investigating">Investigating</option>
            <option value="resolved">Resolved</option>
            <option value="closed">Closed</option>
          </select>
          <button 
            onClick={() => handleDeleteComplaint(info.row.original.id)} 
            className="p-1.5 text-neu-muted hover:text-red-500 hover:scale-110 transition-all cursor-pointer ml-2" 
            title="Delete Complaint"
          >
            <Trash2 size={16} />
          </button>
        </div>
      )
    },
  ];

  if (loading) {
    return (
      <div className="space-y-6">
        <h2 className="text-xl font-display font-bold text-neu-fg">Customer Complaints</h2>
        <SkeletonCard className="h-[400px]" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-up">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-xl font-display font-bold text-neu-fg">Customer Complaints</h2>
          <p className="text-neu-muted text-sm">Directly synchronized with database `complaints` table ({complaints.length} records).</p>
        </div>
        <NeuButton onClick={() => setIsModalOpen(true)}>
          <Plus size={18} />
          Log Complaint
        </NeuButton>
      </div>

      <NeuCard className="p-4 flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="w-full md:max-w-md">
          <NeuInput 
            placeholder="Search complaints..." 
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
                { label: 'Logged Today', value: 'today' },
                { label: 'Logged This Week', value: 'week' },
                { label: 'Logged This Month', value: 'month' },
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
            icon={AlertTriangle} 
            title="No complaints logged" 
            description="No complaint records found in the database matching your search."
            action={
              <NeuButton variant="secondary" onClick={() => setIsModalOpen(true)}>
                <Plus size={18} />
                Log Complaint
              </NeuButton>
            }
          />
        </NeuCard>
      ) : (
        <NeuTable data={filtered} columns={columns} />
      )}

      {/* Log Complaint Modal */}
      <NeuModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Log Customer Complaint">
        <form onSubmit={handleCreateComplaint} className="space-y-4">
          <NeuInput 
            label="Complaint Title" 
            placeholder="e.g. Incomplete Sanitization at Floor 3" 
            value={title} 
            onChange={(e) => setTitle(e.target.value)} 
          />
          <NeuSelect 
            label="Priority Level" 
            options={[
              { label: 'High Priority', value: 'high' },
              { label: 'Medium Priority', value: 'medium' },
              { label: 'Low Priority', value: 'low' },
            ]} 
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
          />
          <NeuInput 
            label="Complaint Description" 
            placeholder="Provide details about the issue..." 
            value={description} 
            onChange={(e) => setDescription(e.target.value)} 
          />
          <div className="flex justify-end gap-3 pt-4">
            <NeuButton type="button" variant="secondary" onClick={() => setIsModalOpen(false)}>
              Cancel
            </NeuButton>
            <NeuButton type="submit">
              Log Complaint Ticket
            </NeuButton>
          </div>
        </form>
      </NeuModal>
    </div>
  );
}
