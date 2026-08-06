'use client';

import React, { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { NeuTable } from '@/components/neu/NeuTable';
import { NeuCard } from '@/components/neu/NeuCard';
import { NeuButton } from '@/components/neu/NeuButton';
import { NeuBadge, BadgeVariant } from '@/components/neu/NeuBadge';
import { NeuInput } from '@/components/neu/NeuInput';
import { NeuSelect } from '@/components/neu/NeuSelect';
import { NeuModal } from '@/components/neu/NeuModal';
import { EmptyState } from '@/components/neu/EmptyState';
import { SkeletonCard } from '@/components/neu/SkeletonCard';
import { Plus, Search, ClipboardList, Download, Filter, Trash2, Edit } from 'lucide-react';
import { format } from 'date-fns';
import { MONTH_FILTER_OPTIONS, matchesTimeFilter } from '@/lib/utils';
import { toast } from '@/store/toastStore';
import { playSuccess, playError } from '@/lib/audio';

export default function JobsPage() {
  const supabase = createClient();
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [timeFilter, setTimeFilter] = useState('all'); // all, today, week, month
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editJob, setEditJob] = useState<any | null>(null);

  // Edit form state
  const [editTitle, setEditTitle] = useState('');
  const [editWoType, setEditWoType] = useState('Deep Cleaning');
  const [editScheduledDate, setEditScheduledDate] = useState('');
  const [editPriority, setEditPriority] = useState('medium');
  const [editStatus, setEditStatus] = useState('pending');
  const [editDescription, setEditDescription] = useState('');

  // Form state
  const [title, setTitle] = useState('');
  const [woType, setWoType] = useState('Deep Cleaning');
  const [scheduledDate, setScheduledDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [priority, setPriority] = useState('medium');
  const [description, setDescription] = useState('');

  useEffect(() => {
    async function fetchJobs() {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('work_orders')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) throw error;
        setJobs(data || []);
      } catch (err) {
        console.error('Error fetching jobs:', err);
        setJobs([]);
      } finally {
        setLoading(false);
      }
    }
    fetchJobs();
  }, [supabase]);

  const handleCreateJob = async (e: React.FormEvent) => {
    e.preventDefault();
    const newJob = {
      wo_number: `WO-${Math.floor(1000 + Math.random() * 9000)}`,
      title: title || 'Draft Work Order',
      wo_type: woType,
      scheduled_date: scheduledDate || null,
      priority,
      status: 'pending',
      description,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    try {
      const { data, error } = await supabase
        .from('work_orders')
        .insert([newJob])
        .select('*');

      if (!error && data && data.length > 0) {
        setJobs(prev => [data[0], ...prev]);
        playSuccess();
        toast.success('Work Order Created', 'New job has been recorded in the database.');
      } else if (error) {
        throw error;
      }
    } catch (err) {
      console.error('Work order insert error:', err);
      playError();
      toast.error('Creation Failed', 'Could not record work order in backend.');
    }

    setIsModalOpen(false);
    setTitle('');
    setDescription('');
  };

  const openEditModal = (job: any) => {
    setEditJob(job);
    setEditTitle(job.title || '');
    setEditWoType(job.wo_type || 'Deep Cleaning');
    setEditScheduledDate(job.scheduled_date ? format(new Date(job.scheduled_date), 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'));
    setEditPriority(job.priority || 'medium');
    setEditStatus(job.status || 'pending');
    setEditDescription(job.description || '');
  };

  const handleUpdateJob = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editJob) return;

    const updatedFields = {
      title: editTitle,
      wo_type: editWoType,
      scheduled_date: editScheduledDate || null,
      priority: editPriority,
      status: editStatus,
      description: editDescription,
      updated_at: new Date().toISOString(),
    };

    try {
      const { data, error } = await supabase
        .from('work_orders')
        .update(updatedFields)
        .eq('id', editJob.id)
        .select('*');

      if (!error && data && data.length > 0) {
        setJobs(prev => prev.map(j => j.id === editJob.id ? data[0] : j));
        playSuccess();
        toast.success('Work Order Updated', 'Job details updated in database.');
      } else if (error) throw error;
    } catch (err) {
      console.error('Update job error:', err);
      playError();
      toast.error('Update Failed', 'Could not update work order.');
    }
    setEditJob(null);
  };

  const handleDeleteJob = async (id: string) => {
    try {
      const { error } = await supabase.from('work_orders').delete().eq('id', id);
      if (error) throw error;
      setJobs(prev => prev.filter(j => j.id !== id));
      playSuccess();
      toast.success('Work Order Removed', 'The job record has been deleted from the database.');
    } catch (err) {
      console.error('Delete job error:', err);
      playError();
      toast.error('Deletion Failed', 'Could not delete the work order.');
    }
    setDeleteId(null);
  };

  const getStatusBadge = (status: string) => {
    let variant: BadgeVariant = 'neutral';
    if (status === 'completed') variant = 'success';
    if (status === 'in-progress' || status === 'started') variant = 'info';
    if (status === 'cancelled') variant = 'error';
    if (status === 'pending' || status === 'scheduled') variant = 'warning';
    return <NeuBadge variant={variant}>{status || 'pending'}</NeuBadge>;
  };

  const getPriorityBadge = (p: string) => {
    let variant: BadgeVariant = 'neutral';
    if (p === 'high' || p === 'emergency') variant = 'error';
    if (p === 'medium') variant = 'warning';
    if (p === 'low') variant = 'info';
    return <NeuBadge variant={variant}>{p || 'medium'}</NeuBadge>;
  };

  const filteredJobs = jobs.filter(job => {
    const matchesSearch = 
      (job.title || '').toLowerCase().includes(search.toLowerCase()) ||
      (job.wo_number || '').toLowerCase().includes(search.toLowerCase()) ||
      (job.wo_type || '').toLowerCase().includes(search.toLowerCase());

    if (!matchesSearch) return false;
    return matchesTimeFilter(job.scheduled_date || job.created_at, timeFilter);
  });

  const exportCSV = () => {
    const csvContent = [
      ['WO Number', 'Title', 'Service Type', 'Scheduled Date', 'Priority', 'Status', 'Description'],
      ...filteredJobs.map(j => [
        j.wo_number || 'N/A',
        `"${(j.title || '').replace(/"/g, '""')}"`,
        j.wo_type || 'N/A',
        j.scheduled_date ? format(new Date(j.scheduled_date), 'MMM dd, yyyy') : 'N/A',
        j.priority || 'medium',
        j.status || 'pending',
        `"${(j.description || '').replace(/"/g, '""')}"`
      ])
    ].map(e => e.join(",")).join("\n");
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Jobs_Export_${timeFilter}_${new Date().toISOString().split('T')[0]}.csv`);
    link.click();
  };

  const columns = [
    {
      accessorKey: 'wo_number',
      header: 'WO Number',
      cell: (info: any) => <span className="font-mono text-xs text-neu-accent font-bold">{info.getValue() || 'WO-1001'}</span>
    },
    {
      accessorKey: 'title',
      header: 'Work Order Title',
      cell: (info: any) => <span className="font-bold text-neu-fg">{info.getValue() || 'Work Order'}</span>
    },
    {
      accessorKey: 'wo_type',
      header: 'Service Type',
      cell: (info: any) => <span className="font-medium text-neu-muted">{info.getValue() || 'Cleaning'}</span>
    },
    {
      accessorKey: 'scheduled_date',
      header: 'Scheduled Date',
      cell: (info: any) => info.getValue() ? format(new Date(info.getValue()), 'MMM dd, yyyy') : 'N/A'
    },
    {
      accessorKey: 'priority',
      header: 'Priority',
      cell: (info: any) => getPriorityBadge(info.getValue())
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: (info: any) => getStatusBadge(info.getValue())
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: (info: any) => (
        <div className="flex items-center gap-1">
          <button 
            onClick={(e) => {
              e.stopPropagation();
              openEditModal(info.row.original);
            }}
            className="p-2 text-neu-accent hover:bg-neu-accent/10 rounded-lg transition-colors"
            title="Edit Work Order"
          >
            <Edit size={18} />
          </button>
          <button 
            onClick={(e) => {
              e.stopPropagation();
              setDeleteId(info.row.original.id);
            }}
            className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
            title="Delete Work Order"
          >
            <Trash2 size={18} />
          </button>
        </div>
      )
    },
  ];

  if (loading) {
    return (
      <div className="space-y-6">
        <h2 className="text-xl font-display font-bold text-neu-fg">Job Management</h2>
        <SkeletonCard className="h-[400px]" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-up">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-xl font-display font-bold text-neu-fg">Job Management</h2>
          <p className="text-neu-muted text-sm">Directly synchronized with database `work_orders` table ({filteredJobs.length} jobs shown).</p>
        </div>
        <div className="flex gap-3">
          <NeuButton onClick={exportCSV} variant="secondary">
            <Download size={16} />
            Export CSV
          </NeuButton>
          <NeuButton onClick={() => setIsModalOpen(true)}>
            <Plus size={18} />
            Create Job
          </NeuButton>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <NeuCard className="p-4 flex gap-4 items-center">
          <div className="w-full">
            <NeuInput 
              placeholder="Search work orders, titles, or service types..." 
              icon={<Search size={18} />}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </NeuCard>
        <NeuCard className="p-4 flex gap-4 items-center">
          <div className="w-full">
            <NeuSelect 
              value={timeFilter}
              onChange={(e) => setTimeFilter(e.target.value)}
              options={MONTH_FILTER_OPTIONS}
            />
          </div>
        </NeuCard>
      </div>

      {filteredJobs.length === 0 ? (
        <NeuCard>
          <EmptyState 
            icon={ClipboardList} 
            title="No work orders found" 
            description="No work orders in the database matching your search. Create a new work order to get started."
            action={
              <NeuButton variant="secondary" onClick={() => setIsModalOpen(true)}>
                <Plus size={18} />
                Create Work Order
              </NeuButton>
            }
          />
        </NeuCard>
      ) : (
        <NeuTable data={filteredJobs} columns={columns} />
      )}

      {/* Create Job Modal */}
      <NeuModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Create New Work Order">
        <form onSubmit={handleCreateJob} className="space-y-4">
          <NeuInput 
            label="Work Order Title" 
            placeholder="e.g. Corporate Floor Deep Clean & Sanitization" 
            value={title} 
            onChange={(e) => setTitle(e.target.value)} 
          />
          <NeuSelect 
            label="Service Scope" 
            options={[
              { label: 'Deep Cleaning & Sanitization', value: 'Deep Cleaning' },
              { label: 'Carpet Shampooing & Extraction', value: 'Carpet Shampooing' },
              { label: 'High Rise Window Wash', value: 'Window Wash' },
              { label: 'Marble Floor Polishing', value: 'Floor Polishing' },
              { label: 'Post-Construction Cleanup', value: 'Post-Construction' },
            ]} 
            value={woType}
            onChange={(e) => setWoType(e.target.value)}
          />
          <div className="grid grid-cols-2 gap-4">
            <NeuInput 
              label="Scheduled Date" 
              type="date"
              value={scheduledDate} 
              onChange={(e) => setScheduledDate(e.target.value)} 
            />
            <NeuSelect 
              label="Priority Level" 
              options={[
                { label: 'Emergency / Urgent', value: 'emergency' },
                { label: 'High Priority', value: 'high' },
                { label: 'Medium Priority', value: 'medium' },
                { label: 'Low Priority', value: 'low' },
              ]} 
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
            />
          </div>
          <NeuInput 
            label="Job Description / Instructions" 
            placeholder="Special instructions for team supervisor..." 
            value={description} 
            onChange={(e) => setDescription(e.target.value)} 
          />
          <div className="flex justify-end gap-3 pt-4">
            <NeuButton type="button" variant="secondary" onClick={() => setIsModalOpen(false)}>
              Cancel
            </NeuButton>
            <NeuButton type="submit">
              Create Work Order
            </NeuButton>
          </div>
        </form>
      </NeuModal>

      {/* Delete Confirmation Modal */}
      <NeuModal isOpen={!!deleteId} onClose={() => setDeleteId(null)} title="Confirm Deletion">
        <div className="space-y-4">
          <p className="text-neu-fg">Are you sure you want to delete this work order from the backend database?</p>
          <div className="flex justify-end gap-3 pt-4">
            <NeuButton type="button" variant="secondary" onClick={() => setDeleteId(null)}>
              Cancel
            </NeuButton>
            <NeuButton onClick={() => { if (deleteId) handleDeleteJob(deleteId); }}>
              Yes, Delete
            </NeuButton>
          </div>
        </div>
      </NeuModal>

      {/* Edit Job Modal */}
      <NeuModal isOpen={!!editJob} onClose={() => setEditJob(null)} title="Edit Work Order Details">
        <form onSubmit={handleUpdateJob} className="space-y-4">
          <NeuInput 
            label="Work Order Title" 
            value={editTitle} 
            onChange={(e) => setEditTitle(e.target.value)} 
            required
          />
          <NeuSelect 
            label="Service Scope" 
            options={[
              { label: 'Deep Cleaning & Sanitization', value: 'Deep Cleaning' },
              { label: 'Carpet Shampooing & Extraction', value: 'Carpet Shampooing' },
              { label: 'High Rise Window Wash', value: 'Window Wash' },
              { label: 'Marble Floor Polishing', value: 'Floor Polishing' },
              { label: 'Post-Construction Cleanup', value: 'Post-Construction' },
            ]} 
            value={editWoType}
            onChange={(e) => setEditWoType(e.target.value)}
          />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <NeuInput 
              label="Scheduled Date" 
              type="date"
              value={editScheduledDate} 
              onChange={(e) => setEditScheduledDate(e.target.value)} 
            />
            <NeuSelect 
              label="Priority Level" 
              options={[
                { label: 'Emergency / Urgent', value: 'emergency' },
                { label: 'High Priority', value: 'high' },
                { label: 'Medium Priority', value: 'medium' },
                { label: 'Low Priority', value: 'low' },
              ]} 
              value={editPriority}
              onChange={(e) => setEditPriority(e.target.value)}
            />
            <NeuSelect 
              label="Job Status" 
              options={[
                { label: 'Pending', value: 'pending' },
                { label: 'Scheduled', value: 'scheduled' },
                { label: 'In Progress', value: 'in-progress' },
                { label: 'Completed', value: 'completed' },
                { label: 'Cancelled', value: 'cancelled' },
              ]} 
              value={editStatus}
              onChange={(e) => setEditStatus(e.target.value)}
            />
          </div>
          <NeuInput 
            label="Job Description / Instructions" 
            value={editDescription} 
            onChange={(e) => setEditDescription(e.target.value)} 
          />
          <div className="flex justify-end gap-3 pt-4">
            <NeuButton type="button" variant="secondary" onClick={() => setEditJob(null)}>
              Cancel
            </NeuButton>
            <NeuButton type="submit">
              Update Work Order
            </NeuButton>
          </div>
        </form>
      </NeuModal>
    </div>
  );
}
