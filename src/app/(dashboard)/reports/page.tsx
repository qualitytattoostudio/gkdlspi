'use client';

import React, { useEffect, useState, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { NeuCard } from '@/components/neu/NeuCard';
import { NeuButton } from '@/components/neu/NeuButton';
import { NeuInput } from '@/components/neu/NeuInput';
import { NeuSelect } from '@/components/neu/NeuSelect';
import { StatCard } from '@/components/neu/StatCard';
import { SkeletonCard } from '@/components/neu/SkeletonCard';
import { BarChart, Download, FileText, Users, Clock, CheckCircle, Calendar, UserCheck, Filter, CalendarRange, Plus, Trash2, Edit, CheckCircle2, MessageSquare, Send, ShieldCheck, Target, NotebookTabs, RefreshCw, Edit2, Coffee, AlertCircle } from 'lucide-react';
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
  const [goalsCount, setGoalsCount] = useState(0);
  
  const [attendanceData, setAttendanceData] = useState<any[]>([]);
  const [leaveData, setLeaveData] = useState<any[]>([]);
  const [auditData, setAuditData] = useState<any[]>([]);
  const [goalsData, setGoalsData] = useState<any[]>([]);

  // 1. Filtering Controls for Daily Employee & EOD Report
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('all');
  const [dailyEmployeeReport, setDailyEmployeeReport] = useState<any[]>([]);
  const [dailyFilterLoading, setDailyFilterLoading] = useState(false);

  // 2. Filtering Controls for Weekly Operational Staff Report
  const [weeklyStartDate, setWeeklyStartDate] = useState(format(subDays(new Date(), 6), 'yyyy-MM-dd'));
  const [weeklyEmployeeId, setWeeklyEmployeeId] = useState<string>('all');
  const [weeklyEmployeeReport, setWeeklyEmployeeReport] = useState<any[]>([]);
  const [weeklyDailyBreakdown, setWeeklyDailyBreakdown] = useState<any[]>([]); // 7-Day Comprehensive Dossier
  const [weeklyFilterLoading, setWeeklyFilterLoading] = useState(false);

  // 3. Work Notes & EOD Intelligence Report Filter
  const [workNotesSearch, setWorkNotesSearch] = useState('');
  const [workNotesStaffId, setWorkNotesStaffId] = useState('all');

  // 4. Quick Edit Note Modal State
  const [isEditNoteModalOpen, setIsEditNoteModalOpen] = useState(false);
  const [editingNoteRecord, setEditingNoteRecord] = useState<any>(null);
  const [editNoteText, setEditNoteText] = useState('');

  // 5. Manual Report Modal State & Full CRUD State
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

  // Standalone Daily Report Fetcher
  const fetchDailyReport = async (dateToFetch: string, empIdToFetch: string) => {
    setDailyFilterLoading(true);
    try {
      const { data: profs } = await supabase.from('profiles').select('id, full_name, role').eq('is_active', true);
      const pMap = new Map<string, any>();
      (profs || []).forEach(p => { if (p.id) pMap.set(p.id, p); });

      let query = supabase
        .from('attendance_records')
        .select('*, break_records(*)')
        .eq('date', dateToFetch);

      if (empIdToFetch && empIdToFetch !== 'all') {
        query = query.eq('user_id', empIdToFetch);
      }

      const { data, error } = await query.order('check_in_time', { ascending: false });
      if (error) throw error;

      const formatted = (data || []).map(r => {
        const staffObj = pMap.get(r.user_id);
        const staffName = staffObj?.full_name || 'Staff Member';
        const staffRole = staffObj?.role || 'Executive';

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

        const eodNotes = r.notes || r.checkout_notes || r.remarks || 'Standard Shift Completed on Schedule';

        return {
          ...r,
          employee_name: staffName,
          profiles: { full_name: staffName, role: staffRole },
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

  // Standalone Weekly Report Fetcher
  const fetchWeeklyReport = async (startDateStr: string, empIdToFetch: string) => {
    setWeeklyFilterLoading(true);
    try {
      const { data: profs } = await supabase.from('profiles').select('id, full_name, role').eq('is_active', true);
      const pMap = new Map<string, any>();
      (profs || []).forEach(p => { if (p.id) pMap.set(p.id, p); });

      const startDt = parseISO(startDateStr);
      const endDt = addDays(startDt, 6);
      const endDateStr = format(endDt, 'yyyy-MM-dd');

      // 1. Fetch Attendance Records with Breaks
      let attQuery = supabase
        .from('attendance_records')
        .select('*, break_records(*)')
        .gte('date', startDateStr)
        .lte('date', endDateStr);

      if (empIdToFetch && empIdToFetch !== 'all') {
        attQuery = attQuery.eq('user_id', empIdToFetch);
      }

      // 2. Fetch Leave Applications
      let leaveQuery = supabase
        .from('leave_requests')
        .select('*')
        .lte('start_date', endDateStr)
        .gte('end_date', startDateStr);

      if (empIdToFetch && empIdToFetch !== 'all') {
        leaveQuery = leaveQuery.eq('user_id', empIdToFetch);
      }

      const [{ data: attData, error: attErr }, { data: leavesData, error: leaveErr }] = await Promise.all([
        attQuery.order('date', { ascending: true }),
        leaveQuery
      ]);

      if (attErr) throw attErr;

      const empGroupMap = new Map<string, any>();
      const dailyBreakdownList: any[] = [];

      if (empIdToFetch && empIdToFetch !== 'all') {
        const staffObj = pMap.get(empIdToFetch);
        const empName = staffObj?.full_name || 'Staff Member';
        const empRole = staffObj?.role || 'Executive';

        let totalWeeklyMins = 0;
        let totalWeeklyBreaks = 0;
        let daysWorkedCount = 0;
        let leaveDaysCount = 0;
        const compiledNotesList: string[] = [];

        for (let i = 0; i < 7; i++) {
          const currentDayDt = addDays(startDt, i);
          const currentDayStr = format(currentDayDt, 'yyyy-MM-dd');
          const dayOfWeek = format(currentDayDt, 'EEEE');

          const dayAtt = (attData || []).find(a => a.date === currentDayStr);
          const dayLeave = (leavesData || []).find(l => {
            const sDate = l.start_date ? l.start_date.substring(0, 10) : '';
            const eDate = l.end_date ? l.end_date.substring(0, 10) : sDate;
            return currentDayStr >= sDate && currentDayStr <= eDate;
          });

          let status = 'Rest Day / Off Duty';
          let shiftTiming = 'Off Duty / No Shift';
          let workHours = '0.0';
          let breakSummary = 'No Breaks';
          let breakMins = 0;
          let notes = 'Rest Day / Off Duty';
          let leaveDetails = 'None';

          if (dayAtt) {
            status = dayAtt.status || 'present';
            daysWorkedCount += 1;
            const wMins = Number(dayAtt.total_work_minutes) || 0;
            totalWeeklyMins += wMins;
            workHours = (wMins / 60).toFixed(1);

            const inTime = dayAtt.check_in_time ? format(new Date(dayAtt.check_in_time), 'hh:mm a') : 'N/A';
            const outTime = dayAtt.check_out_time ? format(new Date(dayAtt.check_out_time), 'hh:mm a') : 'Active Duty';
            shiftTiming = `${inTime} — ${outTime}`;

            const breaks = dayAtt.break_records || [];
            if (breaks.length > 0) {
              breakMins = breaks.reduce((sum: number, b: any) => sum + (Number(b.break_duration) || Number(b.break_duration_minutes) || 0), 0);
              totalWeeklyBreaks += breakMins;
              const firstB = breaks[0];
              const bStart = firstB.break_start ? format(new Date(firstB.break_start), 'hh:mm a') : '';
              const bEnd = firstB.break_end ? format(new Date(firstB.break_end), 'hh:mm a') : 'Active';
              breakSummary = `${bStart} - ${bEnd} (${breakMins} mins)`;
            }

            notes = dayAtt.notes || dayAtt.checkout_notes || dayAtt.remarks || 'Standard Shift Completed on Schedule';
            compiledNotesList.push(`${currentDayStr} (${dayOfWeek}): ${notes}`);
          }

          if (dayLeave) {
            leaveDaysCount += 1;
            leaveDetails = `${dayLeave.leave_type || 'Leave'} [${(dayLeave.status || 'pending').toUpperCase()}]: ${dayLeave.reason || 'No reason provided'}`;
            if (!dayAtt) {
              status = `On Leave (${dayLeave.leave_type || 'General'})`;
              shiftTiming = `Leave Approved`;
              notes = `Applied Leave: ${dayLeave.reason || 'Leave Approved'}`;
            }
          }

          dailyBreakdownList.push({
            id: dayAtt?.id || `day-${i}`,
            user_id: empIdToFetch,
            employee_name: empName,
            role: empRole,
            date: currentDayStr,
            day_name: dayOfWeek,
            status,
            shift_timing: shiftTiming,
            total_work_hours: workHours,
            break_summary: breakSummary,
            break_mins: breakMins,
            eod_notes: notes,
            leave_details: leaveDetails,
            has_leave: !!dayLeave,
            has_att: !!dayAtt
          });
        }

        empGroupMap.set(empIdToFetch, {
          user_id: empIdToFetch,
          employee_name: empName,
          role: empRole,
          days_present: daysWorkedCount,
          leave_days: leaveDaysCount,
          total_work_mins: totalWeeklyMins,
          total_break_mins: totalWeeklyBreaks,
          total_work_hours: (totalWeeklyMins / 60).toFixed(1),
          compiled_eod_notes: compiledNotesList.length > 0 ? compiledNotesList.join(' | ') : 'Regular Weekly Shift Logs'
        });
      } else {
        (attData || []).forEach(r => {
          const userId = r.user_id || 'unknown';
          const staffObj = pMap.get(userId);
          const empName = staffObj?.full_name || 'Staff Member';
          const empRole = staffObj?.role || 'Executive';
          const eodNote = r.notes || r.checkout_notes || r.remarks || 'Standard Shift Completed on Schedule';
          const workMins = Number(r.total_work_minutes) || 0;

          const breaks = r.break_records || [];
          const breakMins = breaks.reduce((sum: number, b: any) => sum + (Number(b.break_duration) || Number(b.break_duration_minutes) || 0), 0);

          if (!empGroupMap.has(userId)) {
            empGroupMap.set(userId, {
              user_id: userId,
              employee_name: empName,
              role: empRole,
              days_present: 0,
              leave_days: 0,
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

        (leavesData || []).forEach(l => {
          if (empGroupMap.has(l.user_id)) {
            empGroupMap.get(l.user_id).leave_days += 1;
          }
        });
      }

      const weeklyFormatted = Array.from(empGroupMap.values()).map(g => ({
        ...g,
        total_work_hours: (g.total_work_mins / 60).toFixed(1),
        compiled_eod_notes: g.eod_notes_list?.length > 0 ? g.eod_notes_list.join(' | ') : (g.compiled_eod_notes || 'Regular Weekly Shift Logs')
      }));

      setWeeklyEmployeeReport(weeklyFormatted);
      setWeeklyDailyBreakdown(dailyBreakdownList);
    } catch (err) {
      console.error('Error fetching weekly report:', err);
      setWeeklyEmployeeReport([]);
      setWeeklyDailyBreakdown([]);
    } finally {
      setWeeklyFilterLoading(false);
    }
  };

  const fetchInitialData = async () => {
    try {
      const { data: profs } = await supabase
        .from('profiles')
        .select('id, full_name, role')
        .eq('is_active', true)
        .order('full_name', { ascending: true });

      const activeEmployees = profs || [];
      setEmployees(activeEmployees);
      
      const pMap = new Map<string, any>();
      activeEmployees.forEach(p => {
        if (p.id) pMap.set(p.id, p);
      });

      const [
        { data: att, count: attCnt },
        { data: lve, count: lveCnt },
        { data: aud, count: audCnt },
        { count: locCnt },
        { data: manualRpts },
        { data: goals, count: goalsCnt }
      ] = await Promise.all([
        supabase.from('attendance_records').select('*').order('date', { ascending: false }),
        supabase.from('leave_requests').select('*, profiles(full_name)').order('created_at', { ascending: false }),
        supabase.from('audit_logs').select('*').order('created_at', { ascending: false }),
        supabase.from('exec_locations').select('id', { count: 'exact', head: true }),
        supabase.from('manual_reports').select('*').order('created_at', { ascending: false }),
        supabase.from('employee_goals').select('*').order('created_at', { ascending: false })
      ]);

      const mappedAtt = (att || []).map(a => {
        const staffObj = pMap.get(a.user_id);
        const staffName = staffObj?.full_name || 'Staff Member';
        const staffRole = staffObj?.role || 'Executive';
        const noteText = a.notes || a.checkout_notes || a.remarks || 'Standard Shift Completed on Schedule';

        return {
          ...a,
          employee_name: staffName,
          profiles: { full_name: staffName, role: staffRole },
          eod_notes: noteText
        };
      });

      setAttendanceData(mappedAtt);
      setLeaveData(lve || []);
      setAuditData(aud || []);
      setManualReports(manualRpts || []);
      setGoalsData(goals || []);

      setAttendanceCount(attCnt || (att?.length || 0));
      setLeaveCount(lveCnt || (lve?.length || 0));
      setAuditLogCount(audCnt || (aud?.length || 0));
      setExecLocationsCount(locCnt || 0);
      setGoalsCount(goalsCnt || (goals?.length || 0));

      // Initial sub-reports fetch
      fetchDailyReport(selectedDate, selectedEmployeeId);
      fetchWeeklyReport(weeklyStartDate, weeklyEmployeeId);
    } catch (err) {
      console.error('Error fetching report metrics:', err);
    } finally {
      setLoading(false);
    }
  };

  // Run on Mount Only: load initial data & attach realtime listeners
  useEffect(() => {
    fetchInitialData();

    const reportsChannel = supabase
      .channel('realtime_reports_sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance_records' }, () => {
        fetchInitialData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'manual_reports' }, () => {
        fetchInitialData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'work_notes' }, () => {
        fetchInitialData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leave_requests' }, () => {
        fetchInitialData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(reportsChannel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  // 2. Comprehensive Weekly Report PDF & CSV (All 7 Days Shift Timings, Breaks, Notes & Leaves)
  const buildWeeklyReportPDF = () => {
    const isSpecificPerson = weeklyEmployeeId !== 'all';
    const doc = new jsPDF(isSpecificPerson ? 'landscape' : 'portrait');
    const endDt = addDays(parseISO(weeklyStartDate), 6);
    const endDateStr = format(endDt, 'yyyy-MM-dd');
    const targetPersonName = employees.find(e => e.id === weeklyEmployeeId)?.full_name || 'Staff Member';
    
    if (isSpecificPerson) {
      doc.setFontSize(14);
      doc.text(`V-Syncer Comprehensive Weekly Timesheet & Shift Intelligence Dossier`, 14, 15);
      doc.setFontSize(10);
      doc.text(`Employee: ${targetPersonName} | Period: ${weeklyStartDate} to ${endDateStr} (7 Full Days)`, 14, 22);

      const totalHrs = weeklyDailyBreakdown.reduce((sum, d) => sum + Number(d.total_work_hours || 0), 0).toFixed(1);
      const daysWorked = weeklyDailyBreakdown.filter(d => d.has_att).length;
      const leaveDays = weeklyDailyBreakdown.filter(d => d.has_leave).length;
      doc.text(`Summary Metrics -> Total Work Hours: ${totalHrs} hrs | Days Present: ${daysWorked}/7 | Leaves Logged: ${leaveDays}`, 14, 28);

      autoTable(doc, {
        startY: 34,
        head: [['Date', 'Day', 'Attendance Status', 'Shift Timing (In - Out)', 'Hours', 'Break Details', 'Daily Work Notes / Remarks', 'Leave Details']],
        body: weeklyDailyBreakdown.map(d => [
          d.date,
          d.day_name,
          d.status.toUpperCase(),
          d.shift_timing,
          `${d.total_work_hours} hrs`,
          d.break_summary,
          d.eod_notes,
          d.leave_details
        ]),
        styles: { fontSize: 8, cellPadding: 2.5 },
        headStyles: { fillColor: [15, 76, 129] }
      });
    } else {
      doc.setFontSize(14);
      doc.text(`V-Syncer Weekly Operations Summary (${weeklyStartDate} to ${endDateStr})`, 14, 15);
      doc.setFontSize(10);
      doc.text(`Target Scope: All Active Personnel | Period: 7 Days`, 14, 22);

      autoTable(doc, {
        startY: 28,
        head: [['Employee Name', 'Role', 'Days Present', 'Leave Days', 'Total Hours', 'Break Mins', 'Weekly Compiled EOD Notes']],
        body: weeklyEmployeeReport.map(w => [
          w.employee_name,
          w.role,
          `${w.days_present} / 7 Days`,
          `${w.leave_days || 0} Days`,
          `${w.total_work_hours} hrs`,
          `${w.total_break_mins} mins`,
          w.compiled_eod_notes
        ]),
        styles: { fontSize: 8, cellPadding: 2.5 },
        headStyles: { fillColor: [15, 76, 129] }
      });
    }
    return doc;
  };

  const exportWeeklyReportPDF = () => {
    const doc = buildWeeklyReportPDF();
    const endDt = addDays(parseISO(weeklyStartDate), 6);
    const targetName = weeklyEmployeeId === 'all' ? 'All_Staff' : (employees.find(e => e.id === weeklyEmployeeId)?.full_name || 'Staff').replace(/\s+/g, '_');
    doc.save(`Weekly_Comprehensive_Report_${weeklyStartDate}_to_${format(endDt, 'yyyy-MM-dd')}_${targetName}.pdf`);
    playSuccess();
    toast.success('PDF Exported', 'Comprehensive weekly report downloaded as PDF.');
  };

  const exportWeeklyReportCSV = () => {
    const endDt = addDays(parseISO(weeklyStartDate), 6);
    const endDateStr = format(endDt, 'yyyy-MM-dd');
    const isSpecificPerson = weeklyEmployeeId !== 'all';
    const targetName = isSpecificPerson ? (employees.find(e => e.id === weeklyEmployeeId)?.full_name || 'Staff').replace(/\s+/g, '_') : 'All_Staff';

    let csv = '';
    if (isSpecificPerson) {
      csv = Papa.unparse(weeklyDailyBreakdown.map(d => ({
        EmployeeName: d.employee_name,
        Role: d.role,
        Date: d.date,
        DayOfWeek: d.day_name,
        Status: d.status,
        ShiftTiming: d.shift_timing,
        HoursWorked: d.total_work_hours,
        BreakDetails: d.break_summary,
        BreakMinutes: d.break_mins,
        WorkNotesAndRemarks: d.eod_notes,
        LeaveDetails: d.leave_details
      })));
    } else {
      csv = Papa.unparse(weeklyEmployeeReport.map(w => ({
        EmployeeName: w.employee_name,
        Role: w.role,
        DaysPresent: w.days_present,
        LeaveDays: w.leave_days || 0,
        TotalWorkHours: w.total_work_hours,
        TotalBreakMinutes: w.total_break_mins,
        CompiledEODNotes: w.compiled_eod_notes
      })));
    }

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Weekly_Comprehensive_Report_${weeklyStartDate}_to_${endDateStr}_${targetName}.csv`);
    link.click();
    playSuccess();
    toast.success('CSV Exported', 'Comprehensive weekly report downloaded as CSV.');
  };

  const exportWeeklyReportWhatsApp = () => {
    const doc = buildWeeklyReportPDF();
    const endDt = addDays(parseISO(weeklyStartDate), 6);
    const endDateStr = format(endDt, 'yyyy-MM-dd');
    const isSpecificPerson = weeklyEmployeeId !== 'all';
    const targetName = isSpecificPerson ? (employees.find(e => e.id === weeklyEmployeeId)?.full_name || 'Staff') : 'All Staff';

    const totalHours = isSpecificPerson 
      ? weeklyDailyBreakdown.reduce((sum, d) => sum + Number(d.total_work_hours || 0), 0).toFixed(1)
      : weeklyEmployeeReport.reduce((sum, w) => sum + Number(w.total_work_hours || 0), 0).toFixed(1);

    const summaryLines = [
      `📅 *Weekly Period (7 Days):* ${weeklyStartDate} to ${endDateStr}`,
      `👤 *Staff Target:* ${targetName}`,
      `⏱️ *Total Shift Work Hours:* ${totalHours} hrs`,
      `☕ *Break & Leave Logs:* Full day-by-day shift timing, break durations, leave records, and work notes attached in PDF report.`
    ];
    transferReportToWhatsApp(whatsappNumber, `Weekly Comprehensive Report - ${targetName}`, summaryLines, doc);
  };

  // 3. Work Notes & EOD Intelligence Report (PDF & CSV)
  const filteredWorkNotes = attendanceData.filter(a => {
    const noteText = (a.eod_notes || a.notes || a.checkout_notes || a.remarks || 'Standard Shift Completed').toLowerCase();
    const staffName = (a.employee_name || a.profiles?.full_name || '').toLowerCase();
    const matchesSearch = !workNotesSearch || noteText.includes(workNotesSearch.toLowerCase()) || staffName.includes(workNotesSearch.toLowerCase());
    const matchesStaff = workNotesStaffId === 'all' || a.user_id === workNotesStaffId;
    return matchesSearch && matchesStaff;
  });

  const exportWorkNotesPDF = () => {
    const doc = new jsPDF();
    const targetStaffName = workNotesStaffId === 'all' ? 'All Staff' : (employees.find(e => e.id === workNotesStaffId)?.full_name || 'Staff');
    doc.text(`V-Syncer Operations — Staff Work Notes & EOD Activity Report (${targetStaffName})`, 14, 15);
    doc.setFontSize(10);
    doc.text(`Generated: ${format(new Date(), 'yyyy-MM-dd HH:mm')} | Matching Records: ${filteredWorkNotes.length}`, 14, 22);

    autoTable(doc, {
      startY: 28,
      head: [['Employee', 'Date', 'Check Out Time', 'Work Notes / EOD Remarks to Manager']],
      body: filteredWorkNotes.map(a => [
        a.employee_name || a.profiles?.full_name || 'Staff Member',
        a.date || 'N/A',
        a.check_out_time ? format(new Date(a.check_out_time), 'hh:mm a') : 'On Duty',
        a.eod_notes || a.notes || a.checkout_notes || a.remarks || 'Standard Duty Completed'
      ])
    });
    doc.save(`Staff_Work_Notes_${targetStaffName.replace(/\s+/g, '_')}_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
    playSuccess();
    toast.success('PDF Exported', 'Work notes report downloaded as PDF.');
  };

  const exportWorkNotesCSV = () => {
    const targetStaffName = workNotesStaffId === 'all' ? 'All_Staff' : (employees.find(e => e.id === workNotesStaffId)?.full_name || 'Staff').replace(/\s+/g, '_');
    const csv = Papa.unparse(filteredWorkNotes.map(a => ({
      EmployeeName: a.employee_name || a.profiles?.full_name || 'Staff Member',
      Date: a.date,
      CheckIn: a.check_in_time ? format(new Date(a.check_in_time), 'hh:mm:ss a') : 'N/A',
      CheckOut: a.check_out_time ? format(new Date(a.check_out_time), 'hh:mm:ss a') : 'Active',
      WorkNotes: a.eod_notes || a.notes || a.checkout_notes || a.remarks || 'Standard Duty',
      TotalWorkMinutes: a.total_work_minutes || 0
    })));
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Staff_Work_Notes_${targetStaffName}_${format(new Date(), 'yyyy-MM-dd')}.csv`);
    link.click();
    playSuccess();
    toast.success('CSV Exported', 'Work notes report downloaded as CSV.');
  };

  const handleOpenEditNoteModal = (item: any) => {
    setEditingNoteRecord(item);
    setEditNoteText(item.eod_notes || item.notes || item.checkout_notes || item.remarks || '');
    setIsEditNoteModalOpen(true);
  };

  const handleSaveUpdatedNoteFromReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingNoteRecord) return;

    try {
      const { error } = await supabase
        .from('attendance_records')
        .update({
          notes: editNoteText,
          checkout_notes: editNoteText,
          remarks: editNoteText
        })
        .eq('id', editingNoteRecord.id);

      if (error) throw error;

      setAttendanceData(prev => prev.map(a => a.id === editingNoteRecord.id ? {
        ...a,
        notes: editNoteText,
        checkout_notes: editNoteText,
        remarks: editNoteText,
        eod_notes: editNoteText
      } : a));

      playSuccess();
      toast.success('Work Notes Updated', 'Notes successfully saved to database and synchronized.');
      setIsEditNoteModalOpen(false);
      setEditingNoteRecord(null);
    } catch (err) {
      console.error('Error updating note:', err);
      playError();
      toast.error('Update Failed', 'Could not update work note.');
    }
  };

  // 4. Employee Goals & Target Allocation Report (PDF & CSV)
  const exportGoalsReportPDF = () => {
    const doc = new jsPDF();
    doc.text('V-Syncer Operations — Staff Goals & Target Allocation Report', 14, 15);
    doc.setFontSize(10);
    doc.text(`Generated: ${format(new Date(), 'yyyy-MM-dd HH:mm')} | Total Targets: ${goalsData.length}`, 14, 22);

    autoTable(doc, {
      startY: 28,
      head: [['Title / Goal', 'Metric Type', 'Target Value', 'Current Value', 'Status', 'Due Date']],
      body: goalsData.map(g => [
        g.title || 'Goal',
        g.goal_type || 'Target',
        `${g.target_value || 0}`,
        `${g.current_value || 0}`,
        (g.status || 'active').toUpperCase(),
        g.due_date ? format(new Date(g.due_date), 'yyyy-MM-dd') : 'No Deadline'
      ])
    });
    doc.save(`Goals_Target_Report_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
    playSuccess();
    toast.success('PDF Exported', 'Target report downloaded as PDF.');
  };

  const exportGoalsReportCSV = () => {
    const csv = Papa.unparse(goalsData.map(g => ({
      Title: g.title,
      GoalType: g.goal_type,
      TargetValue: g.target_value,
      CurrentValue: g.current_value,
      Status: g.status,
      DueDate: g.due_date,
      Description: g.description || 'N/A'
    })));
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Goals_Target_Report_${format(new Date(), 'yyyy-MM-dd')}.csv`);
    link.click();
    playSuccess();
    toast.success('CSV Exported', 'Target report downloaded as CSV.');
  };

  // 5. Attendance Log Report PDF & CSV
  const exportAttendancePDF = () => {
    const doc = new jsPDF();
    doc.text('V-Syncer Operations — Attendance Logs Report', 14, 15);
    doc.setFontSize(10);
    doc.text(`Generated: ${format(new Date(), 'yyyy-MM-dd HH:mm')} | Records: ${attendanceData.length}`, 14, 22);

    autoTable(doc, {
      startY: 28,
      head: [['Employee', 'Date', 'Check In', 'Check Out', 'Status']],
      body: attendanceData.map(a => [
        a.employee_name || a.profiles?.full_name || 'Staff',
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
      Employee: a.employee_name || a.profiles?.full_name || 'Staff',
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

  // 6. Leave Requests Report PDF & CSV
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

  // 7. Audit Logs Report PDF & CSV
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

  // 8. Manual Custom Report Handlers
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

  const selectedPersonName = weeklyEmployeeId === 'all' 
    ? null 
    : employees.find(e => e.id === weeklyEmployeeId)?.full_name || 'Staff Member';

  const weeklySpecificTotalHours = weeklyDailyBreakdown.reduce((sum, d) => sum + Number(d.total_work_hours || 0), 0).toFixed(1);
  const weeklySpecificDaysWorked = weeklyDailyBreakdown.filter(d => d.has_att).length;
  const weeklySpecificLeaveDays = weeklyDailyBreakdown.filter(d => d.has_leave).length;
  const weeklySpecificTotalBreaks = weeklyDailyBreakdown.reduce((sum, d) => sum + Number(d.break_mins || 0), 0);

  return (
    <div className="space-y-6 animate-fade-up">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-xl font-display font-bold text-neu-fg">Executive Reports & Intelligence Portal</h2>
          <p className="text-neu-muted text-sm">Download full operational reports, staff work notes, weekly individual summaries, and target metrics in PDF & CSV.</p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              fetchInitialData();
              playSuccess();
              toast.success('Refreshed', 'All report feeds reloaded.');
            }}
            className="p-2 rounded-xl bg-neu-bg shadow-neu-small hover:shadow-neu-lifted active:shadow-neu-inset text-neu-accent transition-all cursor-pointer"
            title="Refresh All Reports"
          >
            <RefreshCw size={16} />
          </button>

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
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title="Attendance & Work Logs" value={attendanceCount} icon={Clock} />
        <StatCard title="Leave Applications" value={leaveCount} icon={Users} />
        <StatCard title="Staff Goals & Targets" value={goalsCount} icon={Target} />
        <StatCard title="System Audit Logs" value={auditLogCount} icon={CheckCircle} />
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
            onChange={(e) => {
              const newDate = e.target.value;
              setSelectedDate(newDate);
              fetchDailyReport(newDate, selectedEmployeeId);
            }}
          />
          <NeuSelect 
            label="Select Specific Staff Member" 
            options={[
              { label: 'All Personnel & Staff Members', value: 'all' },
              ...employees.map(e => ({ label: `${e.full_name || 'Staff Member'} (${e.role || 'Staff'})`, value: e.id }))
            ]}
            value={selectedEmployeeId}
            onChange={(e) => {
              const newEmp = e.target.value;
              setSelectedEmployeeId(newEmp);
              fetchDailyReport(selectedDate, newEmp);
            }}
          />
          <div>
            <NeuButton 
              onClick={() => {
                fetchDailyReport(selectedDate, selectedEmployeeId);
                playSuccess();
                toast.success('Filters Applied', `Loaded daily logs for ${selectedDate}`);
              }}
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

      {/* DASHBOARD 2: Comprehensive Weekly Operational Staff Report (Shift Timings, Breaks, Work Notes, Leaves) */}
      <NeuCard className="p-6 space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-4 border-b border-neu-muted/10">
          <div>
            <h3 className="font-display font-bold text-lg text-neu-fg flex items-center gap-2">
              <CalendarRange size={20} className="text-neu-accent" />
              Weekly Operational Staff Report {selectedPersonName ? `— (${selectedPersonName})` : '& Team Summary'}
            </h3>
            <p className="text-xs text-neu-muted">
              {selectedPersonName 
                ? `Detailed 7-day breakdown: shift timings (in-out), work hours, break sessions, daily work notes, and leave applications for ${selectedPersonName}.` 
                : '7-day aggregated attendance, total work hours, break totals, leave records, and compiled EOD work notes for all staff.'}
            </p>
          </div>
          <div className="flex flex-wrap gap-2.5">
            <button 
              onClick={exportWeeklyReportWhatsApp}
              disabled={weeklyEmployeeReport.length === 0 && weeklyDailyBreakdown.length === 0}
              className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold text-xs flex items-center gap-1.5 shadow-neu-raised transition-all disabled:opacity-40 cursor-pointer"
            >
              <Send size={14} />
              Send Weekly PDF to WhatsApp (+91 {whatsappNumber})
            </button>
            <NeuButton onClick={exportWeeklyReportPDF} disabled={weeklyEmployeeReport.length === 0 && weeklyDailyBreakdown.length === 0}>
              <FileText size={16} /> PDF Export
            </NeuButton>
            <NeuButton onClick={exportWeeklyReportCSV} variant="secondary" disabled={weeklyEmployeeReport.length === 0 && weeklyDailyBreakdown.length === 0}>
              <Download size={16} /> CSV Export
            </NeuButton>
          </div>
        </div>

        {/* Weekly Filter Toolbar */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <NeuInput 
            label="Week Start Date (7 Days Window)" 
            type="date" 
            value={weeklyStartDate}
            onChange={(e) => {
              const newStart = e.target.value;
              setWeeklyStartDate(newStart);
              fetchWeeklyReport(newStart, weeklyEmployeeId);
            }}
          />
          <NeuSelect 
            label="Select Specific Person / Team Summary" 
            options={[
              { label: 'All Personnel & Staff Members (Team Summary)', value: 'all' },
              ...employees.map(e => ({ label: `👤 ${e.full_name || 'Staff Member'} (${e.role || 'Staff'})`, value: e.id }))
            ]}
            value={weeklyEmployeeId}
            onChange={(e) => {
              const newEmp = e.target.value;
              setWeeklyEmployeeId(newEmp);
              fetchWeeklyReport(weeklyStartDate, newEmp);
            }}
          />
          <div>
            <NeuButton 
              onClick={() => {
                fetchWeeklyReport(weeklyStartDate, weeklyEmployeeId);
                playSuccess();
                toast.success('Weekly Report Compiled', `Loaded 7-day dossier starting ${weeklyStartDate}`);
              }}
              className="w-full"
              disabled={weeklyFilterLoading}
            >
              <Filter size={16} />
              {weeklyFilterLoading ? 'Compiling Dossier...' : 'Generate 7-Day Report'}
            </NeuButton>
          </div>
          <div>
            <div className="p-3 bg-neu-bg shadow-neu-inset-sm rounded-xl text-xs font-bold text-neu-fg w-full flex items-center justify-between">
              <span className="text-neu-muted font-medium">Scope:</span>
              <span className="text-neu-accent font-display text-sm truncate max-w-[130px]">
                {selectedPersonName || `${weeklyEmployeeReport.length} Staff Members`}
              </span>
            </div>
          </div>
        </div>

        {/* Weekly Executive Summary Bar for Specific Person */}
        {selectedPersonName && !weeklyFilterLoading && weeklyDailyBreakdown.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 bg-neu-bg shadow-neu-inset-sm rounded-xl text-xs">
            <div>
              <span className="text-neu-muted block font-medium text-[11px]">Total Work Hours:</span>
              <span className="text-neu-accent font-bold text-sm">{weeklySpecificTotalHours} hrs</span>
            </div>
            <div>
              <span className="text-neu-muted block font-medium text-[11px]">Days Present / Shifts:</span>
              <span className="text-emerald-600 font-bold text-sm">{weeklySpecificDaysWorked} / 7 Days</span>
            </div>
            <div>
              <span className="text-neu-muted block font-medium text-[11px]">Leaves Applied:</span>
              <span className="text-amber-600 font-bold text-sm">{weeklySpecificLeaveDays} Days</span>
            </div>
            <div>
              <span className="text-neu-muted block font-medium text-[11px]">Total Break Duration:</span>
              <span className="text-purple-600 font-bold text-sm">{weeklySpecificTotalBreaks} mins</span>
            </div>
          </div>
        )}

        {/* Weekly Report Preview: Specific Person 7-Day Breakdown vs Team Summary */}
        <div className="space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-neu-muted">
            {selectedPersonName ? `7-Day Day-by-Day Comprehensive Dossier (${selectedPersonName})` : 'Weekly Team Performance Summary'}
          </h4>

          {weeklyFilterLoading ? (
            <SkeletonCard className="h-36" />
          ) : weeklyEmployeeId !== 'all' ? (
            /* Specific Person Comprehensive 7-Day View */
            weeklyDailyBreakdown.length === 0 ? (
              <div className="p-8 text-center bg-neu-bg shadow-neu-inset-sm rounded-xl space-y-2">
                <CalendarRange size={28} className="mx-auto text-neu-muted opacity-40" />
                <p className="font-bold text-sm text-neu-fg">No records found for {selectedPersonName} in this 7-day period</p>
                <p className="text-xs text-neu-muted">Try choosing another week start date.</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto scrollbar-hide">
                {weeklyDailyBreakdown.map((d) => (
                  <div key={d.id} className="p-4 bg-neu-bg shadow-neu-inset-sm rounded-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-3 text-xs">
                    <div className="space-y-1.5 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm text-neu-fg">{d.day_name}</span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-neu-bg shadow-neu-small text-neu-accent">
                          {d.date}
                        </span>
                        
                        {/* Status Badge */}
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          d.has_att 
                            ? 'bg-emerald-500/10 text-emerald-600' 
                            : d.has_leave 
                            ? 'bg-amber-500/10 text-amber-600' 
                            : 'bg-slate-500/10 text-slate-500'
                        }`}>
                          {d.status}
                        </span>

                        <span className="text-[11px] text-emerald-600 font-bold">
                          ⏱️ {d.total_work_hours} hrs
                        </span>

                        <span className="text-[11px] text-amber-600 font-medium flex items-center gap-1">
                          <Coffee size={12} /> {d.break_summary}
                        </span>
                      </div>

                      {/* Work Notes / Remarks */}
                      <div className="p-2.5 bg-neu-bg shadow-neu-inset-xs rounded-lg text-neu-fg font-medium text-xs max-w-2xl flex items-start gap-2">
                        <NotebookTabs size={14} className="text-neu-accent shrink-0 mt-0.5" />
                        <div>
                          <strong className="text-neu-accent text-[10px] uppercase tracking-wider block">Daily Work Notes / EOD Remarks:</strong>
                          <span>{d.eod_notes}</span>
                        </div>
                      </div>

                      {/* Leave Notice if applicable */}
                      {d.has_leave && (
                        <div className="p-2 bg-amber-500/10 border border-amber-500/20 rounded-lg text-amber-700 text-xs flex items-center gap-2">
                          <AlertCircle size={14} className="shrink-0 text-amber-600" />
                          <span><strong>Leave Information:</strong> {d.leave_details}</span>
                        </div>
                      )}
                    </div>

                    <div className="text-right shrink-0">
                      <p className="font-bold text-neu-accent text-xs">
                        Shift: {d.shift_timing}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : (
            /* Team Summary View */
            weeklyEmployeeReport.length === 0 ? (
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
                        <span>Days Worked: <strong className="text-emerald-600">{w.days_present} / 7</strong></span>
                        <span>Leaves: <strong className="text-amber-600">{w.leave_days || 0}</strong></span>
                        <span>Total Work: <strong className="text-neu-accent">{w.total_work_hours} hrs</strong></span>
                        <span>Total Breaks: <strong className="text-purple-600">{w.total_break_mins} mins</strong></span>
                      </div>
                    </div>
                    <p className="text-xs text-neu-muted font-medium bg-neu-bg shadow-neu-inset-xs p-2.5 rounded-lg">
                      <strong className="text-neu-fg font-bold block text-[11px] mb-0.5">Compiled Weekly EOD Work Notes:</strong>
                      {w.compiled_eod_notes}
                    </p>
                  </div>
                ))}
              </div>
            )
          )}
        </div>
      </NeuCard>

      {/* DASHBOARD 3: Staff Work Notes & EOD Intelligence Report */}
      <NeuCard className="p-6 space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-4 border-b border-neu-muted/10">
          <div>
            <h3 className="font-display font-bold text-lg text-neu-fg flex items-center gap-2">
              <NotebookTabs size={20} className="text-neu-accent" />
              Staff Work Notes & EOD Intelligence Report
            </h3>
            <p className="text-xs text-neu-muted">Real-time repository of shift remarks, task notes, and EOD work descriptions submitted by executives.</p>
          </div>
          <div className="flex gap-2.5">
            <NeuButton onClick={exportWorkNotesPDF} disabled={filteredWorkNotes.length === 0}>
              <FileText size={16} /> PDF Export
            </NeuButton>
            <NeuButton onClick={exportWorkNotesCSV} variant="secondary" disabled={filteredWorkNotes.length === 0}>
              <Download size={16} /> CSV Export
            </NeuButton>
          </div>
        </div>

        {/* Search & Staff Filter */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2">
            <NeuInput 
              placeholder="Search work notes, remarks, or staff name..." 
              value={workNotesSearch}
              onChange={(e) => setWorkNotesSearch(e.target.value)}
            />
          </div>
          <div>
            <NeuSelect 
              options={[
                { label: 'All Staff Work Notes', value: 'all' },
                ...employees.map(e => ({ label: `${e.full_name || 'Staff Member'} (${e.role || 'Staff'})`, value: e.id }))
              ]}
              value={workNotesStaffId}
              onChange={(e) => setWorkNotesStaffId(e.target.value)}
            />
          </div>
        </div>

        {/* Work Notes Feed */}
        <div className="space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-neu-muted">Work Notes Feed ({filteredWorkNotes.length} entries)</h4>
          {filteredWorkNotes.length === 0 ? (
            <div className="p-8 text-center bg-neu-bg shadow-neu-inset-sm rounded-xl space-y-2">
              <NotebookTabs size={28} className="mx-auto text-neu-muted opacity-40" />
              <p className="font-bold text-sm text-neu-fg">No work notes matching search criteria</p>
              <p className="text-xs text-neu-muted">Try adjusting search query or employee filter.</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-72 overflow-y-auto scrollbar-hide">
              {filteredWorkNotes.map((item) => (
                <div key={item.id} className="p-4 bg-neu-bg shadow-neu-inset-sm rounded-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-3 text-xs group">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-neu-fg">{item.employee_name || item.profiles?.full_name || 'Staff Member'}</span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-neu-bg shadow-neu-small text-neu-accent">
                        {item.date}
                      </span>
                    </div>
                    <p className="text-xs text-neu-fg mt-1.5 bg-neu-bg shadow-neu-inset-xs p-2.5 rounded-lg max-w-2xl font-medium">
                      "{item.eod_notes || item.notes || item.checkout_notes || item.remarks}"
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right text-neu-muted text-[11px]">
                      <p>Check Out: <strong className="text-neu-fg">{item.check_out_time ? format(new Date(item.check_out_time), 'hh:mm a') : 'On Duty'}</strong></p>
                      <p className="mt-0.5">Duty: <strong className="text-emerald-600">{item.total_work_minutes ? `${Math.round(item.total_work_minutes / 60)} hrs` : 'Standard'}</strong></p>
                    </div>
                    <button
                      onClick={() => handleOpenEditNoteModal(item)}
                      className="p-1.5 rounded-lg bg-neu-bg shadow-neu-small hover:text-neu-accent text-neu-muted transition-all cursor-pointer opacity-80 hover:opacity-100"
                      title="Edit this note"
                    >
                      <Edit2 size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </NeuCard>

      {/* DASHBOARD 4: General Operations & Performance Hub (Both PDF & CSV) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Targets & Goals Card */}
        <NeuCard className="p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-neu-bg shadow-neu-small rounded-xl text-neu-accent">
              <Target size={24} />
            </div>
            <div>
              <h3 className="font-display font-bold text-neu-fg">Staff Goals & Targets</h3>
              <p className="text-xs text-neu-muted">{goalsCount} active targets.</p>
            </div>
          </div>
          <p className="text-sm text-neu-muted">Employee revenue, jobs, and KPI targets performance audit.</p>
          <div className="flex gap-2.5 pt-2">
            <NeuButton onClick={exportGoalsReportPDF} className="flex-1">
              <FileText size={16} /> PDF
            </NeuButton>
            <NeuButton onClick={exportGoalsReportCSV} variant="secondary" className="flex-1">
              <Download size={16} /> CSV
            </NeuButton>
          </div>
        </NeuCard>

        {/* Attendance Export Card */}
        <NeuCard className="p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-neu-bg shadow-neu-small rounded-xl text-neu-accent">
              <Clock size={24} />
            </div>
            <div>
              <h3 className="font-display font-bold text-neu-fg">Attendance Logs</h3>
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
              <h3 className="font-display font-bold text-neu-fg">Leave Requests</h3>
              <p className="text-xs text-neu-muted">{leaveCount} applications logged.</p>
            </div>
          </div>
          <p className="text-sm text-neu-muted">Employee leave applications, classifications, and approvals.</p>
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
          <p className="text-sm text-neu-muted">Immutable system audit trail and user action histories.</p>
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

      {/* DASHBOARD 5: Manual Executive Custom Reports */}
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

      {/* Edit Work Note Modal */}
      <NeuModal isOpen={isEditNoteModalOpen} onClose={() => setIsEditNoteModalOpen(false)} title="Edit Staff Work Notes">
        <form onSubmit={handleSaveUpdatedNoteFromReport} className="space-y-4">
          <p className="text-xs text-neu-muted">
            Staff: <strong className="text-neu-fg">{editingNoteRecord?.employee_name}</strong> | Date: <strong className="text-neu-fg">{editingNoteRecord?.date}</strong>
          </p>
          <NeuInput 
            label="Updated Work Notes / EOD Remarks" 
            placeholder="Enter revised work notes..."
            value={editNoteText}
            onChange={(e) => setEditNoteText(e.target.value)}
            required
          />
          <div className="flex justify-end gap-3 pt-4">
            <NeuButton type="button" variant="secondary" onClick={() => setIsEditNoteModalOpen(false)}>
              Cancel
            </NeuButton>
            <NeuButton type="submit">
              Save Work Notes
            </NeuButton>
          </div>
        </form>
      </NeuModal>

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
