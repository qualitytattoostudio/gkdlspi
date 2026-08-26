'use client';

import React, { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { NeuCard } from '@/components/neu/NeuCard';
import { NeuButton } from '@/components/neu/NeuButton';
import { NeuInput } from '@/components/neu/NeuInput';
import { NeuSelect } from '@/components/neu/NeuSelect';
import { StatCard } from '@/components/neu/StatCard';
import { SkeletonCard } from '@/components/neu/SkeletonCard';
import { BarChart, Download, FileText, Users, Clock, CheckCircle, Calendar, UserCheck, Filter, CalendarRange, Plus, Trash2, Edit, CheckCircle2, MessageSquare, Send, ShieldCheck } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import Papa from 'papaparse';
import { format, subDays, addDays, parseISO } from 'date-fns';
import { toast } from '@/store/toastStore';
import { playSuccess, playError } from '@/lib/audio';
import { NeuModal } from '@/components/neu/NeuModal';

export default function ReportsPage() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [employees, setEmployees] = useState<any[]>([]);

  // Target WhatsApp Number
  const [whatsappNumber, setWhatsappNumber] = useState('9597513372');

  // Metric Counts
  const [attendanceCount, setAttendanceCount] = useState(0);
  const [leaveCount, setLeaveCount] = useState(0);
  const [auditLogCount, setAuditLogCount] = useState(0);
  const [execLocationsCount, setExecLocationsCount] = useState(0);
  
  const [attendanceData, setAttendanceData] = useState<any[]>([]);
  const [leaveData, setLeaveData] = useState<any[]>([]);
  const [auditData, setAuditData] = useState<any[]>([]);

  // Filtering Controls for Daily Employee & EOD Report
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('all');
  const [dailyEmployeeReport, setDailyEmployeeReport] = useState<any[]>([]);
  const [dailyFilterLoading, setDailyFilterLoading] = useState(false);

  // Filtering Controls for Weekly Operational Staff Report
  const [weeklyStartDate, setWeeklyStartDate] = useState(format(subDays(new Date(), 6), 'yyyy-MM-dd'));
  const [weeklyEmployeeId, setWeeklyEmployeeId] = useState<string>('all');
  const [weeklyEmployeeReport, setWeeklyEmployeeReport] = useState<any[]>([]);
  const [weeklyFilterLoading, setWeeklyFilterLoading] = useState(false);

  // Manual Report Modal State & Full CRUD State
  const [isManualReportModalOpen, setIsManualReportModalOpen] = useState(false);
  const [editingReportId, setEditingReportId] = useState<string | null>(null);
  const [manualReportTitle, setManualReportTitle] = useState('');
  const [manualReportType, setManualReportType] = useState('Daily Audit');
  const [manualReportStaffId, setManualReportStaffId] = useState<string>('all');
  const [manualReportDate, setManualReportDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [manualReportNotes, setManualReportNotes] = useState('');
  const [manualReports, setManualReports] = useState<any[]>([]);

  // Direct Auto-Dispatch to WhatsApp without confirmation dialog
  const transferReportToWhatsApp = (targetPhone: string, title: string, summaryLines: string[], doc?: any) => {
    // 1. Auto-save PDF directly to disk
    if (doc) {
      doc.save(`${title.replace(/\s+/g, '_')}.pdf`);
    }

    const cleanNum = targetPhone.replace(/\D/g, '');
    const phoneWithCountry = cleanNum.startsWith('91') ? cleanNum : `91${cleanNum}`;

    const text = [
      `📊 *V-SYNCER EXECUTIVE OPERATIONS & ATTENDANCE REPORT*`,
      `📄 *Document:* ${title}`,
      `📅 *Date:* ${format(new Date(), 'yyyy-MM-dd HH:mm')}`,
      `-----------------------------------------`,
      ...summaryLines,
      `-----------------------------------------`,
      `✅ *Verified by V-Syncer Manager Portal*`,
      `📎 *PDF Report Attached / Downloaded to Device*`
    ].join('\n');

    // 2. Open WhatsApp Web or Native App directly
    const isMobile = typeof window !== 'undefined' && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    const waUrl = isMobile 
      ? `whatsapp://send?phone=${phoneWithCountry}&text=${encodeURIComponent(text)}`
      : `https://web.whatsapp.com/send?phone=${phoneWithCountry}&text=${encodeURIComponent(text)}`;

    const win = window.open(waUrl, '_blank');
    if (!win || isMobile) {
      window.location.href = `https://api.whatsapp.com/send?phone=${phoneWithCountry}&text=${encodeURIComponent(text)}`;
    }
    
    playSuccess();
    toast.success('Dispatched to WhatsApp', `Report transferred directly to +91 ${cleanNum}.`);
  };

  // Fetch Daily Report & EOD Notes
  const executeDailyReportFilter = async (dateToFetch: string, empIdToFetch: string) => {
    setDailyFilterLoading(true);
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

      // Map break timing & EOD notes for each attendance log
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

        const eodNotes = r.notes || r.checkout_notes || r.remarks || 'Standard Shift Completed';

        return {
          ...r,
          break_summary: breakSummary,
          total_break_mins: totalBreakMins,
          eod_notes: eodNotes
        };
      });

      setDailyEmployeeReport(formatted);
    } catch (err) {
      console.error('Error fetching daily employee report:', err);
      setDailyEmployeeReport([]);
    } finally {
      setDailyFilterLoading(false);
    }
  };

  // Fetch Weekly Operational Staff Report
  const executeWeeklyReportFilter = async (startDateStr: string, empIdToFetch: string) => {
    setWeeklyFilterLoading(true);
    try {
      const startDt = parseISO(startDateStr);
      const endDt = addDays(startDt, 6);
      const endDateStr = format(endDt, 'yyyy-MM-dd');

      let query = supabase
        .from('attendance_records')
        .select('*, profiles!attendance_records_user_id_fkey(full_name, role), break_records(*)')
        .gte('date', startDateStr)
        .lte('date', endDateStr);

      if (empIdToFetch !== 'all') {
        query = query.eq('user_id', empIdToFetch);
      }

      const { data, error } = await query.order('date', { ascending: false });
      if (error) throw error;

      // Group records by Employee
      const empGroupMap = new Map<string, any>();

      (data || []).forEach(r => {
        const userId = r.user_id || 'unknown';
        const empName = r.profiles?.full_name || 'Staff Member';
        const empRole = r.profiles?.role || 'Executive';
        const eodNote = r.notes || r.checkout_notes || r.remarks || '';
        const workMins = Number(r.total_work_minutes) || 0;

        const breaks = r.break_records || [];
        const breakMins = breaks.reduce((sum: number, b: any) => sum + (Number(b.break_duration) || Number(b.break_duration_minutes) || 0), 0);

        if (!empGroupMap.has(userId)) {
          empGroupMap.set(userId, {
            user_id: userId,
            employee_name: empName,
            role: empRole,
            days_present: 0,
            total_work_mins: 0,
            total_break_mins: 0,
            eod_notes_list: []
          });
        }

        const group = empGroupMap.get(userId);
        if (r.status === 'present' || r.check_in_time) group.days_present += 1;
        group.total_work_mins += workMins;
        group.total_break_mins += breakMins;
        if (eodNote) group.eod_notes_list.push(`${r.date}: ${eodNote}`);
      });

      const weeklyFormatted = Array.from(empGroupMap.values()).map(g => ({
        ...g,
        total_work_hours: (g.total_work_mins / 60).toFixed(1),
        compiled_eod_notes: g.eod_notes_list.length > 0 ? g.eod_notes_list.join(' | ') : 'Regular Weekly Shift Logs'
      }));

      setWeeklyEmployeeReport(weeklyFormatted);
    } catch (err) {
      console.error('Error fetching weekly report:', err);
      setWeeklyEmployeeReport([]);
    } finally {
      setWeeklyFilterLoading(false);
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
          supabase.from('attendance_records').select('*, profiles!attendance_records_user_id_fkey(full_name)').order('date', { ascending: false }),
          supabase.from('leave_requests').select('*, profiles(full_name)').order('created_at', { ascending: false }),
          supabase.from('audit_logs').select('*').order('created_at', { ascending: false }),
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

        // Fetch initial daily & weekly reports
        executeDailyReportFilter(format(new Date(), 'yyyy-MM-dd'), 'all');
        executeWeeklyReportFilter(format(subDays(new Date(), 6), 'yyyy-MM-dd'), 'all');
      } catch (err) {
        console.error('Error fetching report metrics:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchInitialData();
  }, [supabase]);

  // 1. Daily Report PDF & CSV
  const buildDailyReportPDF = () => {
    const doc = new jsPDF();
    const empName = selectedEmployeeId === 'all' 
      ? 'All Personnel' 
      : employees.find(e => e.id === selectedEmployeeId)?.full_name || 'Specific Staff';
    
    doc.text(`V-Syncer Daily Operations & EOD Report — ${selectedDate}`, 14, 15);
    doc.setFontSize(10);
    doc.text(`Staff Target: ${empName} | Filter Date: ${selectedDate}`, 14, 22);

    autoTable(doc, {
      startY: 28,
      head: [['Employee Name', 'Role', 'Date', 'Check In', 'Check Out', 'Break Timing', 'EOD Remarks / Work Notes']],
      body: dailyEmployeeReport.map(r => [
        r.profiles?.full_name || 'Staff Member',
        r.profiles?.role || 'Executive',
        r.date,
        r.check_in_time ? format(new Date(r.check_in_time), 'hh:mm a') : 'Not Checked In',
        r.check_out_time ? format(new Date(r.check_out_time), 'hh:mm a') : 'Active Shift',
        r.break_summary || 'No Breaks',
        r.eod_notes || 'Standard Shift Completed'
      ])
    });
    return doc;
  };

  const exportDailyReportPDF = () => {
    const doc = buildDailyReportPDF();
    const empName = selectedEmployeeId === 'all' ? 'All_Personnel' : 'Staff';
    doc.save(`Daily_EOD_Report_${selectedDate}_${empName}.pdf`);
    playSuccess();
    toast.success('PDF Exported', 'Daily report downloaded as PDF.');
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
      EODWorkNotes: r.eod_notes || 'Standard Shift'
    })));

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Daily_EOD_Report_${selectedDate}_${empName}.csv`);
    link.click();
    playSuccess();
    toast.success('CSV Exported', 'Daily report downloaded as CSV.');
  };

  const exportDailyReportWhatsApp = () => {
    const doc = buildDailyReportPDF();
    const summaryLines = [
      `📅 *Report Date:* ${selectedDate}`,
      `👥 *Total Staff Logs:* ${dailyEmployeeReport.length} records`,
      `📝 *Latest EOD Notes:* ${dailyEmployeeReport.slice(0, 3).map(r => `${r.profiles?.full_name || 'Staff'}: ${r.eod_notes}`).join(' | ')}`
    ];
    transferReportToWhatsApp(whatsappNumber, `Daily EOD Report (${selectedDate})`, summaryLines, doc);
  };

  // 2. Weekly Report PDF & CSV
  const buildWeeklyReportPDF = () => {
    const doc = new jsPDF();
    const endDt = addDays(parseISO(weeklyStartDate), 6);
    const endDateStr = format(endDt, 'yyyy-MM-dd');
    
    doc.text(`V-Syncer Weekly Operations Report (${weeklyStartDate} to ${endDateStr})`, 14, 15);
    doc.setFontSize(10);
    doc.text(`Target Scope: All Staff | Period: 7 Days`, 14, 22);

    autoTable(doc, {
      startY: 28,
      head: [['Employee Name', 'Role', 'Days Present', 'Total Hours', 'Break Mins', 'Weekly Compiled EOD Notes']],
      body: weeklyEmployeeReport.map(w => [
        w.employee_name,
        w.role,
        `${w.days_present} / 7 Days`,
        `${w.total_work_hours} hrs`,
        `${w.total_break_mins} mins`,
        w.compiled_eod_notes
      ])
    });
    return doc;
  };

  const exportWeeklyReportPDF = () => {
    const doc = buildWeeklyReportPDF();
    const endDt = addDays(parseISO(weeklyStartDate), 6);
    doc.save(`Weekly_Report_${weeklyStartDate}_to_${format(endDt, 'yyyy-MM-dd')}.pdf`);
    playSuccess();
    toast.success('PDF Exported', 'Weekly report downloaded as PDF.');
  };

  const exportWeeklyReportCSV = () => {
    const endDt = addDays(parseISO(weeklyStartDate), 6);
    const endDateStr = format(endDt, 'yyyy-MM-dd');

    const csv = Papa.unparse(weeklyEmployeeReport.map(w => ({
      EmployeeName: w.employee_name,
      Role: w.role,
      DaysPresent: w.days_present,
      TotalWorkHours: w.total_work_hours,
      TotalBreakMinutes: w.total_break_mins,
      CompiledEODNotes: w.compiled_eod_notes
    })));

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Weekly_Report_${weeklyStartDate}_to_${endDateStr}.csv`);
    link.click();
    playSuccess();
    toast.success('CSV Exported', 'Weekly report downloaded as CSV.');
  };

  const exportWeeklyReportWhatsApp = () => {
    const doc = buildWeeklyReportPDF();
    const endDt = addDays(parseISO(weeklyStartDate), 6);
    const endDateStr = format(endDt, 'yyyy-MM-dd');

    const summaryLines = [
      `📅 *Weekly Range:* ${weeklyStartDate} to ${endDateStr}`,
      `👥 *Total Active Staff:* ${weeklyEmployeeReport.length} members`,
      `⏱️ *Total Work Hours:* ${weeklyEmployeeReport.reduce((sum, w) => sum + Number(w.total_work_hours || 0), 0).toFixed(1)} hrs`,
      `📝 *Compiled EOD Notes:* Available in attached PDF`
    ];
    transferReportToWhatsApp(whatsappNumber, `Weekly Operations Report (${weeklyStartDate})`, summaryLines, doc);
  };

  // 3. Attendance Log Report PDF & CSV
  const exportAttendancePDF = () => {
    const doc = new jsPDF();
    doc.text('V-Syncer Operations — Attendance Logs Report', 14, 15);
    doc.setFontSize(10);
    doc.text(`Generated: ${format(new Date(), 'yyyy-MM-dd HH:mm')} | Records: ${attendanceData.length}`, 14, 22);

    autoTable(doc, {
      startY: 28,
      head: [['Employee', 'Date', 'Check In', 'Check Out', 'Status']],
      body: attendanceData.map(a => [
        a.profiles?.full_name || 'Staff',
        a.date || 'N/A',
        a.check_in_time ? format(new Date(a.check_in_time), 'hh:mm a') : 'N/A',
        a.check_out_time ? format(new Date(a.check_out_time), 'hh:mm a') : 'On Duty',
        a.status || 'present'
      ])
    });
    doc.save(`Attendance_Report_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
    playSuccess();
    toast.success('PDF Exported', 'Attendance report downloaded as PDF.');
  };

  const exportAttendanceCSV = () => {
    const csv = Papa.unparse(attendanceData.map(a => ({
      ID: a.id,
      Employee: a.profiles?.full_name || 'Staff',
      Date: a.date,
      CheckIn: a.check_in_time ? format(new Date(a.check_in_time), 'hh:mm a') : 'N/A',
      CheckOut: a.check_out_time ? format(new Date(a.check_out_time), 'hh:mm a') : 'On Duty',
      Status: a.status || 'present'
    })));
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Attendance_Report_${format(new Date(), 'yyyy-MM-dd')}.csv`);
    link.click();
    playSuccess();
    toast.success('CSV Exported', 'Attendance report downloaded as CSV.');
  };

  // 4. Leave Requests Report PDF & CSV
  const exportLeavesPDF = () => {
    const doc = new jsPDF();
    doc.text('V-Syncer Operations — Leave Applications Report', 14, 15);
    doc.setFontSize(10);
    doc.text(`Generated: ${format(new Date(), 'yyyy-MM-dd HH:mm')} | Records: ${leaveData.length}`, 14, 22);

    autoTable(doc, {
      startY: 28,
      head: [['Employee', 'Leave Type', 'Start Date', 'End Date', 'Reason', 'Status']],
      body: leaveData.map(l => [
        l.profiles?.full_name || 'Staff',
        l.leave_type || 'General',
        l.start_date || 'N/A',
        l.end_date || 'N/A',
        l.reason || 'N/A',
        (l.status || 'pending').toUpperCase()
      ])
    });
    doc.save(`Leave_Applications_Report_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
    playSuccess();
    toast.success('PDF Exported', 'Leave report downloaded as PDF.');
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
    link.setAttribute('download', `Leave_Report_${format(new Date(), 'yyyy-MM-dd')}.csv`);
    link.click();
    playSuccess();
    toast.success('CSV Exported', 'Leave report downloaded as CSV.');
  };

  // 5. Audit Logs Report PDF & CSV
  const exportAuditPDF = () => {
    const doc = new jsPDF();
    doc.text('V-Syncer Security & System Audit Logs Report', 14, 15);
    doc.setFontSize(10);
    doc.text(`Generated: ${format(new Date(), 'yyyy-MM-dd HH:mm')} | Total Entries: ${auditData.length}`, 14, 22);

    autoTable(doc, {
      startY: 28,
      head: [['Timestamp', 'Action / Event', 'Table Name', 'Record ID']],
      body: auditData.map(a => [
        a.created_at ? format(new Date(a.created_at), 'yyyy-MM-dd HH:mm') : 'N/A',
        a.action || a.event_type || 'System Event',
        a.table_name || 'Global',
        a.record_id || a.id || 'N/A'
      ])
    });
    doc.save(`Audit_Logs_Report_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
    playSuccess();
    toast.success('PDF Exported', 'Audit logs downloaded as PDF.');
  };

  const exportAuditCSV = () => {
    const csv = Papa.unparse(auditData.map(a => ({
      ID: a.id,
      Timestamp: a.created_at ? format(new Date(a.created_at), 'yyyy-MM-dd HH:mm:ss') : 'N/A',
      Action: a.action || a.event_type || 'System Event',
      Table: a.table_name || 'Global',
      RecordId: a.record_id || 'N/A'
    })));
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Audit_Logs_Report_${format(new Date(), 'yyyy-MM-dd')}.csv`);
    link.click();
    playSuccess();
    toast.success('CSV Exported', 'Audit logs downloaded as CSV.');
  };

  // 6. Manual Custom Report Handlers
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
    playSuccess();
    toast.success('PDF Downloaded', 'Custom report downloaded as PDF.');
  };

  const exportCustomManualCSV = (report: any) => {
    const csv = Papa.unparse([{
      Title: report.title,
      Classification: report.type,
      StaffMember: report.staff_name,
      Date: report.date,
      Notes: report.notes || 'N/A',
      GeneratedAt: new Date().toISOString()
    }]);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Executive_Report_${report.title.replace(/\s+/g, '_')}.csv`);
    link.click();
    playSuccess();
    toast.success('CSV Downloaded', 'Custom report downloaded as CSV.');
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
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-xl font-display font-bold text-neu-fg">Executive Reports & Analytics</h2>
          <p className="text-neu-muted text-sm">Download all operational intelligence & EOD staff reports in both CSV and PDF formats.</p>
        </div>

        {/* Target WhatsApp Config Bar */}
        <div className="flex items-center gap-2 bg-neu-bg shadow-neu-raised p-2 rounded-2xl border border-emerald-500/20">
          <div className="p-2 bg-emerald-500 text-white rounded-xl">
            <MessageSquare size={16} />
          </div>
          <div>
            <span className="text-[10px] font-bold text-neu-muted uppercase tracking-wider block">Target WhatsApp Number:</span>
            <input 
              type="text" 
              value={whatsappNumber}
              onChange={(e) => setWhatsappNumber(e.target.value)}
              className="bg-transparent text-xs font-mono font-bold text-emerald-600 focus:outline-none w-28"
            />
          </div>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title="Attendance Logs" value={attendanceCount} icon={Clock} />
        <StatCard title="Leave Applications" value={leaveCount} icon={Users} />
        <StatCard title="System Audit Logs" value={auditLogCount} icon={CheckCircle} />
        <StatCard title="GPS Location Traces" value={execLocationsCount} icon={BarChart} />
      </div>

      {/* DASHBOARD 1: Daily Operational Staff & EOD Report */}
      <NeuCard className="p-6 space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-4 border-b border-neu-muted/10">
          <div>
            <h3 className="font-display font-bold text-lg text-neu-fg flex items-center gap-2">
              <Calendar size={20} className="text-neu-accent" />
              Daily Operational Staff & EOD Manager Report
            </h3>
            <p className="text-xs text-neu-muted">Staff check-ins, check-outs, break timings, and EOD work notes submitted to manager.</p>
          </div>
          <div className="flex flex-wrap gap-2.5">
            <button 
              onClick={exportDailyReportWhatsApp}
              disabled={dailyEmployeeReport.length === 0}
              className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold text-xs flex items-center gap-1.5 shadow-neu-raised transition-all disabled:opacity-40 cursor-pointer"
            >
              <Send size={14} />
              Send PDF to WhatsApp (+91 {whatsappNumber})
            </button>
            <NeuButton onClick={exportDailyReportPDF} disabled={dailyEmployeeReport.length === 0}>
              <FileText size={16} /> PDF Export
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
              onClick={() => executeDailyReportFilter(selectedDate, selectedEmployeeId)}
              className="w-full"
              disabled={dailyFilterLoading}
            >
              <Filter size={16} />
              {dailyFilterLoading ? 'Fetching...' : 'Apply Filters'}
            </NeuButton>
          </div>
          <div>
            <div className="p-3 bg-neu-bg shadow-neu-inset-sm rounded-xl text-xs font-bold text-neu-fg w-full flex items-center justify-between">
              <span className="text-neu-muted font-medium">Matching Logs:</span>
              <span className="text-neu-accent font-display text-sm">{dailyEmployeeReport.length} Records</span>
            </div>
          </div>
        </div>

        {/* Daily Report Data Preview Stream */}
        <div className="space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-neu-muted">EOD Staff Reports Stream ({selectedDate})</h4>
          {dailyFilterLoading ? (
            <SkeletonCard className="h-36" />
          ) : dailyEmployeeReport.length === 0 ? (
            <div className="p-8 text-center bg-neu-bg shadow-neu-inset-sm rounded-xl space-y-2">
              <UserCheck size={28} className="mx-auto text-neu-muted opacity-40" />
              <p className="font-bold text-sm text-neu-fg">No attendance or EOD activity logged for this date</p>
              <p className="text-xs text-neu-muted">Try selecting a different date or staff member filter.</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-72 overflow-y-auto scrollbar-hide">
              {dailyEmployeeReport.map((rep) => (
                <div key={rep.id} className="p-4 bg-neu-bg shadow-neu-inset-sm rounded-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-3 text-xs">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-neu-fg">{rep.profiles?.full_name || 'Staff Member'}</span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-neu-accent/10 text-neu-accent">
                        {rep.profiles?.role || 'Executive'}
                      </span>
                    </div>
                    <p className="text-[11px] text-neu-muted mt-0.5">Date: {rep.date} | Breaks: {rep.break_summary}</p>
                    <div className="mt-2 p-2.5 bg-neu-bg shadow-neu-inset-xs rounded-lg text-neu-fg font-medium text-xs max-w-2xl flex items-start gap-1.5">
                      <FileText size={14} className="text-neu-accent shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold text-neu-accent text-[11px] uppercase tracking-wider block">EOD Work Notes to Manager:</span>
                        <span>{rep.eod_notes}</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-bold text-neu-accent text-sm">
                      In: {rep.check_in_time ? format(new Date(rep.check_in_time), 'hh:mm a') : 'N/A'}
                    </p>
                    <p className="text-xs text-neu-muted mt-0.5">
                      Out: {rep.check_out_time ? format(new Date(rep.check_out_time), 'hh:mm a') : 'Active Shift'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </NeuCard>

      {/* DASHBOARD 2: Weekly Operational Staff Report */}
      <NeuCard className="p-6 space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-4 border-b border-neu-muted/10">
          <div>
            <h3 className="font-display font-bold text-lg text-neu-fg flex items-center gap-2">
              <CalendarRange size={20} className="text-neu-accent" />
              Weekly Operational Staff Report & Analytics
            </h3>
            <p className="text-xs text-neu-muted">7-day aggregated attendance, total work hours, break totals, and compiled EOD work notes.</p>
          </div>
          <div className="flex flex-wrap gap-2.5">
            <button 
              onClick={exportWeeklyReportWhatsApp}
              disabled={weeklyEmployeeReport.length === 0}
              className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold text-xs flex items-center gap-1.5 shadow-neu-raised transition-all disabled:opacity-40 cursor-pointer"
            >
              <Send size={14} />
              Send Weekly PDF to WhatsApp (+91 {whatsappNumber})
            </button>
            <NeuButton onClick={exportWeeklyReportPDF} disabled={weeklyEmployeeReport.length === 0}>
              <FileText size={16} /> PDF Export
            </NeuButton>
            <NeuButton onClick={exportWeeklyReportCSV} variant="secondary" disabled={weeklyEmployeeReport.length === 0}>
              <Download size={16} /> CSV Export
            </NeuButton>
          </div>
        </div>

        {/* Weekly Filter Toolbar */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <NeuInput 
            label="Week Start Date (7 Days)" 
            type="date" 
            value={weeklyStartDate}
            onChange={(e) => setWeeklyStartDate(e.target.value)}
          />
          <NeuSelect 
            label="Target Staff Scope" 
            options={[
              { label: 'All Personnel & Staff Members', value: 'all' },
              ...employees.map(e => ({ label: `${e.full_name || 'Staff Member'} (${e.role || 'Staff'})`, value: e.id }))
            ]}
            value={weeklyEmployeeId}
            onChange={(e) => setWeeklyEmployeeId(e.target.value)}
          />
          <div>
            <NeuButton 
              onClick={() => executeWeeklyReportFilter(weeklyStartDate, weeklyEmployeeId)}
              className="w-full"
              disabled={weeklyFilterLoading}
            >
              <Filter size={16} />
              {weeklyFilterLoading ? 'Calculating...' : 'Generate Weekly Report'}
            </NeuButton>
          </div>
          <div>
            <div className="p-3 bg-neu-bg shadow-neu-inset-sm rounded-xl text-xs font-bold text-neu-fg w-full flex items-center justify-between">
              <span className="text-neu-muted font-medium">Staff Members:</span>
              <span className="text-neu-accent font-display text-sm">{weeklyEmployeeReport.length} Active</span>
            </div>
          </div>
        </div>

        {/* Weekly Report Preview Table */}
        <div className="space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-neu-muted">Weekly Staff Summary Table</h4>
          {weeklyFilterLoading ? (
            <SkeletonCard className="h-36" />
          ) : weeklyEmployeeReport.length === 0 ? (
            <div className="p-8 text-center bg-neu-bg shadow-neu-inset-sm rounded-xl space-y-2">
              <CalendarRange size={28} className="mx-auto text-neu-muted opacity-40" />
              <p className="font-bold text-sm text-neu-fg">No weekly operational records found for this period</p>
              <p className="text-xs text-neu-muted">Try selecting a different start date for the 7-day period.</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-72 overflow-y-auto scrollbar-hide">
              {weeklyEmployeeReport.map((w) => (
                <div key={w.user_id} className="p-4 bg-neu-bg shadow-neu-inset-sm rounded-xl space-y-2">
                  <div className="flex justify-between items-center text-xs border-b border-neu-muted/10 pb-2">
                    <div>
                      <span className="font-bold text-sm text-neu-fg">{w.employee_name}</span>
                      <span className="ml-2 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-neu-accent/10 text-neu-accent">
                        {w.role}
                      </span>
                    </div>
                    <div className="flex gap-4 font-bold text-xs">
                      <span>Days Present: <strong className="text-emerald-600">{w.days_present} / 7</strong></span>
                      <span>Total Work: <strong className="text-neu-accent">{w.total_work_hours} hrs</strong></span>
                      <span>Total Breaks: <strong className="text-amber-600">{w.total_break_mins} mins</strong></span>
                    </div>
                  </div>
                  <p className="text-xs text-neu-muted font-medium bg-neu-bg shadow-neu-inset-xs p-2.5 rounded-lg">
                    <strong className="text-neu-fg font-bold block text-[11px] mb-0.5">Compiled Weekly EOD Work Notes:</strong>
                    {w.compiled_eod_notes}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </NeuCard>

      {/* DASHBOARD 3: General Reports Hub (Both PDF & CSV for All) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Attendance Export Card */}
        <NeuCard className="p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-neu-bg shadow-neu-small rounded-xl text-neu-accent">
              <Clock size={24} />
            </div>
            <div>
              <h3 className="font-display font-bold text-neu-fg">Attendance Logs Report</h3>
              <p className="text-xs text-neu-muted">{attendanceCount} records ready.</p>
            </div>
          </div>
          <p className="text-sm text-neu-muted">Staff check-ins, check-outs, and shift status audit records.</p>
          <div className="flex gap-2.5 pt-2">
            <NeuButton onClick={exportAttendancePDF} className="flex-1">
              <FileText size={16} /> PDF
            </NeuButton>
            <NeuButton onClick={exportAttendanceCSV} variant="secondary" className="flex-1">
              <Download size={16} /> CSV
            </NeuButton>
          </div>
        </NeuCard>

        {/* Leave Requests Export Card */}
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
          <p className="text-sm text-neu-muted">Employee leave applications, classifications, and manager approvals.</p>
          <div className="flex gap-2.5 pt-2">
            <NeuButton onClick={exportLeavesPDF} className="flex-1">
              <FileText size={16} /> PDF
            </NeuButton>
            <NeuButton onClick={exportLeavesCSV} variant="secondary" className="flex-1">
              <Download size={16} /> CSV
            </NeuButton>
          </div>
        </NeuCard>

        {/* Audit Logs Export Card */}
        <NeuCard className="p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-neu-bg shadow-neu-small rounded-xl text-neu-accent">
              <ShieldCheck size={24} />
            </div>
            <div>
              <h3 className="font-display font-bold text-neu-fg">System Audit Logs</h3>
              <p className="text-xs text-neu-muted">{auditLogCount} security records.</p>
            </div>
          </div>
          <p className="text-sm text-neu-muted">Immutable system audit trail and user action transaction histories.</p>
          <div className="flex gap-2.5 pt-2">
            <NeuButton onClick={exportAuditPDF} className="flex-1">
              <FileText size={16} /> PDF
            </NeuButton>
            <NeuButton onClick={exportAuditCSV} variant="secondary" className="flex-1">
              <Download size={16} /> CSV
            </NeuButton>
          </div>
        </NeuCard>
      </div>

      {/* DASHBOARD 4: Manual Executive Custom Reports */}
      <NeuCard className="p-6 space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-4 border-b border-neu-muted/10">
          <div>
            <h3 className="font-display font-bold text-lg text-neu-fg flex items-center gap-2">
              <FileText size={20} className="text-neu-accent" />
              Manual Executive Custom Reports
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
                    <NeuButton onClick={() => transferReportToWhatsApp(whatsappNumber, mr.title, [`Staff: ${mr.staff_name}`, `Date: ${mr.date}`, `Notes: ${mr.notes || 'N/A'}`])} variant="secondary" className="text-xs text-emerald-600 font-bold">
                      <Send size={14} /> WhatsApp
                    </NeuButton>
                    <NeuButton onClick={() => exportCustomManualPDF(mr)} variant="secondary" className="text-xs">
                      <FileText size={14} /> PDF
                    </NeuButton>
                    <NeuButton onClick={() => exportCustomManualCSV(mr)} variant="secondary" className="text-xs">
                      <Download size={14} /> CSV
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
