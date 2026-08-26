'use client';

import React, { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { NeuCard } from '@/components/neu/NeuCard';
import { NeuTable } from '@/components/neu/NeuTable';
import { NeuButton } from '@/components/neu/NeuButton';
import { NeuBadge, BadgeVariant } from '@/components/neu/NeuBadge';
import { EmptyState } from '@/components/neu/EmptyState';
import { SkeletonCard } from '@/components/neu/SkeletonCard';
import { StatCard } from '@/components/neu/StatCard';
import { NeuModal } from '@/components/neu/NeuModal';
import { NeuInput } from '@/components/neu/NeuInput';
import { NeuSelect } from '@/components/neu/NeuSelect';
import { FileText, Calendar, MapPin, CheckCircle, Clock, Plus, Search, Download, Filter, Trash2 } from 'lucide-react';
import { format, isAfter, subDays, subMonths } from 'date-fns';
import Papa from 'papaparse';
import { toast } from '@/store/toastStore';
import { playSuccess, playError } from '@/lib/audio';

export default function ContractsPage() {
  const supabase = createClient();
  const [schedules, setSchedules] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [employees, setEmployees] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [timeFilter, setTimeFilter] = useState('all');

  // Form State
  const [shiftName, setShiftName] = useState('');
  const [locationDetails, setLocationDetails] = useState('');
  const [supervisorId, setSupervisorId] = useState('');
  const [manualSupervisorName, setManualSupervisorName] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactNumber, setContactNumber] = useState('');
  const [scheduleDate, setScheduleDate] = useState('');
  const [status, setStatus] = useState('scheduled');

  useEffect(() => {
    async function fetchSchedules() {
      setLoading(true);
      try {
        const { data: profData } = await supabase.from('profiles').select('id, full_name, role').eq('is_active', true);
        setEmployees(profData || []);
        
        const profileMap = new Map<string, string>();
        (profData || []).forEach(p => { if (p.id) profileMap.set(p.id, p.full_name || 'Supervisor'); });

        const { data: schedData, error } = await supabase
          .from('cleaning_schedules')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) throw error;

        const mapped = (schedData || []).map(s => ({
          ...s,
          supervisor_name: profileMap.get(s.supervisor_id) || 'Assigned Supervisor'
        }));

        setSchedules(mapped);
      } catch (err) {
        console.error('Error fetching schedules:', err);
        setSchedules([]);
      } finally {
        setLoading(false);
      }
    }
    fetchSchedules();
  }, [supabase]);

  const handleCreateContract = async (e: React.FormEvent) => {
    e.preventDefault();

    const newContract = {
      shift_name: shiftName || null,
      location_details: locationDetails || null,
      supervisor_id: supervisorId || null,
      // If we had a contact_name, contact_number, or manual_supervisor field, we'd add it here.
      // Since we don't know the schema exactly, we'll append it to location_details or a notes column.
      schedule_date: scheduleDate || null,
      status: status || 'scheduled',
      created_at: new Date().toISOString(),
    };

    // Store additional info in shift_name or location_details if columns don't exist
    if (contactName || contactNumber) {
      newContract.location_details = `${newContract.location_details || ''} | Contact: ${contactName} (${contactNumber})`.trim();
    }
    if (manualSupervisorName && !supervisorId) {
      newContract.shift_name = `${newContract.shift_name || ''} | Sup: ${manualSupervisorName}`.trim();
    }

    try {
      const { data, error } = await supabase
        .from('cleaning_schedules')
        .insert([newContract])
        .select('*');

      if (!error && data) {
        const supervisorName = employees.find(emp => emp.id === supervisorId)?.full_name || 'Assigned Supervisor';
        setSchedules([{
          ...data[0],
          supervisor_name: supervisorName
        }, ...schedules]);
        playSuccess();
        toast.success('Contract Created', 'The service schedule contract has been saved.');
      } else {
        throw error;
      }
    } catch (err) {
      console.error('Error creating contract:', err);
      playError();
      toast.error('Creation Failed', 'Could not save the contract.');
    }

    setIsModalOpen(false);
    setShiftName('');
    setLocationDetails('');
    setSupervisorId('');
    setManualSupervisorName('');
    setContactName('');
    setContactNumber('');
    setScheduleDate('');
    setStatus('scheduled');
  };

  const handleDeleteContract = async (id: string) => {
    try {
      const { error } = await supabase.from('cleaning_schedules').delete().eq('id', id);
      if (error) throw error;
      setSchedules(schedules.filter(s => s.id !== id));
      playSuccess();
      toast.success('Contract Deleted', 'The service schedule has been removed.');
    } catch (err) {
      playError();
      toast.error('Deletion Failed', 'Could not remove the contract.');
    }
  };

  const handleStatusChange = async (id: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('cleaning_schedules')
        .update({ status: newStatus })
        .eq('id', id);

      if (!error) {
        setSchedules(prev => prev.map(s => s.id === id ? { ...s, status: newStatus } : s));
        playSuccess();
        toast.success('Status Updated', `Contract is now ${newStatus}.`);
      } else {
        throw error;
      }
    } catch (err) {
      console.error('Error updating contract status:', err);
      playError();
      toast.error('Update Failed', 'Could not change the contract status.');
    }
  };

  const getStatusBadge = (st: string) => {
    let variant: BadgeVariant = 'neutral';
    if (st === 'completed' || st === 'active') variant = 'success';
    if (st === 'pending' || st === 'scheduled') variant = 'warning';
    if (st === 'cancelled') variant = 'error';
    return <NeuBadge variant={variant}>{st || 'scheduled'}</NeuBadge>;
  };

  const filtered = schedules.filter(s => {
    const matchesSearch = 
      (s.shift_name || '').toLowerCase().includes(search.toLowerCase()) ||
      (s.location_details || '').toLowerCase().includes(search.toLowerCase()) ||
      (s.supervisor_name || '').toLowerCase().includes(search.toLowerCase());

    let matchesTime = true;
    if (timeFilter === 'today') {
      matchesTime = isAfter(new Date(s.created_at), subDays(new Date(), 1));
    } else if (timeFilter === 'week') {
      matchesTime = isAfter(new Date(s.created_at), subDays(new Date(), 7));
    } else if (timeFilter === 'month') {
      matchesTime = isAfter(new Date(s.created_at), subMonths(new Date(), 1));
    }

    return matchesSearch && matchesTime;
  });

  const exportCSV = () => {
    if (filtered.length === 0) {
      toast.warning('No Data', 'There is no data to export.');
      return;
    }
    const csvData = filtered.map(s => ({
      'Shift/Scope': s.shift_name,
      'Location': s.location_details,
      'Supervisor': s.supervisor_name,
      'Status': s.status,
      'Scheduled Date': s.schedule_date ? format(new Date(s.schedule_date), 'MMM dd, yyyy') : 'Recurring',
      'Created At': format(new Date(s.created_at), 'MMM dd, yyyy HH:mm')
    }));
    const csv = Papa.unparse(csvData);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `contracts_report_${format(new Date(), 'yyyy-MM-dd')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    playSuccess();
    toast.success('Export Successful', 'Your CSV file has been downloaded.');
  };

  const columns = [
    {
      accessorKey: 'shift_name',
      header: 'Shift / Contract Scope',
      cell: (info: any) => <span className="font-bold text-neu-fg">{info.getValue() || 'General Cleaning Shift'}</span>
    },
    {
      accessorKey: 'location_details',
      header: 'Location / Site',
      cell: (info: any) => <span className="font-medium text-neu-muted">{info.getValue() || 'Main Facility'}</span>
    },
    {
      accessorKey: 'supervisor_name',
      header: 'Supervisor',
      cell: (info: any) => info.getValue() || 'Unassigned'
    },
    {
      accessorKey: 'schedule_date',
      header: 'Scheduled Date',
      cell: (info: any) => info.getValue() ? format(new Date(info.getValue()), 'MMM dd, yyyy') : 'Recurring'
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: (info: any) => (
        <div className="flex items-center gap-2">
          <select
            value={info.getValue() || 'scheduled'}
            onChange={(e) => handleStatusChange(info.row.original.id, e.target.value)}
            className="bg-neu-bg shadow-neu-inset-sm text-xs font-bold text-neu-fg rounded-lg px-2 py-1 outline-none cursor-pointer"
          >
            <option value="scheduled">Scheduled</option>
            <option value="active">Active</option>
            <option value="pending">Pending</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <button 
            onClick={() => handleDeleteContract(info.row.original.id)} 
            className="p-1.5 text-neu-muted hover:text-red-500 hover:scale-110 transition-all cursor-pointer ml-2" 
            title="Delete Contract"
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
        <h2 className="text-xl font-display font-bold text-neu-fg">Service Schedules & Contracts</h2>
        <SkeletonCard className="h-[400px]" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-up">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-xl font-display font-bold text-neu-fg">Service Schedules & Contracts</h2>
          <p className="text-neu-muted text-sm">Directly synchronized with database `cleaning_schedules` table ({schedules.length} schedules).</p>
        </div>
        <NeuButton onClick={() => setIsModalOpen(true)}>
          <Plus size={18} />
          Create Contract
        </NeuButton>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <StatCard title="Total Service Schedules" value={schedules.length} icon={FileText} />
        <StatCard title="Active Shifts" value={schedules.filter(s => s.status === 'active' || s.status === 'scheduled').length} icon={Clock} />
        <StatCard title="Completed Shifts" value={schedules.filter(s => s.status === 'completed').length} icon={CheckCircle} />
      </div>

      <NeuCard className="p-4 flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="w-full md:max-w-md">
          <NeuInput 
            placeholder="Search contracts..." 
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
                { label: 'Added Today', value: 'today' },
                { label: 'Added This Week', value: 'week' },
                { label: 'Added This Month', value: 'month' },
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
            icon={FileText} 
            title="No cleaning schedules or contracts found" 
            description="No active service schedule contracts found in the database."
            action={
              <NeuButton variant="secondary" onClick={() => setIsModalOpen(true)}>
                <Plus size={18} />
                Create Contract
              </NeuButton>
            }
          />
        </NeuCard>
      ) : (
        <NeuTable data={filtered} columns={columns} />
      )}

      {/* Record Contract Modal */}
      <NeuModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Create New Contract / Schedule">
        <form onSubmit={handleCreateContract} className="space-y-4">
          <NeuInput 
            label="Shift / Contract Scope" 
            placeholder="e.g. Daily Facility Maintenance" 
            value={shiftName} 
            onChange={(e) => setShiftName(e.target.value)} 
          />
          <NeuInput 
            label="Location / Site Details" 
            placeholder="e.g. Block A, Sector 4" 
            value={locationDetails} 
            onChange={(e) => setLocationDetails(e.target.value)} 
          />
          <NeuSelect 
            label="Load Database Supervisor (Optional)" 
            options={[
              { label: 'Unassigned / Manual', value: '' },
              ...employees.map(e => ({ label: `${e.full_name || 'Staff'} (${e.role || 'Member'})`, value: e.id }))
            ]} 
            value={supervisorId}
            onChange={(e) => setSupervisorId(e.target.value)}
          />
          {!supervisorId && (
            <NeuInput 
              label="Manual Supervisor Name" 
              placeholder="e.g. John Doe (External)" 
              value={manualSupervisorName} 
              onChange={(e) => setManualSupervisorName(e.target.value)} 
            />
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <NeuInput 
              label="Contact Person Name" 
              placeholder="e.g. Jane Smith" 
              value={contactName} 
              onChange={(e) => setContactName(e.target.value)} 
            />
            <NeuInput 
              label="Contact Phone Number" 
              placeholder="e.g. +91 9876543210" 
              value={contactNumber} 
              onChange={(e) => setContactNumber(e.target.value)} 
            />
          </div>
          <NeuInput 
            label="Scheduled Date" 
            type="date"
            value={scheduleDate} 
            onChange={(e) => setScheduleDate(e.target.value)} 
          />
          <NeuSelect 
            label="Status" 
            options={[
              { label: 'Scheduled', value: 'scheduled' },
              { label: 'Active', value: 'active' },
              { label: 'Pending', value: 'pending' },
              { label: 'Completed', value: 'completed' },
              { label: 'Cancelled', value: 'cancelled' },
            ]} 
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          />
          <div className="flex justify-end gap-3 pt-4">
            <NeuButton type="button" variant="secondary" onClick={() => setIsModalOpen(false)}>
              Cancel
            </NeuButton>
            <NeuButton type="submit">
              Save Contract
            </NeuButton>
          </div>
        </form>
      </NeuModal>
    </div>
  );
}
