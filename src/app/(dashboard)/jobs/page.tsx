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
import { Plus, Search, ClipboardList, Download, Filter } from 'lucide-react';
import { format, isToday, isThisWeek, isThisMonth, parseISO } from 'date-fns';

export default function JobsPage() {
  const supabase = createClient();
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [timeFilter, setTimeFilter] = useState('all'); // all, today, week, month
  const [isModalOpen, setIsModalOpen] = useState(false);

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

      if (!error && data) {
        setJobs([data[0], ...jobs]);
      }
    } catch (err) {
      console.error('Work order insert error:', err);
    }

    setIsModalOpen(false);
    setTitle('');
    setDescription('');
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

    if (timeFilter === 'all') return true;
    
    if (!job.created_at && !job.scheduled_date) return false;
    const dateToCheck = parseISO(job.scheduled_date || job.created_at);

    if (timeFilter === 'today') return isToday(dateToCheck);
    if (timeFilter === 'week') return isThisWeek(dateToCheck);
    if (timeFilter === 'month') return isThisMonth(dateToCheck);

    return true;
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
              options={[
                { label: 'All Time', value: 'all' },
                { label: 'Today', value: 'today' },
                { label: 'This Week', value: 'week' },
                { label: 'This Month', value: 'month' },
              ]}
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
    </div>
  );
}
