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
import { CalendarRange, Plus, Search, Download, MapPin, Clock, CheckCircle, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { MONTH_FILTER_OPTIONS, matchesTimeFilter } from '@/lib/utils';
import Papa from 'papaparse';
import { toast } from '@/store/toastStore';
import { playSuccess, playError } from '@/lib/audio';

export default function RosteringPage() {
  const supabase = createClient();
  const [schedules, setSchedules] = useState<any[]>([]);
  const [supervisors, setSupervisors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [timeFilter, setTimeFilter] = useState('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Form State
  const [locationDetails, setLocationDetails] = useState('');
  const [shiftName, setShiftName] = useState('Morning Shift');
  const [scheduleDate, setScheduleDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [supervisorId, setSupervisorId] = useState('');
  const [status, setStatus] = useState('scheduled');

  useEffect(() => {
    async function fetchRostering() {
      setLoading(true);
      try {
        const { data: sups } = await supabase.from('profiles').select('id, full_name');
        setSupervisors(sups || []);

        const { data, error } = await supabase
          .from('cleaning_schedules')
          .select('*')
          .order('schedule_date', { ascending: false });

        if (error) throw error;
        setSchedules(data || []);
      } catch (err) {
        console.error('Error fetching cleaning schedules:', err);
        setSchedules([]);
      } finally {
        setLoading(false);
      }
    }
    fetchRostering();
  }, [supabase]);

  const supervisorMap = new Map(supervisors.map(s => [s.id, s.full_name]));

  const handleAddSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    const newSchedule = {
      location_details: locationDetails || 'General Facility Site',
      shift_name: shiftName,
      schedule_date: scheduleDate,
      supervisor_id: supervisorId || null,
      status: status || 'scheduled',
      created_at: new Date().toISOString(),
    };

    try {
      const { data, error } = await supabase
        .from('cleaning_schedules')
        .insert([newSchedule])
        .select('*');

      if (!error && data) {
        setSchedules(prev => [data[0], ...prev]);
        playSuccess();
        toast.success('Shift Scheduled', 'Roster shift created successfully.');
      } else {
        throw error;
      }
    } catch (err) {
      console.error('Error adding schedule:', err);
      playError();
      toast.error('Scheduling Failed', 'Could not create site shift roster.');
    }

    setIsModalOpen(false);
    setLocationDetails('');
    setShiftName('Morning Shift');
    setScheduleDate(format(new Date(), 'yyyy-MM-dd'));
    setSupervisorId('');
    setStatus('scheduled');
  };

  const handleDeleteSchedule = async (id: string) => {
    try {
      const { error } = await supabase
        .from('cleaning_schedules')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setSchedules(prev => prev.filter(s => s.id !== id));
      playSuccess();
      toast.success('Roster Deleted', 'Shift schedule removed successfully.');
    } catch (err) {
      console.error('Error deleting schedule:', err);
      playError();
      toast.error('Deletion Failed', 'Could not remove roster shift.');
    }
    setDeleteId(null);
  };

  const filteredSchedules = schedules.filter(sch => {
    const supName = supervisorMap.get(sch.supervisor_id) || '';
    const matchesSearch =
      (sch.location_details || '').toLowerCase().includes(search.toLowerCase()) ||
      (sch.shift_name || '').toLowerCase().includes(search.toLowerCase()) ||
      supName.toLowerCase().includes(search.toLowerCase());

    const matchesStatus = statusFilter === 'all' || sch.status?.toLowerCase() === statusFilter.toLowerCase();
    const matchesTime = matchesTimeFilter(sch.schedule_date, timeFilter);

    return matchesSearch && matchesStatus && matchesTime;
  });

  const exportCSV = () => {
    if (filteredSchedules.length === 0) {
      toast.warning('No Data', 'There is no data to export.');
      return;
    }
    const csvData = filteredSchedules.map(sch => ({
      'Site Location': sch.location_details || 'N/A',
      'Shift': sch.shift_name || 'N/A',
      'Supervisor': supervisorMap.get(sch.supervisor_id) || 'Unassigned',
      'Schedule Date': sch.schedule_date || 'N/A',
      'Status': sch.status || 'Scheduled',
    }));
    const csv = Papa.unparse(csvData);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `rostering_schedule_report_${format(new Date(), 'yyyy-MM-dd')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    playSuccess();
    toast.success('Export Successful', 'Rostering CSV downloaded.');
  };

  const columns = [
    {
      accessorKey: 'location_details',
      header: 'Facility Site Location',
      cell: (info: any) => <span className="font-bold text-neu-fg">{info.getValue() || 'Main Complex'}</span>
    },
    {
      accessorKey: 'shift_name',
      header: 'Shift Timing',
      cell: (info: any) => <span className="font-semibold text-neu-accent">{info.getValue() || 'Standard Shift'}</span>
    },
    {
      accessorKey: 'supervisor_id',
      header: 'Assigned Supervisor',
      cell: (info: any) => supervisorMap.get(info.getValue()) || 'Unassigned'
    },
    {
      accessorKey: 'schedule_date',
      header: 'Roster Date',
      cell: (info: any) => info.getValue() ? format(new Date(info.getValue()), 'MMM dd, yyyy') : 'N/A'
    },
    {
      accessorKey: 'status',
      header: 'Shift Status',
      cell: (info: any) => {
        const val = (info.getValue() || 'scheduled').toLowerCase();
        let color = 'bg-blue-100 text-blue-700';
        if (val === 'completed' || val === 'active') color = 'bg-emerald-100 text-emerald-700';
        if (val === 'cancelled') color = 'bg-red-100 text-red-700';

        return (
          <span className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${color}`}>
            {val}
          </span>
        );
      }
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
          title="Delete Schedule"
        >
          <Trash2 size={18} />
        </button>
      )
    },
  ];

  if (loading) {
    return (
      <div className="space-y-6">
        <h2 className="text-xl font-display font-bold text-neu-fg">Advanced Rostering & Sites</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => <SkeletonCard key={i} className="h-32" />)}
        </div>
        <SkeletonCard className="h-[400px]" />
      </div>
    );
  }

  const activeShifts = schedules.filter(s => s.status === 'active' || s.status === 'scheduled').length;
  const completedShifts = schedules.filter(s => s.status === 'completed').length;

  return (
    <div className="space-y-6 animate-fade-up">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-xl font-display font-bold text-neu-fg">Advanced Rostering & Sites</h2>
          <p className="text-neu-muted text-sm">Coordinate multi-site shift allocations and supervisor rosters ({schedules.length} schedules).</p>
        </div>
        <NeuButton onClick={() => setIsModalOpen(true)}>
          <Plus size={18} />
          Create Shift Roster
        </NeuButton>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <StatCard title="Total Scheduled Shifts" value={schedules.length} icon={CalendarRange} />
        <StatCard title="Active / Upcoming Shifts" value={activeShifts} icon={Clock} />
        <StatCard title="Completed Shift Logs" value={completedShifts} icon={CheckCircle} />
      </div>

      <NeuCard className="p-4 flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="w-full md:max-w-md">
          <NeuInput 
            placeholder="Search site location, shift, supervisor..." 
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
                { label: 'Scheduled', value: 'scheduled' },
                { label: 'Completed', value: 'completed' },
              ]}
            />
          </div>
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

      {filteredSchedules.length === 0 ? (
        <NeuCard>
          <EmptyState 
            icon={CalendarRange} 
            title="No shift rosters found" 
            description="No shift schedules match your current search parameters."
          />
        </NeuCard>
      ) : (
        <NeuTable data={filteredSchedules} columns={columns} />
      )}

      {/* Add Modal */}
      <NeuModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Create New Site Shift Roster">
        <form onSubmit={handleAddSchedule} className="space-y-4">
          <NeuInput 
            label="Facility / Site Location" 
            placeholder="e.g. Building A - Sector 4" 
            value={locationDetails} 
            onChange={(e) => setLocationDetails(e.target.value)} 
            required
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <NeuSelect 
              label="Shift Type" 
              options={[
                { label: 'Morning Shift (06:00 - 14:00)', value: 'Morning Shift' },
                { label: 'Evening Shift (14:00 - 22:00)', value: 'Evening Shift' },
                { label: 'Night Shift (22:00 - 06:00)', value: 'Night Shift' },
                { label: 'General Day Shift (09:00 - 18:00)', value: 'General Day Shift' },
              ]} 
              value={shiftName}
              onChange={(e) => setShiftName(e.target.value)}
            />
            <NeuInput 
              label="Roster Date" 
              type="date"
              value={scheduleDate} 
              onChange={(e) => setScheduleDate(e.target.value)} 
              required
            />
          </div>
          <NeuSelect 
            label="Supervisor In-Charge" 
            options={[
              { label: 'Select Supervisor...', value: '' },
              ...supervisors.map(s => ({ label: s.full_name || 'Supervisor', value: s.id }))
            ]} 
            value={supervisorId}
            onChange={(e) => setSupervisorId(e.target.value)}
          />
          <NeuSelect 
            label="Status" 
            options={[
              { label: 'Scheduled', value: 'scheduled' },
              { label: 'Completed', value: 'completed' },
            ]} 
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          />
          <div className="flex justify-end gap-3 pt-4">
            <NeuButton type="button" variant="secondary" onClick={() => setIsModalOpen(false)}>
              Cancel
            </NeuButton>
            <NeuButton type="submit">
              Save Shift Roster
            </NeuButton>
          </div>
        </form>
      </NeuModal>

      {/* Delete Confirmation Modal */}
      <NeuModal isOpen={!!deleteId} onClose={() => setDeleteId(null)} title="Confirm Deletion">
        <div className="space-y-4">
          <p className="text-neu-fg">Are you sure you want to remove this shift roster schedule?</p>
          <div className="flex justify-end gap-3 pt-4">
            <NeuButton type="button" variant="secondary" onClick={() => setDeleteId(null)}>
              Cancel
            </NeuButton>
            <NeuButton onClick={() => { if (deleteId) handleDeleteSchedule(deleteId); }}>
              Yes, Delete
            </NeuButton>
          </div>
        </div>
      </NeuModal>
    </div>
  );
}
