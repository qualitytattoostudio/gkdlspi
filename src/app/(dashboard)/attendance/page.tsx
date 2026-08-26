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
import { StatCard } from '@/components/neu/StatCard';
import { Search, Clock, Download, Plus, Filter, UserCheck, Calendar, CheckCircle2, FileText } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { MONTH_FILTER_OPTIONS, matchesTimeFilter } from '@/lib/utils';
import { toast } from '@/store/toastStore';
import { playSuccess, playError } from '@/lib/audio';

export default function AttendancePage() {
  const supabase = createClient();
  const [attendance, setAttendance] = useState<any[]>([]);
  const [profilesMap, setProfilesMap] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [timeFilter, setTimeFilter] = useState('all'); // all, today, week, month, '2026-08', etc.
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form State
  const [employeeName, setEmployeeName] = useState('');
  const [status, setStatus] = useState('present');
  const [attDate, setAttDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [attNotes, setAttNotes] = useState('');

  useEffect(() => {
    async function fetchAttendance() {
      setLoading(true);

      try {
        // Fetch all staff profiles first
        const { data: profs } = await supabase.from('profiles').select('id, full_name, email, role');
        const pMap = new Map<string, string>();
        (profs || []).forEach(p => {
          if (p.id) pMap.set(p.id, p.full_name || p.email || 'Staff Member');
        });
        setProfilesMap(pMap);

        // Fetch all attendance records ordered newest first
        const { data: attData, error } = await supabase
          .from('attendance_records')
          .select('*')
          .order('date', { ascending: false });

        if (error) throw error;

        const mapped = (attData || []).map(a => {
          const resolvedName = pMap.get(a.user_id) || 'Staff Member';
          return {
            ...a,
            employee_name: resolvedName,
            profiles: { full_name: resolvedName },
            eod_notes: a.notes || a.checkout_notes || a.remarks || 'Standard Duty Log'
          };
        });

        setAttendance(mapped);
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
      notes: attNotes,
      eod_notes: attNotes || 'Manual EOD Entry',
      employee_name: employeeName || 'Assigned Employee',
      profiles: { full_name: employeeName || 'Assigned Employee' },
    };

    try {
      const { data, error } = await supabase.from('attendance_records').insert([{
        date: attDate,
        check_in_time: new Date().toISOString(),
        status,
        notes: attNotes || null,
        checkout_notes: attNotes || null
      }]).select('*');

      if (!error && data && data.length > 0) {
        playSuccess();
        toast.success('Attendance Recorded', 'Manual entry & EOD notes saved to database.');
      }
    } catch (err) {
      console.error(err);
      playError();
    }

    setAttendance(prev => [newAtt, ...prev]);
    setIsModalOpen(false);
    setEmployeeName('');
    setAttNotes('');
  };

  const filteredAttendance = attendance.filter(a => {
    const nameToCheck = (a.employee_name || a.profiles?.full_name || '').toLowerCase();
    const notesToCheck = (a.eod_notes || a.notes || '').toLowerCase();
    const matchesSearch = nameToCheck.includes(search.toLowerCase()) || notesToCheck.includes(search.toLowerCase());
    if (!matchesSearch) return false;
    
    return matchesTimeFilter(a.date || a.check_in_time, timeFilter);
  });

  const exportCSV = () => {
    if (filteredAttendance.length === 0) {
      toast.warning('No Records', 'There are no attendance records to export.');
      return;
    }
    const csvContent = [
      ['Employee Name', 'Date', 'Check In', 'Check Out', 'Status', 'EOD Work Notes'],
      ...filteredAttendance.map(a => [
        a.employee_name || a.profiles?.full_name || 'Employee',
        a.date ? format(new Date(a.date), 'MMM dd, yyyy') : 'N/A',
        a.check_in_time ? format(new Date(a.check_in_time), 'hh:mm a') : 'N/A',
        a.check_out_time ? format(new Date(a.check_out_time), 'hh:mm a') : 'On Duty',
        a.status || 'present',
        `"${(a.eod_notes || '').replace(/"/g, '""')}"`
      ])
    ].map(e => e.join(",")).join("\n");
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Attendance_Log_${timeFilter}_${new Date().toISOString().split('T')[0]}.csv`);
    link.click();
    playSuccess();
    toast.success('Export Successful', 'Attendance & EOD Notes CSV downloaded.');
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
      accessorKey: 'employee_name',
      header: 'Employee Name',
      cell: (info: any) => (
        <div className="flex items-center gap-2">
          <UserCheck size={16} className="text-neu-accent shrink-0" />
          <span className="font-bold text-neu-fg">{info.getValue() || 'Staff Member'}</span>
        </div>
      )
    },
    {
      accessorKey: 'date',
      header: 'Date',
      cell: (info: any) => {
        const val = info.getValue();
        if (!val) return 'N/A';
        try {
          return format(parseISO(val.length === 10 ? `${val}T00:00:00` : val), 'MMM dd, yyyy (EEE)');
        } catch {
          return val;
        }
      }
    },
    {
      accessorKey: 'check_in_time',
      header: 'Check In Time',
      cell: (info: any) => {
        const val = info.getValue();
        if (!val) return 'N/A';
        try {
          return format(new Date(val), 'hh:mm a');
        } catch {
          return val;
        }
      }
    },
    {
      accessorKey: 'check_out_time',
      header: 'Check Out Time',
      cell: (info: any) => {
        const val = info.getValue();
        if (!val) return <span className="text-neu-accent font-semibold text-xs">On Duty / Active</span>;
        try {
          return format(new Date(val), 'hh:mm a');
        } catch {
          return val;
        }
      }
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: (info: any) => getStatusBadge(info.getValue())
    },
    {
      accessorKey: 'eod_notes',
      header: 'EOD Remarks / Work Notes',
      cell: (info: any) => (
        <div className="flex items-center gap-1.5 max-w-xs">
          <FileText size={14} className="text-neu-muted shrink-0" />
          <span className="text-xs text-neu-fg truncate font-medium" title={info.getValue() || 'No notes'}>
            {info.getValue() || 'Standard Duty Log'}
          </span>
        </div>
      )
    },
  ];

  if (loading) {
    return (
      <div className="space-y-6">
        <h2 className="text-xl font-display font-bold text-neu-fg">Attendance Tracking</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => <SkeletonCard key={i} className="h-28" />)}
        </div>
        <SkeletonCard className="h-[400px]" />
      </div>
    );
  }

  const presentCount = filteredAttendance.filter(a => (a.status || 'present') === 'present').length;
  const absentCount = filteredAttendance.filter(a => a.status === 'absent' || a.status === 'leave').length;

  return (
    <div className="space-y-6 animate-fade-up">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-xl font-display font-bold text-neu-fg">Attendance Tracking (V-Admin Synced)</h2>
          <p className="text-neu-muted text-sm">Monitor staff check-ins, attendance logs, and EOD work notes ({filteredAttendance.length} records shown from {attendance.length} total database logs).</p>
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

      {/* KPI Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <StatCard title="Total Matching Records" value={filteredAttendance.length} icon={Calendar} />
        <StatCard title="Present / Duty Verified" value={presentCount} icon={CheckCircle2} />
        <StatCard title="Absent / Leave Logs" value={absentCount} icon={Clock} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <NeuCard className="p-4 flex gap-4 items-center">
          <div className="w-full">
            <NeuInput 
              placeholder="Search employee names or EOD work notes..." 
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

      {filteredAttendance.length === 0 ? (
        <NeuCard>
          <EmptyState 
            icon={Clock} 
            title="No attendance records found" 
            description="No attendance records in the database matching your search or month filter."
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
          <NeuInput 
            label="EOD Work Remarks / Notes for Manager" 
            placeholder="Enter shift summary or EOD work notes..." 
            value={attNotes} 
            onChange={(e) => setAttNotes(e.target.value)} 
          />
          <div className="flex justify-end gap-3 pt-4">
            <NeuButton type="button" variant="secondary" onClick={() => setIsModalOpen(false)}>
              Cancel
            </NeuButton>
            <NeuButton type="submit">
              Record Attendance & EOD Notes
            </NeuButton>
          </div>
        </form>
      </NeuModal>
    </div>
  );
}
