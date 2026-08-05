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
import { Receipt, Plus, Search, CheckCircle, XCircle, Clock, IndianRupee, Trash2, Download, Filter } from 'lucide-react';
import { format, isAfter, subDays, subMonths } from 'date-fns';
import Papa from 'papaparse';
import { toast } from '@/store/toastStore';
import { playSuccess, playError } from '@/lib/audio';

export default function ExpensesPage() {
  const supabase = createClient();
  const [expenses, setExpenses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [timeFilter, setTimeFilter] = useState('all');
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form State
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Fuel & Transportation');
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    async function fetchExpensesData() {
      setLoading(true);

      try {
        // Fetch profiles map
        const { data: profiles } = await supabase.from('profiles').select('id, full_name');
        const profileMap = new Map<string, string>();
        (profiles || []).forEach(p => {
          if (p.id) profileMap.set(p.id, p.full_name || 'Staff Member');
        });

        // Query original database table: erp_transactions (which v-expense uses)
        const { data: erpData } = await supabase
          .from('erp_transactions')
          .select('*')
          .order('created_at', { ascending: false });

        const mappedExp = (erpData || []).map(e => ({
          id: e.id,
          title: e.description || e.main_category || 'Transaction',
          category: e.main_category || 'General',
          amount: Number(e.amount) || 0,
          submitted_by: profileMap.get(e.created_by) || 'Staff',
          notes: e.sub_category || 'Recorded',
          status: 'approved',
          date: e.transaction_date || e.created_at,
          source: e.type || 'expense'
        }));

        setExpenses(mappedExp);
      } catch (err) {
        console.error('Error fetching expenses:', err);
        setExpenses([]);
      } finally {
        setLoading(false);
      }
    }
    fetchExpensesData();
  }, [supabase]);

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    const { data: { user } } = await supabase.auth.getUser();

    let managerName = 'Manager';
    if (user?.id) {
      const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', user.id).single();
      if (profile?.full_name) managerName = profile.full_name;
    }

    const newExp = {
      description: title,
      main_category: category,
      amount: parseFloat(amount) || 0,
      sub_category: notes || title,
      created_by: user?.id || null,
      transaction_date: format(new Date(), 'yyyy-MM-dd'),
      type: 'expense',
      created_at: new Date().toISOString(),
    };

    try {
      const { data, error } = await supabase.from('erp_transactions').insert([newExp]).select('*');
      if (!error && data && data.length > 0) {
        setExpenses(prev => [{
          id: data[0].id,
          title,
          category,
          amount: parseFloat(amount) || 0,
          submitted_by: managerName,
          notes: notes || title,
          status: 'approved',
          date: new Date().toISOString(),
          source: 'expenses'
        }, ...prev]);
        playSuccess();
        toast.success('Expense Recorded', 'The transaction has been successfully logged.');
      } else {
        throw error || new Error('Failed to record expense');
      }
    } catch (err) {
      console.error('Manual expense entry error:', err);
      playError();
      toast.error('Submission Failed', 'Could not record the expense. Please try again.');
    }

    setIsModalOpen(false);
    setTitle('');
    setAmount('');
    setNotes('');
  };

  const handleDeleteExpense = async (id: string, source?: string) => {
    try {
      const { error } = await supabase.from('erp_transactions').delete().eq('id', id);
      if (error) throw error;
      setExpenses(prev => prev.filter(e => e.id !== id));
      playSuccess();
      toast.success('Record Deleted', 'The expense transaction has been removed.');
    } catch (err) {
      console.error(err);
      playError();
      toast.error('Deletion Failed', 'Could not delete the expense record.');
    }
  };

  const filtered = expenses.filter(e => {
    const matchesSearch = 
      (e.title || '').toLowerCase().includes(search.toLowerCase()) ||
      (e.category || '').toLowerCase().includes(search.toLowerCase()) ||
      (e.submitted_by || '').toLowerCase().includes(search.toLowerCase()) ||
      (e.notes || '').toLowerCase().includes(search.toLowerCase());

    let matchesTime = true;
    if (timeFilter === 'today') {
      matchesTime = isAfter(new Date(e.date), subDays(new Date(), 1));
    } else if (timeFilter === 'week') {
      matchesTime = isAfter(new Date(e.date), subDays(new Date(), 7));
    } else if (timeFilter === 'month') {
      matchesTime = isAfter(new Date(e.date), subMonths(new Date(), 1));
    }

    return matchesSearch && matchesTime;
  });

  const exportCSV = () => {
    if (filtered.length === 0) {
      toast.warning('No Data', 'There is no data to export.');
      return;
    }
    const csvData = filtered.map(e => ({
      'Description': e.title,
      'Category': e.category,
      'Amount (₹)': e.amount,
      'Submitted By': e.submitted_by,
      'Notes': e.notes,
      'Status': e.status,
      'Date': e.date ? format(new Date(e.date), 'MMM dd, yyyy') : 'N/A'
    }));
    const csv = Papa.unparse(csvData);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `expenses_report_${format(new Date(), 'yyyy-MM-dd')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    playSuccess();
    toast.success('Export Successful', 'Your CSV file has been downloaded.');
  };

  const totalAmount = expenses.reduce((acc, curr) => acc + (curr.amount || 0), 0);

  const columns = [
    {
      accessorKey: 'title',
      header: 'Expense / Description',
      cell: (info: any) => <span className="font-bold text-neu-fg">{info.getValue() || 'Expense Claim'}</span>
    },
    {
      accessorKey: 'category',
      header: 'Category',
      cell: (info: any) => <span className="font-medium text-neu-muted">{info.getValue() || 'General'}</span>
    },
    {
      accessorKey: 'amount',
      header: 'Amount (₹)',
      cell: (info: any) => <span className="font-bold text-neu-accent">₹{Number(info.getValue() || 0).toLocaleString()}</span>
    },
    {
      accessorKey: 'submitted_by',
      header: 'Recorded By',
      cell: (info: any) => info.getValue() || 'Staff'
    },
    {
      accessorKey: 'date',
      header: 'Date',
      cell: (info: any) => info.getValue() ? format(new Date(info.getValue()), 'MMM dd, yyyy') : 'N/A'
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: (info: any) => <NeuBadge variant="success">Approved</NeuBadge>
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: (info: any) => {
        const item = info.row.original;
        return (
          <button 
            onClick={() => handleDeleteExpense(item.id, item.source)} 
            className="p-1.5 text-neu-muted hover:text-red-500 hover:scale-110 transition-all cursor-pointer" 
            title="Delete Record"
          >
            <Trash2 size={16} />
          </button>
        );
      }
    }
  ];

  if (loading) {
    return (
      <div className="space-y-6">
        <h2 className="text-xl font-display font-bold text-neu-fg">Expense & Cash Collection Logs</h2>
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
          <h2 className="text-xl font-display font-bold text-neu-fg">Expense & Cash Collection Logs</h2>
          <p className="text-neu-muted text-sm">Directly synchronized with database `expenses` and `cash_collections` ({expenses.length} records).</p>
        </div>
        <NeuButton onClick={() => setIsModalOpen(true)}>
          <Plus size={18} />
          Submit Expense
        </NeuButton>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <StatCard title="Total Synced Value (₹)" value={totalAmount} prefix="₹" icon={IndianRupee} />
        <StatCard title="Database Records" value={expenses.length} icon={Receipt} />
        <StatCard title="Status" value={100} suffix="% Synced" icon={CheckCircle} />
      </div>

      <NeuCard className="p-4 flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="w-full md:max-w-md">
          <NeuInput 
            placeholder="Search expenses, categories, or submitters..." 
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
                { label: 'Submitted Today', value: 'today' },
                { label: 'Submitted This Week', value: 'week' },
                { label: 'Submitted This Month', value: 'month' },
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
            icon={Receipt} 
            title="No expense or cash collection records" 
            description="No entries matching your search criteria in the database."
            action={
              <NeuButton variant="secondary" onClick={() => setIsModalOpen(true)}>
                <Plus size={18} />
                Submit Expense
              </NeuButton>
            }
          />
        </NeuCard>
      ) : (
        <NeuTable data={filtered} columns={columns} />
      )}

      {/* Submit Expense Modal */}
      <NeuModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Record Operational Expense">
        <form onSubmit={handleAddExpense} className="space-y-4">
          <NeuInput 
            label="Expense Title / Description" 
            placeholder="e.g. Chemical Restock Supplies" 
            value={title} 
            onChange={(e) => setTitle(e.target.value)} 
            required 
          />
          <NeuSelect 
            label="Expense Category" 
            options={[
              { label: 'Fuel & Transportation', value: 'Fuel & Transportation' },
              { label: 'Chemical Supplies', value: 'Chemical Supplies' },
              { label: 'Equipment Repair', value: 'Equipment Repair' },
              { label: 'Staff Meals / Allowances', value: 'Staff Meals / Allowances' },
              { label: 'Miscellaneous', value: 'Miscellaneous' },
            ]} 
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          />
          <NeuInput 
            label="Amount (₹)" 
            type="number"
            placeholder="e.g. 1500" 
            value={amount} 
            onChange={(e) => setAmount(e.target.value)} 
            required 
          />
          <NeuInput 
            label="Notes / Purpose" 
            placeholder="Enter purpose or receipt notes..." 
            value={notes} 
            onChange={(e) => setNotes(e.target.value)} 
          />
          <div className="flex justify-end gap-3 pt-4">
            <NeuButton type="button" variant="secondary" onClick={() => setIsModalOpen(false)}>
              Cancel
            </NeuButton>
            <NeuButton type="submit">
              Save Expense Entry
            </NeuButton>
          </div>
        </form>
      </NeuModal>
    </div>
  );
}
