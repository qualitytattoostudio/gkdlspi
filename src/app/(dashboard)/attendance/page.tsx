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
import { Search, Clock, Download, Plus, Filter } from 'lucide-react';
import { format, isToday, isThisWeek, isThisMonth, parseISO } from 'date-fns';

export default function AttendancePage() {
  const supabase = createClient();
  const [attendance, setAttendance] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [timeFilter, setTimeFilter] = useState('all'); // all, today, week, month
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form State
  const [employeeName, setEmployeeName] = useState('');
  const [status, setStatus] = useState('present');
  const [attDate, setAttDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  useEffect(() => {
    async function fetchAttendance() {
      setLoading(true);

      try {
        let query = supabase
          .from('attendance_records')
          .select(`
            *,
            profiles!attendance_records_user_id_fkey(full_name)
          `)
          .order('date', { ascending: false })
          .limit(100);

        const { data, error } = await query;
        if (error) {
          const { data: fallbackData } = await supabase.from('attendance_records').select('*').order('date', { ascending: false }).limit(100);
          setAttendance(fallbackData || []);
        } else {
          setAttendance(data || []);
        }
      } catch (err) {
        console.error('Error fetching attendance:', err);
        setAttendance([]);
      } finally {
        setLoading(false);
      }
    }
    fetchAttendance();
  }, [supabase]);

  const handleRecordAttendance = async (e: React.FormEvent) => {
    e.preventDefault();
    const newAtt = {
      id: String(Date.now()),
      date: attDate,
      check_in_time: new Date().toISOString(),
      status,
      profiles: { full_name: employeeName || 'Assigned Employee' },
    };

    try {
      await supabase.from('attendance_records').insert([{
        date: attDate,
        check_in_time: new Date().toISOString(),
        status,
      }]);
    } catch {}

    setAttendance([newAtt, ...attendance]);
    setIsModalOpen(false);
    setEmployeeName('');
  };

  const filteredAttendance = attendance.filter(a => {
    const matchesSearch = (a.profiles?.full_name || '').toLowerCase().includes(search.toLowerCase());
    
    if (!matchesSearch) return false;
    
    if (timeFilter === 'all') return true;
    
    if (!a.date) return false;
    const dateToCheck = parseISO(a.date);

    if (timeFilter === 'today') return isToday(dateToCheck);
    if (timeFilter === 'week') return isThisWeek(dateToCheck);
    if (timeFilter === 'month') return isThisMonth(dateToCheck);

    return true;
  });

  const exportCSV = () => {
    const csvContent = [
      ['Employee Name', 'Date', 'Check In', 'Check Out', 'Status'],
      ...filteredAttendance.map(a => [
        a.profiles?.full_name || 'Employee',
        a.date ? format(new Date(a.date), 'MMM dd, yyyy') : 'N/A',
        a.check_in_time ? format(new Date(a.check_in_time), 'hh:mm a') : 'N/A',
        a.check_out_time ? format(new Date(a.check_out_time), 'hh:mm a') : 'On Duty',
        a.status || 'present'
      ])
    ].map(e => e.join(",")).join("\n");
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Attendance_Log_${timeFilter}_${new Date().toISOString().split('T')[0]}.csv`);
    link.click();
  };

  const getStatusBadge = (st: string) => {
    let variant: BadgeVariant = 'neutral';
    if (st === 'present') variant = 'success';
    if (st === 'absent') variant = 'error';
    if (st === 'leave') variant = 'warning';
    
    return <NeuBadge variant={variant}>{st || 'present'}</NeuBadge>;
  };

  const columns = [
    {
      accessorKey: 'profiles.full_name',
      header: 'Employee Name',
      cell: (info: any) => <span className="font-bold text-neu-fg">{info.getValue() || 'Employee'}</span>
    },
    {
      accessorKey: 'date',
      header: 'Date',
      cell: (info: any) => info.getValue() ? format(new Date(info.getValue()), 'MMM dd, yyyy') : 'N/A'
    },
    {
      accessorKey: 'check_in_time',
      header: 'Check In',
      cell: (info: any) => info.getValue() ? format(new Date(info.getValue()), 'hh:mm a') : 'N/A'
    },
    {
      accessorKey: 'check_out_time',
      header: 'Check Out',
      cell: (info: any) => info.getValue() ? format(new Date(info.getValue()), 'hh:mm a') : 'On Duty'
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
        <h2 className="text-xl font-display font-bold text-neu-fg">Attendance Tracking</h2>
        <SkeletonCard className="h-[400px]" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-up">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-xl font-display font-bold text-neu-fg">Attendance Tracking (V-Admin Synced)</h2>
          <p className="text-neu-muted text-sm">Monitor staff check-ins and attendance logs ({filteredAttendance.length} records shown).</p>
        </div>
        <div className="flex gap-3">
          <NeuButton onClick={exportCSV} variant="secondary">
            <Download size={16} />
            Export CSV
          </NeuButton>
          <NeuButton onClick={() => setIsModalOpen(true)}>
            <Plus size={18} />
            Record Attendance
          </NeuButton>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <NeuCard className="p-4 flex gap-4 items-center">
          <div className="w-full">
            <NeuInput 
              placeholder="Search employee names..." 
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

      {filteredAttendance.length === 0 ? (
        <NeuCard>
          <EmptyState 
            icon={Clock} 
            title="No attendance records found" 
            description="No attendance records in the database matching your search."
            action={
              <NeuButton variant="secondary" onClick={() => setIsModalOpen(true)}>
                <Plus size={18} />
                Record Attendance
              </NeuButton>
            }
          />
        </NeuCard>
      ) : (
        <NeuTable data={filteredAttendance} columns={columns} />
      )}

      {/* Record Attendance Modal */}
      <NeuModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Record Manual Attendance Entry">
        <form onSubmit={handleRecordAttendance} className="space-y-4">
          <NeuInput 
            label="Employee Name" 
            placeholder="e.g. Suresh Kumar" 
            value={employeeName} 
            onChange={(e) => setEmployeeName(e.target.value)} 
          />
          <NeuSelect 
            label="Attendance Status" 
            options={[
              { label: 'Present', value: 'present' },
              { label: 'Absent', value: 'absent' },
              { label: 'On Leave', value: 'leave' },
            ]} 
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          />
          <NeuInput 
            label="Date" 
            type="date"
            value={attDate} 
            onChange={(e) => setAttDate(e.target.value)} 
          />
          <div className="flex justify-end gap-3 pt-4">
            <NeuButton type="button" variant="secondary" onClick={() => setIsModalOpen(false)}>
              Cancel
            </NeuButton>
            <NeuButton type="submit">
              Record Attendance
            </NeuButton>
          </div>
        </form>
      </NeuModal>
    </div>
  );
}
