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
import { Plus, Search, Users, Download, Filter, Trash2 } from 'lucide-react';
import { format, isAfter, subDays, subMonths } from 'date-fns';
import Papa from 'papaparse';
import { toast } from '@/store/toastStore';
import { playSuccess, playError } from '@/lib/audio';

export default function CustomersPage() {
  const supabase = createClient();
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [timeFilter, setTimeFilter] = useState('all');
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form State
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');

  useEffect(() => {
    async function fetchCustomers() {
      setLoading(true);

      try {
        const { data, error } = await supabase
          .from('clients')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) {
          const { data: custData } = await supabase.from('customers').select('*').order('created_at', { ascending: false });
          setCustomers(custData || []);
        } else {
          setCustomers(data || []);
        }
      } catch (err) {
        console.error('Error fetching customers:', err);
        setCustomers([]);
      } finally {
        setLoading(false);
      }
    }
    fetchCustomers();
  }, [supabase]);

  const handleAddCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    const newCustomer = {
      id: String(Date.now()),
      name,
      phone,
      email,
      address,
      created_at: new Date().toISOString(),
    };

    try {
      const { data, error } = await supabase.from('clients').insert([newCustomer]).select();
      if (!error) {
        setCustomers([{ ...newCustomer, ...(data?.[0] || {}) }, ...customers]);
        playSuccess();
        toast.success('Customer Added', 'The new customer has been registered successfully.');
      } else {
        throw error;
      }
    } catch (err) {
      console.error(err);
      playError();
      toast.error('Registration Failed', 'Could not register customer. Try again.');
    }

    setIsModalOpen(false);
    setName('');
    setPhone('');
    setEmail('');
    setAddress('');
  };

  const handleDeleteCustomer = async (id: string) => {
    try {
      const { error } = await supabase.from('clients').delete().eq('id', id);
      if (error) throw error;
      setCustomers(customers.filter(c => c.id !== id));
      playSuccess();
      toast.success('Customer Deleted', 'The record has been permanently removed.');
    } catch (err) {
      playError();
      toast.error('Deletion Failed', 'Could not remove the customer.');
    }
  };

  const filteredCustomers = customers.filter(c => {
    const matchesSearch = 
      (c.name || '').toLowerCase().includes(search.toLowerCase()) ||
      (c.phone || '').includes(search) ||
      (c.email || '').toLowerCase().includes(search.toLowerCase());

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
    if (filteredCustomers.length === 0) {
      toast.warning('No Data', 'There is no data to export.');
      return;
    }
    const csvData = filteredCustomers.map(c => ({
      'Name': c.name,
      'Phone': c.phone,
      'Email': c.email,
      'Address': c.address,
      'Registered Date': c.created_at ? format(new Date(c.created_at), 'MMM dd, yyyy') : 'N/A'
    }));
    const csv = Papa.unparse(csvData);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `customers_report_${format(new Date(), 'yyyy-MM-dd')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    playSuccess();
    toast.success('Export Successful', 'Your CSV file has been downloaded.');
  };

  const columns = [
    {
      accessorKey: 'name',
      header: 'Customer / Business Name',
      cell: (info: any) => <span className="font-bold text-neu-fg">{info.getValue() || 'Customer'}</span>
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
      accessorKey: 'address',
      header: 'Location / Address',
      cell: (info: any) => <span className="truncate max-w-[240px] block font-medium text-neu-muted">{info.getValue() || 'N/A'}</span>
    },
    {
      accessorKey: 'created_at',
      header: 'Registered Date',
      cell: (info: any) => info.getValue() ? format(new Date(info.getValue()), 'MMM dd, yyyy') : 'N/A'
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: (info: any) => (
        <button 
          onClick={() => handleDeleteCustomer(info.row.original.id)} 
          className="p-1.5 text-neu-muted hover:text-red-500 hover:scale-110 transition-all cursor-pointer" 
          title="Delete Customer"
        >
          <Trash2 size={16} />
        </button>
      )
    },
  ];

  if (loading) {
    return (
      <div className="space-y-6">
        <h2 className="text-xl font-display font-bold text-neu-fg">Customer Management</h2>
        <SkeletonCard className="h-[400px]" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-up">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-xl font-display font-bold text-neu-fg">Customer Directory</h2>
          <p className="text-neu-muted text-sm">Manage residential and commercial client records ({customers.length} records).</p>
        </div>
        <NeuButton onClick={() => setIsModalOpen(true)}>
          <Plus size={18} />
          Add Customer
        </NeuButton>
      </div>

      <NeuCard className="p-4 flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="w-full md:max-w-md">
          <NeuInput 
            placeholder="Search by name, phone, or email..." 
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

      {filteredCustomers.length === 0 ? (
        <NeuCard>
          <EmptyState 
            icon={Users} 
            title="No customers found" 
            description="No customer records in the database matching your search. Register a new customer to get started."
            action={
              <NeuButton variant="secondary" onClick={() => setIsModalOpen(true)}>
                <Plus size={18} />
                Add Customer
              </NeuButton>
            }
          />
        </NeuCard>
      ) : (
        <NeuTable data={filteredCustomers} columns={columns} />
      )}

      {/* Add Customer Modal */}
      <NeuModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Register New Customer">
        <form onSubmit={handleAddCustomer} className="space-y-4">
          <NeuInput 
            label="Customer / Business Name" 
            placeholder="e.g. Metro Tech Plaza" 
            value={name} 
            onChange={(e) => setName(e.target.value)} 
            required 
          />
          <div className="grid grid-cols-2 gap-4">
            <NeuInput 
              label="Phone Number" 
              placeholder="e.g. +91 98765 43210" 
              value={phone} 
              onChange={(e) => setPhone(e.target.value)} 
              required 
            />
            <NeuInput 
              label="Email Address" 
              type="email"
              placeholder="e.g. contact@client.com" 
              value={email} 
              onChange={(e) => setEmail(e.target.value)} 
            />
          </div>
          <NeuInput 
            label="Address / Site Location" 
            placeholder="Full site address..." 
            value={address} 
            onChange={(e) => setAddress(e.target.value)} 
            required
          />
          <div className="flex justify-end gap-3 pt-4">
            <NeuButton type="button" variant="secondary" onClick={() => setIsModalOpen(false)}>
              Cancel
            </NeuButton>
            <NeuButton type="submit">
              Register Customer
            </NeuButton>
          </div>
        </form>
      </NeuModal>
    </div>
  );
}
