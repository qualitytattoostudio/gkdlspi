'use client';

import React, { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { NeuTable } from '@/components/neu/NeuTable';
import { NeuCard } from '@/components/neu/NeuCard';
import { NeuButton } from '@/components/neu/NeuButton';
import { NeuInput } from '@/components/neu/NeuInput';
import { NeuSelect } from '@/components/neu/NeuSelect';
import { NeuBadge, BadgeVariant } from '@/components/neu/NeuBadge';
import { NeuModal } from '@/components/neu/NeuModal';
import { EmptyState } from '@/components/neu/EmptyState';
import { SkeletonCard } from '@/components/neu/SkeletonCard';
import { Plus, Search, Package, ArrowDown, ArrowUp, Download, Filter, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { MONTH_FILTER_OPTIONS, matchesTimeFilter } from '@/lib/utils';
import Papa from 'papaparse';
import { toast } from '@/store/toastStore';
import { playSuccess, playError } from '@/lib/audio';

export default function InventoryPage() {
  const supabase = createClient();
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [timeFilter, setTimeFilter] = useState('all');
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form State
  const [notes, setNotes] = useState('');
  const [transactionType, setTransactionType] = useState('in');
  const [quantity, setQuantity] = useState('');

  useEffect(() => {
    async function fetchInventory() {
      setLoading(true);
      try {
        const { data: profData } = await supabase.from('profiles').select('id, full_name').eq('is_active', true);
        const profileMap = new Map<string, string>();
        (profData || []).forEach(p => { if (p.id) profileMap.set(p.id, p.full_name || 'Staff'); });

        const { data: txData, error } = await supabase
          .from('inventory_transactions')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) throw error;

        const mapped = (txData || []).map(t => ({
          ...t,
          performed_by: profileMap.get(t.recorded_by) || 'Manager'
        }));

        setTransactions(mapped);
      } catch (err) {
        console.error('Error fetching inventory:', err);
        setTransactions([]);
      } finally {
        setLoading(false);
      }
    }
    fetchInventory();
  }, [supabase]);

  const handleRecordTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    const { data: { user } } = await supabase.auth.getUser();

    const newTx = {
      transaction_type: transactionType,
      quantity: Number(quantity) || 1,
      notes: notes || 'Stock Adjustment',
      recorded_by: user?.id,
      created_at: new Date().toISOString(),
    };

    try {
      const { data, error } = await supabase
        .from('inventory_transactions')
        .insert([newTx])
        .select('*');

      if (!error && data) {
        setTransactions([{
          ...data[0],
          performed_by: 'Manager'
        }, ...transactions]);
        playSuccess();
        toast.success('Transaction Logged', 'Inventory movement has been recorded.');
      } else {
        throw error;
      }
    } catch (err) {
      console.error('Inventory transaction insert error:', err);
      playError();
      toast.error('Logging Failed', 'Could not record the inventory transaction.');
    }

    setIsModalOpen(false);
    setNotes('');
    setQuantity('');
  };

  const handleDeleteTransaction = async (id: string) => {
    try {
      const { error } = await supabase.from('inventory_transactions').delete().eq('id', id);
      if (error) throw error;
      setTransactions(transactions.filter(t => t.id !== id));
      playSuccess();
      toast.success('Record Deleted', 'The inventory transaction has been removed.');
    } catch (err) {
      console.error(err);
      playError();
      toast.error('Deletion Failed', 'Could not delete the inventory transaction.');
    }
  };

  const getTransactionTypeBadge = (type: string) => {
    let variant: BadgeVariant = 'neutral';
    if (type === 'in') variant = 'success';
    if (type === 'out') variant = 'error';
    if (type === 'adjustment') variant = 'warning';
    
    return (
      <div className="flex items-center gap-1">
        {type === 'in' && <ArrowUp size={14} className="text-emerald-500" />}
        {type === 'out' && <ArrowDown size={14} className="text-red-500" />}
        <NeuBadge variant={variant}>{type}</NeuBadge>
      </div>
    );
  };

  const filteredData = transactions.filter(t => {
    const matchesSearch = 
      (t.notes || '').toLowerCase().includes(search.toLowerCase()) ||
      (t.performed_by || '').toLowerCase().includes(search.toLowerCase());

    return matchesSearch && matchesTimeFilter(t.created_at, timeFilter);
  });

  const exportCSV = () => {
    if (filteredData.length === 0) {
      toast.warning('No Data', 'There is no data to export.');
      return;
    }
    const csvData = filteredData.map(t => ({
      'Item/Notes': t.notes,
      'Type': t.transaction_type,
      'Quantity': t.quantity,
      'Performed By': t.performed_by,
      'Date': t.created_at ? format(new Date(t.created_at), 'MMM dd, yyyy HH:mm') : 'N/A'
    }));
    const csv = Papa.unparse(csvData);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `inventory_report_${format(new Date(), 'yyyy-MM-dd')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    playSuccess();
    toast.success('Export Successful', 'Your CSV file has been downloaded.');
  };

  const columns = [
    {
      accessorKey: 'notes',
      header: 'Item / Transaction Notes',
      cell: (info: any) => <span className="font-bold text-neu-fg">{info.getValue() || 'Stock Movement'}</span>
    },
    {
      accessorKey: 'transaction_type',
      header: 'Type',
      cell: (info: any) => getTransactionTypeBadge(info.getValue())
    },
    {
      accessorKey: 'quantity',
      header: 'Quantity',
      cell: (info: any) => <span className="font-bold text-neu-accent">{info.getValue()}</span>
    },
    {
      accessorKey: 'performed_by',
      header: 'Performed By',
      cell: (info: any) => info.getValue() || 'Manager'
    },
    {
      accessorKey: 'created_at',
      header: 'Date',
      cell: (info: any) => info.getValue() ? format(new Date(info.getValue()), 'MMM dd, yyyy') : 'N/A'
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: (info: any) => (
        <button 
          onClick={() => handleDeleteTransaction(info.row.original.id)} 
          className="p-1.5 text-neu-muted hover:text-red-500 hover:scale-110 transition-all cursor-pointer" 
          title="Delete Record"
        >
          <Trash2 size={16} />
        </button>
      )
    }
  ];

  if (loading) {
    return (
      <div className="space-y-6">
        <h2 className="text-xl font-display font-bold text-neu-fg">Inventory Logs</h2>
        <SkeletonCard className="h-[400px]" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-up">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-xl font-display font-bold text-neu-fg">Inventory Movement Logs</h2>
          <p className="text-neu-muted text-sm">Directly synchronized with database `inventory_transactions` table ({transactions.length} records).</p>
        </div>
        <NeuButton onClick={() => setIsModalOpen(true)}>
          <Plus size={18} />
          Record Transaction
        </NeuButton>
      </div>

      <NeuCard className="p-4 flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="w-full md:max-w-md">
          <NeuInput 
            placeholder="Search notes or personnel..." 
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
              options={MONTH_FILTER_OPTIONS}
            />
          </div>
          <NeuButton variant="secondary" onClick={exportCSV} className="shrink-0">
            <Download size={18} />
            <span className="hidden sm:inline">Export</span>
          </NeuButton>
        </div>
      </NeuCard>

      {filteredData.length === 0 ? (
        <NeuCard>
          <EmptyState 
            icon={Package} 
            title="No inventory transactions found" 
            description="No inventory log records found in the database matching your search."
            action={
              <NeuButton variant="secondary" onClick={() => setIsModalOpen(true)}>
                <Plus size={18} />
                Record Transaction
              </NeuButton>
            }
          />
        </NeuCard>
      ) : (
        <NeuTable data={filteredData} columns={columns} />
      )}

      {/* Modal */}
      <NeuModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Record Inventory Stock Transaction">
        <form onSubmit={handleRecordTransaction} className="space-y-4">
          <NeuInput 
            label="Item Description / Chemical Notes" 
            placeholder="e.g. Microfiber Detergent Restock 25L" 
            value={notes} 
            onChange={(e) => setNotes(e.target.value)} 
          />
          <NeuSelect 
            label="Movement Direction" 
            options={[
              { label: 'Stock In / Restock (+)', value: 'in' },
              { label: 'Stock Out / Issued (-)', value: 'out' },
              { label: 'Quantity Adjustment', value: 'adjustment' },
            ]} 
            value={transactionType}
            onChange={(e) => setTransactionType(e.target.value)}
          />
          <NeuInput 
            label="Quantity" 
            type="number"
            placeholder="e.g. 25" 
            value={quantity} 
            onChange={(e) => setQuantity(e.target.value)} 
          />
          <div className="flex justify-end gap-3 pt-4">
            <NeuButton type="button" variant="secondary" onClick={() => setIsModalOpen(false)}>
              Cancel
            </NeuButton>
            <NeuButton type="submit">
              Save Inventory Log
            </NeuButton>
          </div>
        </form>
      </NeuModal>
    </div>
  );
}
