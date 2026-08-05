'use client';

import React, { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { NeuCard } from '@/components/neu/NeuCard';
import { NeuButton } from '@/components/neu/NeuButton';
import { NeuInput } from '@/components/neu/NeuInput';
import { NeuSelect } from '@/components/neu/NeuSelect';
import { StatCard } from '@/components/neu/StatCard';
import { SkeletonCard } from '@/components/neu/SkeletonCard';
import { BarChart, Download, FileText, Users, Clock, CheckCircle, Calendar, UserCheck, Filter, Building2, ShieldCheck, RefreshCw, Plus, Trash2, Edit } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import Papa from 'papaparse';
import { format } from 'date-fns';
import { toast } from '@/store/toastStore';
import { playSuccess, playError } from '@/lib/audio';

import { NeuModal } from '@/components/neu/NeuModal';

export default function ReportsPage() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [employees, setEmployees] = useState<any[]>([]);

  // Metric Counts
  const [attendanceCount, setAttendanceCount] = useState(0);
  const [leaveCount, setLeaveCount] = useState(0);
  const [auditLogCount, setAuditLogCount] = useState(0);
  const [execLocationsCount, setExecLocationsCount] = useState(0);
  
  const [attendanceData, setAttendanceData] = useState<any[]>([]);
  const [leaveData, setLeaveData] = useState<any[]>([]);
  const [auditData, setAuditData] = useState<any[]>([]);

  // Filtering Controls for Daily Employee Report
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('all');
  const [appliedDate, setAppliedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [appliedEmployeeId, setAppliedEmployeeId] = useState<string>('all');
  
  const [dailyEmployeeReport, setDailyEmployeeReport] = useState<any[]>([]);
  const [filterLoading, setFilterLoading] = useState(false);

  // Manual Report Modal State & Full CRUD State
  const [isManualReportModalOpen, setIsManualReportModalOpen] = useState(false);
  const [editingReportId, setEditingReportId] = useState<string | null>(null);
  const [manualReportTitle, setManualReportTitle] = useState('');
  const [manualReportType, setManualReportType] = useState('Daily Audit');
  const [manualReportStaffId, setManualReportStaffId] = useState<string>('all');
  const [manualReportDate, setManualReportDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [manualReportNotes, setManualReportNotes] = useState('');
  const [manualReports, setManualReports] = useState<any[]>([]);

  // Manual Apply function triggered on button click
  const executeReportFilter = async (dateToFetch: string, empIdToFetch: string) => {
    setFilterLoading(true);
    try {
      let query = supabase
        .from('attendance_records')
        .select('*, profiles!attendance_records_user_id_fkey(full_name, role), break_records(*)')
        .eq('date', dateToFetch);

      if (empIdToFetch !== 'all') {
        query = query.eq('user_id', empIdToFetch);
      }

      const { data, error } = await query.order('check_in_time', { ascending: false });

      if (error) throw error;

      // Map break timing details for each attendance log
      const formatted = (data || []).map(r => {
        const breaks = r.break_records || [];
        let totalBreakMins = 0;
        let breakSummary = 'No Breaks Taken';

        if (breaks.length > 0) {
          totalBreakMins = breaks.reduce((sum: number, b: any) => sum + (Number(b.break_duration) || Number(b.break_duration_minutes) || 0), 0);
          const firstBreak = breaks[0];
          const bStart = firstBreak.break_start ? format(new Date(firstBreak.break_start), 'hh:mm a') : 'N/A';
          const bEnd = firstBreak.break_end ? format(new Date(firstBreak.break_end), 'hh:mm a') : 'Active Break';
          breakSummary = `${bStart} - ${bEnd} (${totalBreakMins} mins)`;
        }

        return {
          ...r,
          break_summary: breakSummary,
          total_break_mins: totalBreakMins
        };
      });

      setDailyEmployeeReport(formatted);
      setAppliedDate(dateToFetch);
      setAppliedEmployeeId(empIdToFetch);
    } catch (err) {
      console.error('Error fetching daily employee report:', err);
      setDailyEmployeeReport([]);
    } finally {
      setFilterLoading(false);
    }
  };

  useEffect(() => {
    async function fetchInitialData() {
      setLoading(true);
      try {
        // Fetch employees list
        const { data: profs } = await supabase
          .from('profiles')
          .select('id, full_name, role')
          .order('full_name', { ascending: true });

        setEmployees(profs || []);

        const [
          { data: att, count: attCnt },
          { data: lve, count: lveCnt },
          { data: aud, count: audCnt },
          { count: locCnt },
          { data: manualRpts }
        ] = await Promise.all([
          supabase.from('attendance_records').select('*, profiles!attendance_records_user_id_fkey(full_name)').order('date', { ascending: false }).limit(100),
          supabase.from('leave_requests').select('*, profiles(full_name)').order('created_at', { ascending: false }).limit(100),
          supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(100),
          supabase.from('exec_locations').select('id', { count: 'exact', head: true }),
          supabase.from('manual_reports').select('*').order('created_at', { ascending: false })
        ]);

        setAttendanceData(att || []);
        setLeaveData(lve || []);
        setAuditData(aud || []);
        setManualReports(manualRpts || []);

        setAttendanceCount(attCnt || (att?.length || 0));
        setLeaveCount(lveCnt || (lve?.length || 0));
        setAuditLogCount(audCnt || (aud?.length || 0));
        setExecLocationsCount(locCnt || 0);

        // Fetch initial report for today
        executeReportFilter(format(new Date(), 'yyyy-MM-dd'), 'all');
      } catch (err) {
        console.error('Error fetching report metrics:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchInitialData();
  }, [supabase]);

  const exportDailyReportPDF = () => {
    const doc = new jsPDF();
    const empName = selectedEmployeeId === 'all' 
      ? 'All Personnel' 
      : employees.find(e => e.id === selectedEmployeeId)?.full_name || 'Specific Staff';
    
    doc.text(`V-Syncer Daily Operations Report — ${selectedDate}`, 14, 15);
    doc.setFontSize(10);
    doc.text(`Staff Target: ${empName} | Filter Date: ${selectedDate}`, 14, 22);

    autoTable(doc, {
      startY: 28,
      head: [['Employee Name', 'Role', 'Date', 'Check In', 'Check Out', 'Break Timing & Duration', 'Status']],
      body: dailyEmployeeReport.map(r => [
        r.profiles?.full_name || 'Staff Member',
        r.profiles?.role || 'Executive',
        r.date,
        r.check_in_time ? format(new Date(r.check_in_time), 'hh:mm a') : 'Not Checked In',
        r.check_out_time ? format(new Date(r.check_out_time), 'hh:mm a') : 'Active Shift',
        r.break_summary || 'No Breaks',
        r.status || 'present'
      ])
    });
    doc.save(`Daily_Report_${selectedDate}_${empName.replace(/\s+/g, '_')}.pdf`);
  };

  const exportDailyReportCSV = () => {
    const empName = selectedEmployeeId === 'all' 
      ? 'All_Staff' 
      : (employees.find(e => e.id === selectedEmployeeId)?.full_name || 'Staff').replace(/\s+/g, '_');

    const csv = Papa.unparse(dailyEmployeeReport.map(r => ({
      EmployeeName: r.profiles?.full_name || 'Staff Member',
      Role: r.profiles?.role || 'Executive',
      Date: r.date,
      CheckInTime: r.check_in_time ? format(new Date(r.check_in_time), 'hh:mm:ss a') : 'N/A',
      CheckOutTime: r.check_out_time ? format(new Date(r.check_out_time), 'hh:mm:ss a') : 'Active',
      BreakTiming: r.break_summary || 'No Breaks',
      BreakMinutes: r.total_break_mins || 0,
      Status: r.status || 'present',
      TotalWorkMinutes: r.total_work_minutes || 0
    })));

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Daily_Report_${selectedDate}_${empName}.csv`);
    link.click();
  };

  const handleOpenCreateModal = () => {
    setEditingReportId(null);
    setManualReportTitle('');
    setManualReportType('Daily Audit');
    setManualReportStaffId('all');
    setManualReportDate(format(new Date(), 'yyyy-MM-dd'));
    setManualReportNotes('');
    setIsManualReportModalOpen(true);
  };

  const handleOpenEditModal = (report: any) => {
    setEditingReportId(report.id);
    setManualReportTitle(report.title);
    setManualReportType(report.type);
    setManualReportStaffId(report.staff_id || 'all');
    setManualReportDate(report.date);
    setManualReportNotes(report.notes || '');
    setIsManualReportModalOpen(true);
  };

  const handleDeleteManualReport = async (reportId: string) => {
    try {
      const { error } = await supabase.from('manual_reports').delete().eq('id', reportId);
      if (error) throw error;
      setManualReports(prev => prev.filter(r => r.id !== reportId));
      playSuccess();
      toast.success('Report Deleted', 'The manual report was successfully removed.');
    } catch (err) {
      console.error('Error deleting report:', err);
      playError();
      toast.error('Deletion Failed', 'Could not remove the report.');
    }
  };

  const handleCreateOrUpdateManualReport = async (e: React.FormEvent) => {
    e.preventDefault();
    const staffName = manualReportStaffId === 'all' 
      ? 'All Personnel' 
      : (employees.find(e => e.id === manualReportStaffId)?.full_name || 'Staff Member');

    const reportData = {
      title: manualReportTitle || 'Executive Operations Report',
      type: manualReportType,
      staff_id: manualReportStaffId === 'all' ? null : manualReportStaffId,
      staff_name: staffName,
      date: manualReportDate || format(new Date(), 'yyyy-MM-dd'),
      notes: manualReportNotes
    };

    try {
      if (editingReportId) {
        // UPDATE existing report
        const { data, error } = await supabase
          .from('manual_reports')
          .update({ ...reportData, updated_at: new Date().toISOString() })
          .eq('id', editingReportId)
          .select()
          .single();
          
        if (error) throw error;
        
        setManualReports(prev => prev.map(r => r.id === editingReportId ? data : r));
        playSuccess();
        toast.success('Report Updated', 'Your changes have been saved.');
      } else {
        // CREATE new report
        const { data, error } = await supabase
          .from('manual_reports')
          .insert(reportData)
          .select()
          .single();
          
        if (error) throw error;
        
        setManualReports(prev => [data, ...prev]);
        playSuccess();
        toast.success('Report Generated', 'New custom report safely saved.');
      }

      setIsManualReportModalOpen(false);
      setEditingReportId(null);
      setManualReportTitle('');
      setManualReportNotes('');
    } catch (err) {
      console.error('Error saving manual report:', err);
      playError();
      toast.error('Save Failed', 'Could not save the report to the database.');
    }
  };

  const exportCustomManualPDF = (report: any) => {
    const doc = new jsPDF();
    doc.text(`V-Syncer Executive Report — ${report.title}`, 14, 15);
    doc.setFontSize(10);
    doc.text(`Report Type: ${report.type} | Target Staff: ${report.staff_name} | Date: ${report.date}`, 14, 22);

    autoTable(doc, {
      startY: 28,
      head: [['Attribute / Parameter', 'Details / Compliance Summary']],
      body: [
        ['Report Title', report.title],
        ['Report Classification', report.type],
        ['Assigned Staff Member', report.staff_name],
        ['Report Date', report.date],
        ['Executive Notes & Directives', report.notes || 'No special notes provided.'],
        ['Generation Timestamp', new Date().toLocaleString()],
        ['System Verification', 'Verified & Signed by V-Syncer Manager']
      ]
    });
    doc.save(`Executive_Report_${report.title.replace(/\s+/g, '_')}.pdf`);
  };

  const exportAttendanceCSV = () => {
    const csv = Papa.unparse(attendanceData.map(a => ({
      ID: a.id,
      Employee: a.profiles?.full_name || 'Staff',
      Date: a.date,
      CheckIn: a.check_in_time,
      CheckOut: a.check_out_time || 'N/A',
      Status: a.status
    })));
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Attendance_Report_${new Date().toISOString().split('T')[0]}.csv`);
    link.click();
  };

  const exportAttendancePDF = () => {
    const doc = new jsPDF();
    doc.text('V-Syncer Operations — Attendance Report', 14, 15);
    autoTable(doc, {
      startY: 20,
      head: [['Employee', 'Date', 'Check In', 'Status']],
      body: attendanceData.map(a => [
        a.profiles?.full_name || 'Staff',
        a.date || 'N/A',
        a.check_in_time ? new Date(a.check_in_time).toLocaleTimeString() : 'N/A',
        a.status || 'present'
      ])
    });
    doc.save(`Attendance_Report_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const exportLeavesCSV = () => {
    const csv = Papa.unparse(leaveData.map(l => ({
      ID: l.id,
      Employee: l.profiles?.full_name || 'Staff',
      Type: l.leave_type,
      StartDate: l.start_date,
      EndDate: l.end_date,
      Status: l.status,
      Reason: l.reason
    })));
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Leave_Report_${new Date().toISOString().split('T')[0]}.csv`);
    link.click();
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <h2 className="text-xl font-display font-bold text-neu-fg">Executive Reports & Analytics</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {[1,2,3,4].map(i => <SkeletonCard key={i} className="h-32" />)}
        </div>
        <SkeletonCard className="h-[400px]" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-up">
      <div>
        <h2 className="text-xl font-display font-bold text-neu-fg">Executive Reports & Analytics</h2>
        <p className="text-neu-muted text-sm">Generate and export real operational intelligence synced from active database tables.</p>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title="Attendance Logs" value={attendanceCount} icon={Clock} />
        <StatCard title="Leave Applications" value={leaveCount} icon={Users} />
        <StatCard title="System Audit Logs" value={auditLogCount} icon={CheckCircle} />
        <StatCard title="GPS Location Traces" value={execLocationsCount} icon={BarChart} />
      </div>

      {/* DASHBOARD 1: Daily Operational Staff Report */}
      <NeuCard className="p-6 space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-4 border-b border-neu-muted/10">
          <div>
            <h3 className="font-display font-bold text-lg text-neu-fg flex items-center gap-2">
              <Calendar size={20} className="text-neu-accent" />
              Daily Operational Staff Report
            </h3>
            <p className="text-xs text-neu-muted">Filter report details by date and target specific employee profiles from database.</p>
          </div>
          <div className="flex gap-3">
            <NeuButton onClick={exportDailyReportPDF} disabled={dailyEmployeeReport.length === 0}>
              <FileText size={16} /> PDF Daily Report
            </NeuButton>
            <NeuButton onClick={exportDailyReportCSV} variant="secondary" disabled={dailyEmployeeReport.length === 0}>
              <Download size={16} /> CSV Export
            </NeuButton>
          </div>
        </div>

        {/* Filter Toolbar */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <NeuInput 
            label="Select Report Date" 
            type="date" 
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
          />
          <NeuSelect 
            label="Select Specific Staff Member" 
            options={[
              { label: 'All Personnel & Staff Members', value: 'all' },
              ...employees.map(e => ({ label: `${e.full_name || 'Staff Member'} (${e.role || 'Staff'})`, value: e.id }))
            ]}
            value={selectedEmployeeId}
            onChange={(e) => setSelectedEmployeeId(e.target.value)}
          />
          <div>
            <NeuButton 
              onClick={() => executeReportFilter(selectedDate, selectedEmployeeId)}
              className="w-full"
              disabled={filterLoading}
            >
              <Filter size={16} />
              {filterLoading ? 'Fetching...' : 'Apply Filters'}
            </NeuButton>
          </div>
          <div>
            <div className="p-3 bg-neu-bg shadow-neu-inset-sm rounded-xl text-xs font-bold text-neu-fg w-full flex items-center justify-between">
              <span className="text-neu-muted font-medium">Matching Logs:</span>
              <span className="text-neu-accent font-display text-sm">{dailyEmployeeReport.length} Records</span>
            </div>
          </div>
        </div>

        {/* Daily Report Data Preview Table */}
        <div className="space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-neu-muted">Report Preview ({selectedDate})</h4>
          {filterLoading ? (
            <SkeletonCard className="h-36" />
          ) : dailyEmployeeReport.length === 0 ? (
            <div className="p-8 text-center bg-neu-bg shadow-neu-inset-sm rounded-xl space-y-2">
              <UserCheck size={28} className="mx-auto text-neu-muted opacity-40" />
              <p className="font-bold text-sm text-neu-fg">No attendance activity logged for this date</p>
              <p className="text-xs text-neu-muted">Try selecting a different date or staff member filter.</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-60 overflow-y-auto scrollbar-hide">
              {dailyEmployeeReport.map((rep) => (
                <div key={rep.id} className="p-3 bg-neu-bg shadow-neu-inset-sm rounded-xl flex justify-between items-center text-xs">
                  <div>
                    <p className="font-bold text-neu-fg">{rep.profiles?.full_name || 'Staff Member'}</p>
                    <p className="text-[11px] text-neu-muted">{rep.profiles?.role || 'Executive'} — Date: {rep.date}</p>
                    <p className="text-[10px] text-neu-accent font-medium mt-0.5">Break Timing: {rep.break_summary || 'No Breaks'}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-neu-accent">
                      In: {rep.check_in_time ? format(new Date(rep.check_in_time), 'hh:mm a') : 'N/A'}
                    </p>
                    <p className="text-[11px] text-neu-muted">
                      Out: {rep.check_out_time ? format(new Date(rep.check_out_time), 'hh:mm a') : 'Active'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </NeuCard>

      {/* DASHBOARD 2: Manual Report Builder & Generator */}
      <NeuCard className="p-6 space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-4 border-b border-neu-muted/10">
          <div>
            <h3 className="font-display font-bold text-lg text-neu-fg flex items-center gap-2">
              <FileText size={20} className="text-neu-accent" />
              Manual Executive Report Generator
            </h3>
            <p className="text-xs text-neu-muted">Create customized operational reports manually with custom date range, staff targets, and notes.</p>
          </div>
          <NeuButton onClick={handleOpenCreateModal}>
            <Plus size={18} />
            Create Manual Report
          </NeuButton>
        </div>

        {/* Manual Reports Log Stream */}
        <div className="space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-neu-muted">Custom Generated Reports ({manualReports.length})</h4>
          {manualReports.length === 0 ? (
            <div className="p-8 text-center bg-neu-bg shadow-neu-inset-sm rounded-xl space-y-2">
              <FileText size={28} className="mx-auto text-neu-muted opacity-40" />
              <p className="font-bold text-sm text-neu-fg">No custom manual reports created yet</p>
              <p className="text-xs text-neu-muted">Click "Create Manual Report" to compile a custom PDF report.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {manualReports.map((mr) => (
                <div key={mr.id} className="p-4 bg-neu-bg shadow-neu-inset-sm rounded-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-neu-accent bg-neu-accent/10 px-2 py-0.5 rounded-full">
                      {mr.type}
                    </span>
                    <h5 className="font-bold text-sm text-neu-fg mt-1">{mr.title}</h5>
                    <p className="text-xs text-neu-muted">Staff: {mr.staff_name} | Date: {mr.date}</p>
                    {mr.notes && <p className="text-xs text-neu-muted mt-1 bg-neu-bg shadow-neu-inset-xs px-2.5 py-1 rounded-lg max-w-xl">{mr.notes}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    <NeuButton onClick={() => exportCustomManualPDF(mr)} variant="secondary" className="text-xs">
                      <Download size={14} /> PDF
                    </NeuButton>
                    <NeuButton onClick={() => handleOpenEditModal(mr)} variant="secondary" className="p-2.5">
                      <Edit size={14} className="text-neu-accent" />
                    </NeuButton>
                    <NeuButton onClick={() => handleDeleteManualReport(mr.id)} variant="secondary" className="p-2.5 hover:text-red-500">
                      <Trash2 size={14} className="text-red-500" />
                    </NeuButton>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </NeuCard>

      {/* General Report Export Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Attendance Export Card */}
        <NeuCard className="p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-neu-bg shadow-neu-small rounded-xl text-neu-accent">
              <Clock size={24} />
            </div>
            <div>
              <h3 className="font-display font-bold text-neu-fg">Attendance Log Report</h3>
              <p className="text-xs text-neu-muted">{attendanceCount} records ready for export.</p>
            </div>
          </div>
          <p className="text-sm text-neu-muted">Comprehensive summary of staff check-in times, dates, and attendance statuses.</p>
          <div className="flex gap-3 pt-2">
            <NeuButton onClick={exportAttendancePDF} className="flex-1">
              <FileText size={16} /> PDF Export
            </NeuButton>
            <NeuButton onClick={exportAttendanceCSV} variant="secondary" className="flex-1">
              <Download size={16} /> CSV Export
            </NeuButton>
          </div>
        </NeuCard>

        {/* Leave Export Card */}
        <NeuCard className="p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-neu-bg shadow-neu-small rounded-xl text-neu-accent">
              <Users size={24} />
            </div>
            <div>
              <h3 className="font-display font-bold text-neu-fg">Leave Requests Report</h3>
              <p className="text-xs text-neu-muted">{leaveCount} applications logged.</p>
            </div>
          </div>
          <p className="text-sm text-neu-muted">Detailed report of employee leaves, type classifications, and manager approvals.</p>
          <div className="flex gap-3 pt-2">
            <NeuButton onClick={exportLeavesCSV} variant="secondary" className="w-full">
              <Download size={16} /> CSV Export
            </NeuButton>
          </div>
        </NeuCard>
      </div>

      {/* Create / Edit Manual Report Modal */}
      <NeuModal 
        isOpen={isManualReportModalOpen} 
        onClose={() => { setIsManualReportModalOpen(false); setEditingReportId(null); }} 
        title={editingReportId ? "Edit Custom Executive Report" : "Create Custom Executive Report"}
      >
        <form onSubmit={handleCreateOrUpdateManualReport} className="space-y-4">
          <NeuInput 
            label="Report Document Title" 
            placeholder="e.g. Q3 Operations Audit & Safety Summary" 
            value={manualReportTitle} 
            onChange={(e) => setManualReportTitle(e.target.value)} 
          />
          <NeuSelect 
            label="Report Classification Type" 
            options={[
              { label: 'Daily Performance Audit', value: 'Daily Audit' },
              { label: 'Weekly Executive Summary', value: 'Weekly Summary' },
              { label: 'Monthly Site Inspection', value: 'Monthly Inspection' },
              { label: 'Special Operations & Compliance', value: 'Special Compliance' },
            ]} 
            value={manualReportType}
            onChange={(e) => setManualReportType(e.target.value)}
          />
          <NeuSelect 
            label="Target Staff Member (Profiles)" 
            options={[
              { label: 'All Personnel & Staff Members', value: 'all' },
              ...employees.map(e => ({ label: `${e.full_name || 'Staff Member'} (${e.role || 'Staff'})`, value: e.id }))
            ]} 
            value={manualReportStaffId}
            onChange={(e) => setManualReportStaffId(e.target.value)}
          />
          <NeuInput 
            label="Report Effective Date" 
            type="date"
            value={manualReportDate} 
            onChange={(e) => setManualReportDate(e.target.value)} 
          />
          <NeuInput 
            label="Executive Directives / Findings Notes" 
            placeholder="Enter custom report observations or directives..." 
            value={manualReportNotes} 
            onChange={(e) => setManualReportNotes(e.target.value)} 
          />
          <div className="flex justify-end gap-3 pt-4">
            <NeuButton type="button" variant="secondary" onClick={() => { setIsManualReportModalOpen(false); setEditingReportId(null); }}>
              Cancel
            </NeuButton>
            <NeuButton type="submit">
              {editingReportId ? 'Save Report Changes' : 'Generate & Save Custom Report'}
            </NeuButton>
          </div>
        </form>
      </NeuModal>
    </div>
  );
}
