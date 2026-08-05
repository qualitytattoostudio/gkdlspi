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
import { TrendingUp, Plus, Search, Download, Users, Phone, Mail, Award, Trash2, CheckCircle2 } from 'lucide-react';
import { format, isAfter, subDays, subMonths } from 'date-fns';
import Papa from 'papaparse';
import { toast } from '@/store/toastStore';
import { playSuccess, playError } from '@/lib/audio';

export default function SalesPage() {
  const supabase = createClient();
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [timeFilter, setTimeFilter] = useState('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [status, setStatus] = useState('new');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    async function fetchSales() {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('leads')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) throw error;
        setLeads(data || []);
      } catch (err) {
        console.error('Error fetching leads:', err);
        setLeads([]);
      } finally {
        setLoading(false);
      }
    }
    fetchSales();
  }, [supabase]);

  const handleAddLead = async (e: React.FormEvent) => {
    e.preventDefault();
    const newLead = {
      name: name || 'New Lead',
      company: company || null,
      email: email || null,
      phone: phone || null,
      status: status || 'new',
      notes: notes || null,
      created_at: new Date().toISOString(),
    };

    try {
      const { data, error } = await supabase
        .from('leads')
        .insert([newLead])
        .select('*');

      if (!error && data) {
        setLeads(prev => [data[0], ...prev]);
        playSuccess();
        toast.success('Lead Registered', 'New sales pipeline lead created successfully.');
      } else {
        throw error;
      }
    } catch (err) {
      console.error('Error adding lead:', err);
      playError();
      toast.error('Submission Failed', 'Could not register sales lead.');
    }

    setIsModalOpen(false);
    setName('');
    setCompany('');
    setEmail('');
    setPhone('');
    setStatus('new');
    setNotes('');
  };

  const handleDeleteLead = async (id: string) => {
    try {
      const { error } = await supabase
        .from('leads')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setLeads(prev => prev.filter(l => l.id !== id));
      playSuccess();
      toast.success('Lead Removed', 'Sales lead deleted successfully.');
    } catch (err) {
      console.error('Error deleting lead:', err);
      playError();
      toast.error('Deletion Failed', 'Could not remove lead.');
    }
    setDeleteId(null);
  };

  const filteredLeads = leads.filter(lead => {
    const matchesSearch =
      (lead.name || '').toLowerCase().includes(search.toLowerCase()) ||
      (lead.company || '').toLowerCase().includes(search.toLowerCase()) ||
      (lead.phone || '').includes(search) ||
      (lead.email || '').toLowerCase().includes(search.toLowerCase());

    const matchesStatus = statusFilter === 'all' || lead.status?.toLowerCase() === statusFilter.toLowerCase();

    let matchesTime = true;
    if (lead.created_at) {
      const date = new Date(lead.created_at);
      if (timeFilter === 'today') matchesTime = isAfter(date, subDays(new Date(), 1));
      else if (timeFilter === 'week') matchesTime = isAfter(date, subDays(new Date(), 7));
      else if (timeFilter === 'month') matchesTime = isAfter(date, subMonths(new Date(), 1));
    }

    return matchesSearch && matchesStatus && matchesTime;
  });

  const exportCSV = () => {
    if (filteredLeads.length === 0) {
      toast.warning('No Data', 'There is no data to export.');
      return;
    }
    const csvData = filteredLeads.map(l => ({
      'Contact Name': l.name || 'N/A',
      'Company': l.company || 'N/A',
      'Phone': l.phone || 'N/A',
      'Email': l.email || 'N/A',
      'Pipeline Stage': l.status || 'New',
      'Created Date': l.created_at ? format(new Date(l.created_at), 'MMM dd, yyyy') : 'N/A',
    }));
    const csv = Papa.unparse(csvData);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `sales_pipeline_report_${format(new Date(), 'yyyy-MM-dd')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    playSuccess();
    toast.success('Export Successful', 'Sales pipeline CSV downloaded.');
  };

  const columns = [
    {
      accessorKey: 'name',
      header: 'Contact Name',
      cell: (info: any) => <span className="font-bold text-neu-fg">{info.getValue() || 'Lead'}</span>
    },
    {
      accessorKey: 'company',
      header: 'Company / Client',
      cell: (info: any) => <span className="text-neu-muted font-medium">{info.getValue() || 'Direct Client'}</span>
    },
    {
      accessorKey: 'phone',
      header: 'Phone Number',
      cell: (info: any) => info.getValue() || 'N/A'
    },
    {
      accessorKey: 'email',
      header: 'Email Address',
      cell: (info: any) => info.getValue() || 'N/A'
    },
    {
      accessorKey: 'status',
      header: 'Stage',
      cell: (info: any) => {
        const val = (info.getValue() || 'new').toLowerCase();
        let color = 'bg-blue-100 text-blue-700';
        if (val === 'won' || val === 'qualified') color = 'bg-emerald-100 text-emerald-700';
        if (val === 'lost') color = 'bg-red-100 text-red-700';
        if (val === 'proposal') color = 'bg-purple-100 text-purple-700';

        return (
          <span className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${color}`}>
            {val}
          </span>
        );
      }
    },
    {
      accessorKey: 'created_at',
      header: 'Captured On',
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
          title="Delete Lead"
        >
          <Trash2 size={18} />
        </button>
      )
    },
  ];

  if (loading) {
    return (
      <div className="space-y-6">
        <h2 className="text-xl font-display font-bold text-neu-fg">Sales Pipeline & Quotes</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => <SkeletonCard key={i} className="h-32" />)}
        </div>
        <SkeletonCard className="h-[400px]" />
      </div>
    );
  }

  const qualifiedLeads = leads.filter(l => l.status === 'qualified' || l.status === 'won').length;
  const newLeads = leads.filter(l => l.status === 'new').length;

  return (
    <div className="space-y-6 animate-fade-up">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-xl font-display font-bold text-neu-fg">Sales Pipeline & Quotes</h2>
          <p className="text-neu-muted text-sm">Oversee corporate proposals, CRM leads, and quote conversions ({leads.length} leads).</p>
        </div>
        <NeuButton onClick={() => setIsModalOpen(true)}>
          <Plus size={18} />
          New Sales Lead
        </NeuButton>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <StatCard title="Total Pipeline Leads" value={leads.length} icon={Users} />
        <StatCard title="Qualified / Won Contracts" value={qualifiedLeads} icon={CheckCircle2} />
        <StatCard title="New Fresh Opportunities" value={newLeads} icon={TrendingUp} />
      </div>

      <NeuCard className="p-4 flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="w-full md:max-w-md">
          <NeuInput 
            placeholder="Search lead name, company, email, phone..." 
            icon={<Search size={18} />}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="w-full md:w-40">
            <NeuSelect 
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              options={[
                { label: 'All Stages', value: 'all' },
                { label: 'New', value: 'new' },
                { label: 'Qualified', value: 'qualified' },
                { label: 'Proposal', value: 'proposal' },
                { label: 'Won', value: 'won' },
                { label: 'Lost', value: 'lost' },
              ]}
            />
          </div>
          <div className="w-full md:w-40">
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
          <NeuButton variant="secondary" onClick={exportCSV} className="shrink-0">
            <Download size={18} />
            <span className="hidden sm:inline">Export</span>
          </NeuButton>
        </div>
      </NeuCard>

      {filteredLeads.length === 0 ? (
        <NeuCard>
          <EmptyState 
            icon={TrendingUp} 
            title="No sales leads found" 
            description="No opportunities found matching your criteria."
          />
        </NeuCard>
      ) : (
        <NeuTable data={filteredLeads} columns={columns} />
      )}

      {/* Add Modal */}
      <NeuModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Register Sales Lead">
        <form onSubmit={handleAddLead} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <NeuInput 
              label="Contact Full Name" 
              placeholder="e.g. Robert Vance" 
              value={name} 
              onChange={(e) => setName(e.target.value)} 
              required
            />
            <NeuInput 
              label="Company Name" 
              placeholder="e.g. Acme Corp" 
              value={company} 
              onChange={(e) => setCompany(e.target.value)} 
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <NeuInput 
              label="Phone Number" 
              placeholder="+91..." 
              value={phone} 
              onChange={(e) => setPhone(e.target.value)} 
            />
            <NeuInput 
              label="Email Address" 
              type="email"
              placeholder="client@acme.com" 
              value={email} 
              onChange={(e) => setEmail(e.target.value)} 
            />
          </div>
          <NeuSelect 
            label="Initial Deal Stage" 
            options={[
              { label: 'New Lead', value: 'new' },
              { label: 'Qualified Interest', value: 'qualified' },
              { label: 'Proposal Sent', value: 'proposal' },
              { label: 'Deal Won', value: 'won' },
            ]} 
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          />
          <NeuInput 
            label="Deal Scope & Notes" 
            placeholder="e.g. 50,000 sq ft office facility maintenance contract" 
            value={notes} 
            onChange={(e) => setNotes(e.target.value)} 
          />
          <div className="flex justify-end gap-3 pt-4">
            <NeuButton type="button" variant="secondary" onClick={() => setIsModalOpen(false)}>
              Cancel
            </NeuButton>
            <NeuButton type="submit">
              Save Sales Lead
            </NeuButton>
          </div>
        </form>
      </NeuModal>

      {/* Delete Confirmation Modal */}
      <NeuModal isOpen={!!deleteId} onClose={() => setDeleteId(null)} title="Confirm Deletion">
        <div className="space-y-4">
          <p className="text-neu-fg">Are you sure you want to delete this sales lead from your pipeline?</p>
          <div className="flex justify-end gap-3 pt-4">
            <NeuButton type="button" variant="secondary" onClick={() => setDeleteId(null)}>
              Cancel
            </NeuButton>
            <NeuButton onClick={() => { if (deleteId) handleDeleteLead(deleteId); }}>
              Yes, Delete
            </NeuButton>
          </div>
        </div>
      </NeuModal>
    </div>
  );
}
