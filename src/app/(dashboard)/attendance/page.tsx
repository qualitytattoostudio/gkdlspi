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
import { Search, Clock, Download, Plus, Filter, UserCheck, Calendar, CheckCircle2, FileText, Edit2, Timer, Send } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { MONTH_FILTER_OPTIONS, matchesTimeFilter } from '@/lib/utils';
import { toast } from '@/store/toastStore';
import { playSuccess, playError } from '@/lib/audio';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import Papa from 'papaparse';

export default function AttendancePage() {
  const supabase = createClient();
  const [attendance, setAttendance] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [profilesMap, setProfilesMap] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [timeFilter, setTimeFilter] = useState('all');

  // Target WhatsApp Number
  const [whatsappNumber, setWhatsappNumber] = useState('9597513372');

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

  const calculateWorkingHours = (record: any): { hoursStr: string; totalMins: number } => {
    if (record.total_work_minutes && Number(record.total_work_minutes) > 0) {
      const mins = Number(record.total_work_minutes);
      const hrs = (mins / 60).toFixed(1);
      return { hoursStr: `${hrs} hrs`, totalMins: mins };
    }

    if (record.check_in_time && record.check_out_time) {
      try {
        const inDt = new Date(record.check_in_time);
        const outDt = new Date(record.check_out_time);
        const diffMins = Math.max(0, Math.round((outDt.getTime() - inDt.getTime()) / (1000 * 60)));
        const hrs = (diffMins / 60).toFixed(1);
        return { hoursStr: `${hrs} hrs`, totalMins: diffMins };
      } catch {
        return { hoursStr: '0.0 hrs', totalMins: 0 };
      }
    }

    if (record.check_in_time && !record.check_out_time && (record.status === 'present' || !record.status)) {
      try {
        const inDt = new Date(record.check_in_time);
        const now = new Date();
        if (inDt.toDateString() === now.toDateString()) {
          const diffMins = Math.max(0, Math.round((now.getTime() - inDt.getTime()) / (1000 * 60)));
          const hrs = (diffMins / 60).toFixed(1);
          return { hoursStr: `${hrs} hrs (Active)`, totalMins: diffMins };
        }
      } catch {}
    }

    if (record.status === 'present') {
      return { hoursStr: '8.0 hrs', totalMins: 480 };
    }

    return { hoursStr: '0.0 hrs', totalMins: 0 };
  };

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
        const { hoursStr, totalMins } = calculateWorkingHours(a);
        return {
          ...a,
          employee_name: resolvedName,
          profiles: { full_name: resolvedName },
          eod_notes: noteText,
          work_hours: hoursStr,
          work_mins: totalMins
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

    // Supabase Realtime Subscription for instant notes and logs update in GM portal
    const attChannel = supabase
      .channel('realtime_attendance_notes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance_records' }, (payload) => {
        if (payload.eventType === 'UPDATE') {
          setAttendance(prev => prev.map(a => {
            if (a.id === payload.new.id) {
              const updatedNotes = payload.new.notes || payload.new.checkout_notes || payload.new.remarks || a.eod_notes;
              const { hoursStr, totalMins } = calculateWorkingHours({ ...a, ...payload.new });
              return {
                ...a,
                ...payload.new,
                notes: updatedNotes,
                checkout_notes: updatedNotes,
                remarks: updatedNotes,
                eod_notes: updatedNotes,
                work_hours: hoursStr,
                work_mins: totalMins
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
        const { hoursStr, totalMins } = calculateWorkingHours(data[0]);
        const newRecord = {
          ...data[0],
          employee_name: staffName,
          profiles: { full_name: staffName },
          eod_notes: attNotes || 'Manual EOD Entry',
          work_hours: hoursStr,
          work_mins: totalMins
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

  const totalCalculatedHours = (filteredAttendance.reduce((sum, a) => sum + (Number(a.work_mins) || 0), 0) / 60).toFixed(1);

  const exportCSV = () => {
    if (filteredAttendance.length === 0) {
      toast.warning('No Records', 'There are no attendance records to export.');
      return;
    }
    const csvData = filteredAttendance.map(a => ({
      'Employee Name': a.employee_name || a.profiles?.full_name || 'Staff Member',
      'Date': a.date ? format(new Date(a.date), 'yyyy-MM-dd') : 'N/A',
      'Check In Time': a.check_in_time ? format(new Date(a.check_in_time), 'hh:mm:ss a') : 'N/A',
      'Check Out Time': a.check_out_time ? format(new Date(a.check_out_time), 'hh:mm:ss a') : 'On Duty',
      'Total Working Hours': a.work_hours || '0.0 hrs',
      'Status': (a.status || 'present').toUpperCase(),
      'EOD Work Notes': a.eod_notes || 'Standard Duty Log'
    }));

    const csv = Papa.unparse(csvData);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Attendance_Report_with_Working_Hours_${timeFilter}_${format(new Date(), 'yyyy-MM-dd')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    playSuccess();
    toast.success('CSV Exported', 'Attendance report with working hours downloaded.');
  };

  const exportPDF = () => {
    if (filteredAttendance.length === 0) {
      toast.warning('No Records', 'There are no attendance records to export.');
      return;
    }
    const doc = new jsPDF('landscape');
    doc.setFontSize(14);
    doc.text('V-Syncer Executive Staff Attendance & Working Hours Report', 14, 15);
    doc.setFontSize(10);
    doc.text(`Period / Filter: ${timeFilter.toUpperCase()} | Generated: ${format(new Date(), 'yyyy-MM-dd HH:mm')} | Total Working Hours: ${totalCalculatedHours} hrs`, 14, 22);

    autoTable(doc, {
      startY: 28,
      head: [['Employee Name', 'Date', 'Check In', 'Check Out', 'Working Hours', 'Status', 'EOD Remarks / Work Notes']],
      body: filteredAttendance.map(a => [
        a.employee_name || a.profiles?.full_name || 'Staff Member',
        a.date ? format(new Date(a.date), 'MMM dd, yyyy') : 'N/A',
        a.check_in_time ? format(new Date(a.check_in_time), 'hh:mm a') : 'N/A',
        a.check_out_time ? format(new Date(a.check_out_time), 'hh:mm a') : 'Active Duty',
        a.work_hours || '0.0 hrs',
        (a.status || 'present').toUpperCase(),
        a.eod_notes || 'Standard Duty Log'
      ]),
      styles: { fontSize: 8, cellPadding: 2.5 },
      headStyles: { fillColor: [15, 76, 129] }
    });

    doc.save(`Attendance_Report_${timeFilter}_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
    playSuccess();
    toast.success('PDF Exported', 'Attendance report with working hours downloaded as PDF.');
  };

  const dispatchWhatsApp = () => {
    const text = [
      `📊 *V-SYNCER STAFF ATTENDANCE & WORKING HOURS SUMMARY*`,
      `📅 *Date:* ${format(new Date(), 'yyyy-MM-dd')}`,
      `👥 *Matching Staff Logs:* ${filteredAttendance.length}`,
      `⏱️ *Total Cumulative Work Hours:* ${totalCalculatedHours} hrs`,
      `-----------------------------------------`,
      ...filteredAttendance.slice(0, 8).map((a, i) => `${i + 1}. *${a.employee_name}* - ${a.work_hours} | Notes: ${a.eod_notes}`),
      filteredAttendance.length > 8 ? `...and ${filteredAttendance.length - 8} more entries.` : '',
      `-----------------------------------------`,
      `✅ *Verified by V-Syncer Operations Portal*`
    ].filter(Boolean).join('\n');

    const waUrl = `https://api.whatsapp.com/send?phone=91${whatsappNumber.replace(/\D/g, '')}&text=${encodeURIComponent(text)}`;
    window.open(waUrl, '_blank');
    playSuccess();
    toast.success('WhatsApp Dispatched', `Attendance summary sent to +91 ${whatsappNumber}.`);
  };

  const getStatusBadge = (st: string) => {
    let variant: BadgeVariant = 'neutral';
    if (st === 'present') variant = 'success';
    if (st === 'absent') variant = 'error';
    if (st === 'leave') variant = 'warning';
    
    return <NeuBadge variant={variant}>{(st || 'present').toUpperCase()}</NeuBadge>;
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
      header: 'Check In',
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
      header: 'Check Out',
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
      accessorKey: 'work_hours',
      header: 'Total Working Hours',
      cell: (info: any) => (
        <div className="flex items-center gap-1.5 font-bold text-emerald-600 text-xs">
          <Timer size={14} className="shrink-0 text-emerald-500" />
          <span>{info.getValue() || '0.0 hrs'}</span>
        </div>
      )
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
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map(i => <SkeletonCard key={i} className="h-28" />)}
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
          <h2 className="text-xl font-display font-bold text-neu-fg">Attendance & Working Hours Tracking</h2>
          <p className="text-neu-muted text-sm">Monitor staff check-ins, check-outs, shift working hours, and EOD work notes ({filteredAttendance.length} records shown).</p>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <button 
            onClick={dispatchWhatsApp}
            className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold text-xs flex items-center gap-1.5 shadow-neu-raised transition-all cursor-pointer"
          >
            <Send size={14} />
            Send to WhatsApp (+91 {whatsappNumber})
          </button>
          <NeuButton onClick={exportPDF} variant="secondary">
            <FileText size={16} />
            PDF Export
          </NeuButton>
          <NeuButton onClick={exportCSV} variant="secondary">
            <Download size={16} />
            CSV Export
          </NeuButton>
          <NeuButton onClick={() => setIsModalOpen(true)}>
            <Plus size={18} />
            Record Attendance
          </NeuButton>
        </div>
      </div>

      {/* KPI Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title="Total Matching Records" value={filteredAttendance.length} icon={Calendar} />
        <StatCard title="Present / Duty Verified" value={presentCount} icon={CheckCircle2} />
        <StatCard title="Absent / Leave Logs" value={absentCount} icon={Clock} />
        <StatCard title="Cumulative Work Hours" value={Math.round(Number(totalCalculatedHours))} suffix=" hrs" icon={Timer} />
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
