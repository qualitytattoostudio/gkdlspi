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
import { FileText, Calendar, MapPin, CheckCircle, Clock, Plus, Search, Download, Filter, Trash2, Phone, User, Building2, MessageSquare, Send } from 'lucide-react';
import { format, isAfter, subDays, subMonths } from 'date-fns';
import Papa from 'papaparse';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
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
  const [companyName, setCompanyName] = useState('');
  const [place, setPlace] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [mobileNo, setMobileNo] = useState('');
  const [shiftName, setShiftName] = useState('Commercial Service Contract');
  const [supervisorId, setSupervisorId] = useState('');
  const [scheduleDate, setScheduleDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [status, setStatus] = useState('active');

  const fetchSchedules = async () => {
    setLoading(true);
    try {
      const { data: profData } = await supabase.from('profiles').select('id, full_name, role').eq('is_active', true);
      setEmployees(profData || []);
      
      const profileMap = new Map<string, string>();
      (profData || []).forEach(p => { if (p.id) profileMap.set(p.id, p.full_name || 'Supervisor'); });

      const { data: schedData, error } = await supabase
        .from('cleaning_schedules')
        .select('*')
        .order('created_at', { ascending: true });

      if (error) throw error;

      const mapped = (schedData || []).map((s, idx) => ({
        ...s,
        s_no: idx + 1,
        company_name: s.company_name || s.shift_name || 'Client Facility',
        place: s.place || s.location_details || 'Tiruchirappalli',
        contact_person: s.contact_person || 'Facility Manager',
        mobile_no: s.mobile_no || 'N/A',
        supervisor_name: profileMap.get(s.supervisor_id) || 'Executive Operations'
      }));

      setSchedules(mapped);
    } catch (err) {
      console.error('Error fetching contracts:', err);
      setSchedules([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSchedules();

    const channel = supabase
      .channel('realtime_contracts_sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cleaning_schedules' }, () => {
        fetchSchedules();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase]);

  const handleCreateContract = async (e: React.FormEvent) => {
    e.preventDefault();

    const newContract = {
      company_name: companyName,
      place: place,
      location_details: place,
      contact_person: contactPerson,
      mobile_no: mobileNo,
      shift_name: shiftName || `${companyName} Service Contract`,
      supervisor_id: supervisorId || null,
      schedule_date: scheduleDate || null,
      status: status || 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    try {
      const { data, error } = await supabase
        .from('cleaning_schedules')
        .insert([newContract])
        .select('*');

      if (error) throw error;

      if (data) {
        const supervisorName = employees.find(emp => emp.id === supervisorId)?.full_name || 'Executive Operations';
        setSchedules(prev => [...prev, {
          ...data[0],
          s_no: prev.length + 1,
          supervisor_name: supervisorName
        }]);
        playSuccess();
        toast.success('Contract Added', `${companyName} contract has been registered successfully.`);
      }
    } catch (err) {
      console.error('Error creating contract:', err);
      playError();
      toast.error('Creation Failed', 'Could not save the contract.');
    }

    setIsModalOpen(false);
    setCompanyName('');
    setPlace('');
    setContactPerson('');
    setMobileNo('');
    setShiftName('Commercial Service Contract');
    setSupervisorId('');
    setScheduleDate(format(new Date(), 'yyyy-MM-dd'));
    setStatus('active');
  };

  const handleDeleteContract = async (id: string, name: string) => {
    try {
      const { error } = await supabase.from('cleaning_schedules').delete().eq('id', id);
      if (error) throw error;
      setSchedules(prev => prev.filter(s => s.id !== id).map((s, idx) => ({ ...s, s_no: idx + 1 })));
      playSuccess();
      toast.success('Contract Removed', `${name} contract was removed.`);
    } catch (err) {
      playError();
      toast.error('Deletion Failed', 'Could not remove the contract.');
    }
  };

  const handleStatusChange = async (id: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('cleaning_schedules')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;

      setSchedules(prev => prev.map(s => s.id === id ? { ...s, status: newStatus } : s));
      playSuccess();
      toast.success('Status Updated', `Contract status changed to ${newStatus}.`);
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
    return <NeuBadge variant={variant}>{st || 'active'}</NeuBadge>;
  };

  const filtered = schedules.filter(s => {
    const matchesSearch = 
      (s.company_name || '').toLowerCase().includes(search.toLowerCase()) ||
      (s.place || '').toLowerCase().includes(search.toLowerCase()) ||
      (s.contact_person || '').toLowerCase().includes(search.toLowerCase()) ||
      (s.mobile_no || '').includes(search) ||
      (s.shift_name || '').toLowerCase().includes(search.toLowerCase()) ||
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
    const csvData = filtered.map((s, idx) => ({
      'S.NO': idx + 1,
      'COMPANY NAME': s.company_name,
      'PLACE': s.place,
      'CONTACT PERSON': s.contact_person,
      'MOBILE NO': s.mobile_no,
      'SUPERVISOR': s.supervisor_name,
      'STATUS': (s.status || 'ACTIVE').toUpperCase(),
      'DATE': s.schedule_date ? format(new Date(s.schedule_date), 'yyyy-MM-dd') : 'Recurring'
    }));
    const csv = Papa.unparse(csvData);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Client_Contracts_Master_List_${format(new Date(), 'yyyy-MM-dd')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    playSuccess();
    toast.success('CSV Exported', 'Master contracts CSV successfully downloaded.');
  };

  const exportPDF = () => {
    if (filtered.length === 0) {
      toast.warning('No Data', 'There is no data to export.');
      return;
    }
    const doc = new jsPDF('landscape');
    doc.setFontSize(14);
    doc.text('V-Syncer Master Client Contracts & Facility Accounts', 14, 15);
    doc.setFontSize(10);
    doc.text(`Generated: ${format(new Date(), 'yyyy-MM-dd HH:mm')} | Total Registered Accounts: ${filtered.length}`, 14, 22);

    autoTable(doc, {
      startY: 28,
      head: [['S.NO', 'COMPANY NAME', 'PLACE', 'CONTACT PERSON', 'MOBILE NO', 'SUPERVISOR', 'STATUS']],
      body: filtered.map((s, idx) => [
        idx + 1,
        s.company_name,
        s.place,
        s.contact_person,
        s.mobile_no,
        s.supervisor_name,
        (s.status || 'ACTIVE').toUpperCase()
      ]),
      styles: { fontSize: 8, cellPadding: 2.5 },
      headStyles: { fillColor: [15, 76, 129] }
    });

    doc.save(`Master_Client_Contracts_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
    playSuccess();
    toast.success('PDF Exported', 'Master contracts PDF successfully downloaded.');
  };

  const dispatchContractsWhatsApp = () => {
    const summaryLines = filtered.slice(0, 10).map((s, i) => `${i + 1}. *${s.company_name}* (${s.place}) - Contact: ${s.contact_person} (${s.mobile_no})`);
    const text = [
      `📑 *V-SYNCER MASTER CLIENT CONTRACTS LIST*`,
      `📅 *Date:* ${format(new Date(), 'yyyy-MM-dd')}`,
      `🏢 *Total Active Accounts:* ${filtered.length}`,
      `-----------------------------------------`,
      ...summaryLines,
      filtered.length > 10 ? `...and ${filtered.length - 10} more accounts.` : '',
      `-----------------------------------------`,
      `✅ *Verified by V-Syncer Operations Portal*`
    ].filter(Boolean).join('\n');

    const waUrl = `https://api.whatsapp.com/send?phone=919597513372&text=${encodeURIComponent(text)}`;
    window.open(waUrl, '_blank');
    playSuccess();
    toast.success('WhatsApp Dispatched', 'Master contracts summary sent to +91 9597513372.');
  };

  const columns = [
    {
      accessorKey: 's_no',
      header: 'S.No',
      cell: (info: any) => <span className="font-mono font-bold text-neu-muted text-xs">{info.getValue()}</span>
    },
    {
      accessorKey: 'company_name',
      header: 'Company Name',
      cell: (info: any) => (
        <div className="flex items-center gap-2">
          <Building2 size={16} className="text-neu-accent shrink-0" />
          <span className="font-bold text-neu-fg">{info.getValue()}</span>
        </div>
      )
    },
    {
      accessorKey: 'place',
      header: 'Place / Location',
      cell: (info: any) => (
        <div className="flex items-center gap-1.5 text-xs text-neu-muted font-medium">
          <MapPin size={13} className="text-neu-accent shrink-0" />
          <span>{info.getValue()}</span>
        </div>
      )
    },
    {
      accessorKey: 'contact_person',
      header: 'Contact Person',
      cell: (info: any) => (
        <div className="flex items-center gap-1.5 text-xs font-semibold text-neu-fg">
          <User size={13} className="text-neu-muted shrink-0" />
          <span>{info.getValue()}</span>
        </div>
      )
    },
    {
      accessorKey: 'mobile_no',
      header: 'Mobile No',
      cell: (info: any) => (
        <a 
          href={`tel:${info.getValue()}`}
          className="flex items-center gap-1 text-xs font-mono font-bold text-emerald-600 hover:underline"
          title="Call Contact"
        >
          <Phone size={12} className="shrink-0" />
          <span>{info.getValue()}</span>
        </a>
      )
    },
    {
      accessorKey: 'supervisor_name',
      header: 'Supervisor',
      cell: (info: any) => <span className="text-xs text-neu-muted">{info.getValue() || 'Executive Operations'}</span>
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: (info: any) => (
        <div className="flex items-center gap-2">
          <select
            value={info.getValue() || 'active'}
            onChange={(e) => handleStatusChange(info.row.original.id, e.target.value)}
            className="bg-neu-bg shadow-neu-inset-sm text-xs font-bold text-neu-fg rounded-lg px-2 py-1 outline-none cursor-pointer"
          >
            <option value="active">Active</option>
            <option value="scheduled">Scheduled</option>
            <option value="pending">Pending</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <button 
            onClick={() => handleDeleteContract(info.row.original.id, info.row.original.company_name)} 
            className="p-1.5 text-neu-muted hover:text-red-500 hover:scale-110 transition-all cursor-pointer ml-1" 
            title="Delete Contract"
          >
            <Trash2 size={15} />
          </button>
        </div>
      )
    },
  ];

  if (loading) {
    return (
      <div className="space-y-6">
        <h2 className="text-xl font-display font-bold text-neu-fg">Service Schedules & Client Contracts</h2>
        <SkeletonCard className="h-[400px]" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-up">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-xl font-display font-bold text-neu-fg">Master Client Accounts & Service Contracts</h2>
          <p className="text-neu-muted text-sm">Managing all {schedules.length} registered enterprise facility contracts and site locations.</p>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <button 
            onClick={dispatchContractsWhatsApp}
            className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold text-xs flex items-center gap-1.5 shadow-neu-raised transition-all cursor-pointer"
          >
            <Send size={14} />
            Send to WhatsApp (+91 9597513372)
          </button>
          <NeuButton variant="secondary" onClick={exportPDF}>
            <FileText size={16} />
            PDF Export
          </NeuButton>
          <NeuButton variant="secondary" onClick={exportCSV}>
            <Download size={16} />
            CSV Export
          </NeuButton>
          <NeuButton onClick={() => setIsModalOpen(true)}>
            <Plus size={18} />
            Register Contract
          </NeuButton>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <StatCard title="Total Client Accounts" value={schedules.length} icon={Building2} />
        <StatCard title="Active Contracts" value={schedules.filter(s => s.status === 'active' || s.status === 'scheduled').length} icon={CheckCircle} />
        <StatCard title="Coverage Areas & Places" value={new Set(schedules.map(s => s.place)).size} icon={MapPin} />
      </div>

      <NeuCard className="p-4 flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="w-full md:max-w-md">
          <NeuInput 
            placeholder="Search contracts by company name, place, contact person, or phone..." 
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
                { label: 'All Registered', value: 'all' },
                { label: 'Added Today', value: 'today' },
                { label: 'Added This Week', value: 'week' },
                { label: 'Added This Month', value: 'month' },
              ]}
            />
          </div>
        </div>
      </NeuCard>

      {filtered.length === 0 ? (
        <NeuCard>
          <EmptyState 
            icon={Building2} 
            title="No contracts found" 
            description="No client contracts matching your search filter."
            action={
              <NeuButton variant="secondary" onClick={() => setIsModalOpen(true)}>
                <Plus size={18} />
                Register Contract
              </NeuButton>
            }
          />
        </NeuCard>
      ) : (
        <NeuTable data={filtered} columns={columns} />
      )}

      {/* Create / Register Contract Modal */}
      <NeuModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Register Client Service Contract">
        <form onSubmit={handleCreateContract} className="space-y-4">
          <NeuInput 
            label="Company Name" 
            placeholder="e.g. MICRO GLOBAL SYSTEM" 
            value={companyName} 
            onChange={(e) => setCompanyName(e.target.value)} 
            required 
          />

          <NeuInput 
            label="Place / Location" 
            placeholder="e.g. CANTONMENT" 
            value={place} 
            onChange={(e) => setPlace(e.target.value)} 
            required 
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <NeuInput 
              label="Contact Person" 
              placeholder="e.g. YOGESH" 
              value={contactPerson} 
              onChange={(e) => setContactPerson(e.target.value)} 
              required 
            />

            <NeuInput 
              label="Mobile Number" 
              placeholder="e.g. 9942157702" 
              value={mobileNo} 
              onChange={(e) => setMobileNo(e.target.value)} 
              required 
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <NeuSelect 
              label="Assigned Supervisor" 
              options={[
                { label: 'General Operations Pool', value: '' },
                ...employees.map(e => ({ label: `${e.full_name || 'Staff'} (${e.role || 'Staff'})`, value: e.id }))
              ]} 
              value={supervisorId}
              onChange={(e) => setSupervisorId(e.target.value)}
            />

            <NeuSelect 
              label="Contract Status" 
              options={[
                { label: 'Active', value: 'active' },
                { label: 'Scheduled', value: 'scheduled' },
                { label: 'Pending', value: 'pending' },
              ]} 
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <NeuButton type="button" variant="secondary" onClick={() => setIsModalOpen(false)}>
              Cancel
            </NeuButton>
            <NeuButton type="submit">
              Register Contract
            </NeuButton>
          </div>
        </form>
      </NeuModal>
    </div>
  );
}
