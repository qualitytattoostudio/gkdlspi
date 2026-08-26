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
import { Search, Clock, Download, Plus, Filter, UserCheck, Calendar, CheckCircle2, FileText, Edit2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { MONTH_FILTER_OPTIONS, matchesTimeFilter } from '@/lib/utils';
import { toast } from '@/store/toastStore';
import { playSuccess, playError } from '@/lib/audio';

export default function AttendancePage() {
  const supabase = createClient();
  const [attendance, setAttendance] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [profilesMap, setProfilesMap] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [timeFilter, setTimeFilter] = useState('all');

  // Record Attendance Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedStaffId, setSelectedStaffId] = useState('');
  const [status, setStatus] = useState('present');
  const [attDate, setAttDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [attNotes, setAttNotes] = useState('');

  // Edit Notes Modal State
  const [isEditNotesModalOpen, setIsEditNotesModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<any>(null);
  const [editNotesValue, setEditNotesValue] = useState('');

  const fetchAttendance = async () => {
    try {
      // Fetch all staff profiles first
      const { data: profs } = await supabase
        .from('profiles')
        .select('id, full_name, email, role')
        .eq('is_active', true)
        .order('full_name', { ascending: true });

      setEmployees(profs || []);
      if (profs && profs.length > 0 && !selectedStaffId) {
        setSelectedStaffId(profs[0].id);
      }

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
        const noteText = a.notes || a.checkout_notes || a.remarks || 'Standard Duty Log';
        return {
          ...a,
          employee_name: resolvedName,
          profiles: { full_name: resolvedName },
          eod_notes: noteText
        };
      });

      setAttendance(mapped);
    } catch (err) {
      console.error('Error fetching attendance:', err);
      setAttendance([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAttendance();

    // Supabase Realtime Subscription for instant notes update in GM portal
    const attChannel = supabase
      .channel('realtime_attendance_notes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance_records' }, (payload) => {
        if (payload.eventType === 'UPDATE') {
          setAttendance(prev => prev.map(a => {
            if (a.id === payload.new.id) {
              const updatedNotes = payload.new.notes || payload.new.checkout_notes || payload.new.remarks || a.eod_notes;
              return {
                ...a,
                ...payload.new,
                notes: updatedNotes,
                checkout_notes: updatedNotes,
                remarks: updatedNotes,
                eod_notes: updatedNotes
              };
            }
            return a;
          }));
        } else if (payload.eventType === 'INSERT') {
          fetchAttendance();
        } else if (payload.eventType === 'DELETE') {
          setAttendance(prev => prev.filter(a => a.id !== payload.old.id));
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'work_notes' }, () => {
        fetchAttendance();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(attChannel);
    };
  }, [supabase]);

  const handleRecordAttendance = async (e: React.FormEvent) => {
    e.preventDefault();
    const staffObj = employees.find(e => e.id === selectedStaffId);
    const staffName = staffObj?.full_name || 'Staff Member';

    try {
      const { data, error } = await supabase.from('attendance_records').insert([{
        user_id: selectedStaffId || null,
        date: attDate,
        check_in_time: new Date().toISOString(),
        status,
        notes: attNotes || null,
        checkout_notes: attNotes || null,
        remarks: attNotes || null
      }]).select('*');

      if (!error && data && data.length > 0) {
        const newRecord = {
          ...data[0],
          employee_name: staffName,
          profiles: { full_name: staffName },
          eod_notes: attNotes || 'Manual EOD Entry'
        };
        setAttendance(prev => [newRecord, ...prev]);
        playSuccess();
        toast.success('Attendance Recorded', 'Attendance and EOD work notes saved.');
      } else {
        throw error || new Error('Failed to record attendance');
      }
    } catch (err) {
      console.error(err);
      playError();
      toast.error('Save Failed', 'Could not record attendance.');
    }

    setIsModalOpen(false);
    setAttNotes('');
  };

  const handleOpenEditNotes = (record: any) => {
    setEditingRecord(record);
    setEditNotesValue(record.notes || record.checkout_notes || record.remarks || '');
    setIsEditNotesModalOpen(true);
  };

  const handleSaveUpdatedNotes = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRecord) return;

    try {
      const { error } = await supabase
        .from('attendance_records')
        .update({
          notes: editNotesValue,
          checkout_notes: editNotesValue,
          remarks: editNotesValue
        })
        .eq('id', editingRecord.id);

      if (error) throw error;

      setAttendance(prev => prev.map(a => a.id === editingRecord.id ? {
        ...a,
        notes: editNotesValue,
        checkout_notes: editNotesValue,
        remarks: editNotesValue,
        eod_notes: editNotesValue || 'Standard Duty Log'
      } : a));

      playSuccess();
      toast.success('Work Notes Updated', 'Notes successfully synchronized with GM portal.');
      setIsEditNotesModalOpen(false);
      setEditingRecord(null);
    } catch (err) {
      console.error('Error updating notes:', err);
      playError();
      toast.error('Update Failed', 'Could not save updated work notes.');
    }
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
      cell: (info: any) => {
        const row = info.row.original;
        const noteVal = info.getValue() || 'Standard Duty Log';
        return (
          <div className="flex items-center justify-between gap-2 max-w-xs group">
            <div className="flex items-center gap-1.5 truncate">
              <FileText size={14} className="text-neu-muted shrink-0" />
              <span className="text-xs text-neu-fg truncate font-medium" title={noteVal}>
                {noteVal}
              </span>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleOpenEditNotes(row);
              }}
              className="p-1 rounded bg-neu-bg shadow-neu-small hover:text-neu-accent text-neu-muted transition-all cursor-pointer opacity-70 hover:opacity-100"
              title="Edit Work Notes"
            >
              <Edit2 size={12} />
            </button>
          </div>
        );
      }
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
          <h2 className="text-xl font-display font-bold text-neu-fg">Attendance Tracking (Real-Time Synced)</h2>
          <p className="text-neu-muted text-sm">Monitor staff check-ins, attendance logs, and live EOD work notes ({filteredAttendance.length} records shown from {attendance.length} total database logs).</p>
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
          <NeuSelect 
            label="Select Staff Member (Profiles)" 
            options={employees.map(e => ({ 
              label: `${e.full_name || 'Staff Member'} (${e.role || 'Staff'})`, 
              value: e.id 
            }))} 
            value={selectedStaffId}
            onChange={(e) => setSelectedStaffId(e.target.value)}
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

      {/* Edit Notes Modal */}
      <NeuModal isOpen={isEditNotesModalOpen} onClose={() => setIsEditNotesModalOpen(false)} title="Edit EOD Work Notes">
        <form onSubmit={handleSaveUpdatedNotes} className="space-y-4">
          <div>
            <p className="text-xs text-neu-muted font-medium mb-1">
              Staff Member: <strong className="text-neu-fg">{editingRecord?.employee_name}</strong> | Date: <strong className="text-neu-fg">{editingRecord?.date}</strong>
            </p>
          </div>
          <NeuInput 
            label="Updated EOD Remarks / Work Notes" 
            placeholder="Enter updated work summary notes..." 
            value={editNotesValue} 
            onChange={(e) => setEditNotesValue(e.target.value)} 
            required
          />
          <div className="flex justify-end gap-3 pt-4">
            <NeuButton type="button" variant="secondary" onClick={() => setIsEditNotesModalOpen(false)}>
              Cancel
            </NeuButton>
            <NeuButton type="submit">
              Save Work Notes Update
            </NeuButton>
          </div>
        </form>
      </NeuModal>
    </div>
  );
}
