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
import { ShoppingBag, Plus, Search, Download, DollarSign, FileText, CheckCircle2, Clock, Trash2 } from 'lucide-react';
import { format, isAfter, subDays, subMonths } from 'date-fns';
import Papa from 'papaparse';
import { toast } from '@/store/toastStore';
import { playSuccess, playError } from '@/lib/audio';

export default function ProcurementPage() {
  const supabase = createClient();
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [timeFilter, setTimeFilter] = useState('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Form State
  const [billNumber, setBillNumber] = useState('');
  const [supplierBillNo, setSupplierBillNo] = useState('');
  const [totalAmount, setTotalAmount] = useState('');
  const [paidAmount, setPaidAmount] = useState('');
  const [status, setStatus] = useState('pending');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    async function fetchProcurement() {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('purchase_invoices')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) throw error;
        setInvoices(data || []);
      } catch (err) {
        console.error('Error fetching purchase invoices:', err);
        setInvoices([]);
      } finally {
        setLoading(false);
      }
    }
    fetchProcurement();
  }, [supabase]);

  const handleAddInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    const newInvoice = {
      bill_number: billNumber || `INV-${Date.now().toString().slice(-6)}`,
      supplier_bill_no: supplierBillNo || null,
      total_amount: parseFloat(totalAmount) || 0,
      paid_amount: parseFloat(paidAmount) || 0,
      status: status || 'pending',
      notes: notes || null,
      invoice_date: new Date().toISOString().split('T')[0],
      created_at: new Date().toISOString(),
    };

    try {
      const { data, error } = await supabase
        .from('purchase_invoices')
        .insert([newInvoice])
        .select('*');

      if (!error && data) {
        setInvoices(prev => [data[0], ...prev]);
        playSuccess();
        toast.success('Invoice Created', 'Purchase invoice recorded successfully.');
      } else {
        throw error;
      }
    } catch (err) {
      console.error('Error adding invoice:', err);
      playError();
      toast.error('Submission Failed', 'Could not create purchase invoice.');
    }

    setIsModalOpen(false);
    setBillNumber('');
    setSupplierBillNo('');
    setTotalAmount('');
    setPaidAmount('');
    setStatus('pending');
    setNotes('');
  };

  const handleDeleteInvoice = async (id: string) => {
    try {
      const { error } = await supabase
        .from('purchase_invoices')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setInvoices(prev => prev.filter(inv => inv.id !== id));
      playSuccess();
      toast.success('Invoice Deleted', 'Purchase record has been removed.');
    } catch (err) {
      console.error('Error deleting invoice:', err);
      playError();
      toast.error('Deletion Failed', 'Could not remove purchase invoice.');
    }
    setDeleteId(null);
  };

  const filteredInvoices = invoices.filter(inv => {
    const matchesSearch =
      (inv.bill_number || '').toLowerCase().includes(search.toLowerCase()) ||
      (inv.supplier_bill_no || '').toLowerCase().includes(search.toLowerCase()) ||
      (inv.notes || '').toLowerCase().includes(search.toLowerCase());

    const matchesStatus = statusFilter === 'all' || inv.status?.toLowerCase() === statusFilter.toLowerCase();

    let matchesTime = true;
    if (inv.created_at) {
      const date = new Date(inv.created_at);
      if (timeFilter === 'today') matchesTime = isAfter(date, subDays(new Date(), 1));
      else if (timeFilter === 'week') matchesTime = isAfter(date, subDays(new Date(), 7));
      else if (timeFilter === 'month') matchesTime = isAfter(date, subMonths(new Date(), 1));
    }

    return matchesSearch && matchesStatus && matchesTime;
  });

  const exportCSV = () => {
    if (filteredInvoices.length === 0) {
      toast.warning('No Data', 'There is no data to export.');
      return;
    }
    const csvData = filteredInvoices.map(inv => ({
      'Bill Number': inv.bill_number || 'N/A',
      'Supplier Bill No': inv.supplier_bill_no || 'N/A',
      'Total Amount': inv.total_amount || 0,
      'Paid Amount': inv.paid_amount || 0,
      'Status': inv.status || 'Pending',
      'Date': inv.created_at ? format(new Date(inv.created_at), 'MMM dd, yyyy') : 'N/A',
    }));
    const csv = Papa.unparse(csvData);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `procurement_report_${format(new Date(), 'yyyy-MM-dd')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    playSuccess();
    toast.success('Export Successful', 'Procurement CSV downloaded.');
  };

  const columns = [
    {
      accessorKey: 'bill_number',
      header: 'Bill / Invoice #',
      cell: (info: any) => <span className="font-bold text-neu-fg">{info.getValue() || 'INV-TEMP'}</span>
    },
    {
      accessorKey: 'supplier_bill_no',
      header: 'Supplier Ref #',
      cell: (info: any) => <span className="text-neu-muted">{info.getValue() || 'N/A'}</span>
    },
    {
      accessorKey: 'total_amount',
      header: 'Total Cost (₹)',
      cell: (info: any) => <span className="font-bold text-neu-accent">₹{(info.getValue() || 0).toLocaleString()}</span>
    },
    {
      accessorKey: 'paid_amount',
      header: 'Paid Amount (₹)',
      cell: (info: any) => <span className="font-semibold text-emerald-600">₹{(info.getValue() || 0).toLocaleString()}</span>
    },
    {
      accessorKey: 'status',
      header: 'Payment Status',
      cell: (info: any) => {
        const val = (info.getValue() || 'pending').toLowerCase();
        const isPaid = val === 'paid';
        return (
          <span className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${isPaid ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
            {val}
          </span>
        );
      }
    },
    {
      accessorKey: 'created_at',
      header: 'Date Created',
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
          title="Delete Invoice"
        >
          <Trash2 size={18} />
        </button>
      )
    },
  ];

  if (loading) {
    return (
      <div className="space-y-6">
        <h2 className="text-xl font-display font-bold text-neu-fg">Procurement & Suppliers</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => <SkeletonCard key={i} className="h-32" />)}
        </div>
        <SkeletonCard className="h-[400px]" />
      </div>
    );
  }

  const totalProcurement = invoices.reduce((acc, curr) => acc + Number(curr.total_amount || 0), 0);
  const totalPaid = invoices.reduce((acc, curr) => acc + Number(curr.paid_amount || 0), 0);
  const pendingInvoices = invoices.filter(inv => inv.status !== 'paid').length;

  return (
    <div className="space-y-6 animate-fade-up">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-xl font-display font-bold text-neu-fg">Procurement & Suppliers</h2>
          <p className="text-neu-muted text-sm">Track purchase orders, vendor invoices, and material costs ({invoices.length} invoices).</p>
        </div>
        <NeuButton onClick={() => setIsModalOpen(true)}>
          <Plus size={18} />
          New Purchase Invoice
        </NeuButton>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <StatCard title="Total Procurement Value" value={`₹${totalProcurement.toLocaleString()}`} icon={DollarSign} />
        <StatCard title="Settled / Paid Invoices" value={`₹${totalPaid.toLocaleString()}`} icon={CheckCircle2} />
        <StatCard title="Unpaid / Pending Bills" value={pendingInvoices} icon={Clock} />
      </div>

      <NeuCard className="p-4 flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="w-full md:max-w-md">
          <NeuInput 
            placeholder="Search bill number, ref, notes..." 
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
                { label: 'All Statuses', value: 'all' },
                { label: 'Pending', value: 'pending' },
                { label: 'Paid', value: 'paid' },
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

      {filteredInvoices.length === 0 ? (
        <NeuCard>
          <EmptyState 
            icon={ShoppingBag} 
            title="No procurement records found" 
            description="There are no purchase invoices matching your filter criteria."
          />
        </NeuCard>
      ) : (
        <NeuTable data={filteredInvoices} columns={columns} />
      )}

      {/* Add Modal */}
      <NeuModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Record New Purchase Invoice">
        <form onSubmit={handleAddInvoice} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <NeuInput 
              label="Bill / Invoice Number" 
              placeholder="e.g. INV-90412" 
              value={billNumber} 
              onChange={(e) => setBillNumber(e.target.value)} 
            />
            <NeuInput 
              label="Supplier Bill Ref" 
              placeholder="e.g. SUP-REF-88" 
              value={supplierBillNo} 
              onChange={(e) => setSupplierBillNo(e.target.value)} 
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <NeuInput 
              label="Total Bill Amount (₹)" 
              type="number"
              placeholder="0.00" 
              value={totalAmount} 
              onChange={(e) => setTotalAmount(e.target.value)} 
              required
            />
            <NeuInput 
              label="Amount Paid (₹)" 
              type="number"
              placeholder="0.00" 
              value={paidAmount} 
              onChange={(e) => setPaidAmount(e.target.value)} 
            />
          </div>
          <NeuSelect 
            label="Payment Status" 
            options={[
              { label: 'Pending / Unpaid', value: 'pending' },
              { label: 'Settled / Paid', value: 'paid' },
            ]} 
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          />
          <NeuInput 
            label="Notes / Supplier Description" 
            placeholder="e.g. Purchased raw materials & cleaning equipment" 
            value={notes} 
            onChange={(e) => setNotes(e.target.value)} 
          />
          <div className="flex justify-end gap-3 pt-4">
            <NeuButton type="button" variant="secondary" onClick={() => setIsModalOpen(false)}>
              Cancel
            </NeuButton>
            <NeuButton type="submit">
              Save Purchase Invoice
            </NeuButton>
          </div>
        </form>
      </NeuModal>

      {/* Delete Confirmation Modal */}
      <NeuModal isOpen={!!deleteId} onClose={() => setDeleteId(null)} title="Confirm Deletion">
        <div className="space-y-4">
          <p className="text-neu-fg">Are you sure you want to delete this purchase invoice record?</p>
          <div className="flex justify-end gap-3 pt-4">
            <NeuButton type="button" variant="secondary" onClick={() => setDeleteId(null)}>
              Cancel
            </NeuButton>
            <NeuButton onClick={() => { if (deleteId) handleDeleteInvoice(deleteId); }}>
              Yes, Delete
            </NeuButton>
          </div>
        </div>
      </NeuModal>
    </div>
  );
}
