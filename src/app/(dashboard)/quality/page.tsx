'use client';

import React, { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { NeuCard } from '@/components/neu/NeuCard';
import { NeuButton } from '@/components/neu/NeuButton';
import { NeuInput } from '@/components/neu/NeuInput';
import { NeuSelect } from '@/components/neu/NeuSelect';
import { NeuTable } from '@/components/neu/NeuTable';
import { EmptyState } from '@/components/neu/EmptyState';
import { SkeletonCard } from '@/components/neu/SkeletonCard';
import { StatCard } from '@/components/neu/StatCard';
import { NeuModal } from '@/components/neu/NeuModal';
import { CheckCircle, Star, Plus, Search, Award, Download, Filter, Trash2 } from 'lucide-react';
import { format, isAfter, subDays, subMonths } from 'date-fns';
import Papa from 'papaparse';
import { toast } from '@/store/toastStore';
import { playSuccess, playError } from '@/lib/audio';

export default function QualityPage() {
  const supabase = createClient();
  const [audits, setAudits] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [timeFilter, setTimeFilter] = useState('all');
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form State
  const [auditorId, setAuditorId] = useState('');
  const [score, setScore] = useState('5');
  const [remarks, setRemarks] = useState('');
  const [auditDate, setAuditDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  useEffect(() => {
    async function fetchQualityData() {
      setLoading(true);
      try {
        const { data: profData } = await supabase.from('profiles').select('id, full_name, role').eq('is_active', true);
        setEmployees(profData || []);
        if (profData && profData.length > 0) setAuditorId(profData[0].id);

        const profileMap = new Map<string, string>();
        (profData || []).forEach(p => { if (p.id) profileMap.set(p.id, p.full_name || 'Inspector'); });

        const { data: auditData, error } = await supabase
          .from('quality_audits')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) throw error;

        const mapped = (auditData || []).map(a => ({
          ...a,
          auditor_name: profileMap.get(a.auditor_id) || 'Quality Auditor'
        }));

        setAudits(mapped);
      } catch (err) {
        console.error('Error fetching quality audits:', err);
        setAudits([]);
      } finally {
        setLoading(false);
      }
    }
    fetchQualityData();
  }, [supabase]);

  const handleCreateAudit = async (e: React.FormEvent) => {
    e.preventDefault();

    const newAudit = {
      auditor_id: auditorId || null,
      score: parseInt(score) || 5,
      remarks,
      audit_date: auditDate,
      created_at: new Date().toISOString(),
    };

    try {
      const { data, error } = await supabase
        .from('quality_audits')
        .insert([newAudit])
        .select('*');

      if (!error && data) {
        const auditorName = employees.find(e => e.id === auditorId)?.full_name || 'Inspector';
        setAudits([{
          ...data[0],
          auditor_name: auditorName
        }, ...audits]);
        playSuccess();
        toast.success('Audit Logged', 'Quality inspection record saved successfully.');
      } else {
        throw error;
      }
    } catch (err) {
      console.error('Error recording audit:', err);
      playError();
      toast.error('Logging Failed', 'Could not record the audit data.');
    }

    setIsModalOpen(false);
    setRemarks('');
  };

  const handleDeleteAudit = async (id: string) => {
    try {
      const { error } = await supabase.from('quality_audits').delete().eq('id', id);
      if (error) throw error;
      setAudits(audits.filter(a => a.id !== id));
      playSuccess();
      toast.success('Record Deleted', 'Audit record has been removed.');
    } catch (err) {
      console.error(err);
      playError();
      toast.error('Deletion Failed', 'Could not remove the record.');
    }
  };

  const filtered = audits.filter(a => {
    const matchesSearch = 
      (a.remarks || '').toLowerCase().includes(search.toLowerCase()) ||
      (a.auditor_name || '').toLowerCase().includes(search.toLowerCase());

    let matchesTime = true;
    if (timeFilter === 'today') {
      matchesTime = isAfter(new Date(a.created_at), subDays(new Date(), 1));
    } else if (timeFilter === 'week') {
      matchesTime = isAfter(new Date(a.created_at), subDays(new Date(), 7));
    } else if (timeFilter === 'month') {
      matchesTime = isAfter(new Date(a.created_at), subMonths(new Date(), 1));
    }

    return matchesSearch && matchesTime;
  });

  const exportCSV = () => {
    if (filtered.length === 0) {
      toast.warning('No Data', 'There is no data to export.');
      return;
    }
    const csvData = filtered.map(a => ({
      'Inspector': a.auditor_name,
      'Score (out of 5)': a.score,
      'Remarks': a.remarks,
      'Audit Date': a.audit_date,
      'Logged Date': a.created_at ? format(new Date(a.created_at), 'MMM dd, yyyy HH:mm') : 'N/A'
    }));
    const csv = Papa.unparse(csvData);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `quality_audits_report_${format(new Date(), 'yyyy-MM-dd')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    playSuccess();
    toast.success('Export Successful', 'Your CSV file has been downloaded.');
  };

  const avgScore = audits.length > 0
    ? (audits.reduce((acc, curr) => acc + (curr.score || 0), 0) / audits.length).toFixed(1)
    : '5.0';

  const columns = [
    {
      accessorKey: 'auditor_name',
      header: 'Inspector / Auditor',
      cell: (info: any) => <span className="font-bold text-neu-fg">{info.getValue() || 'Quality Inspector'}</span>
    },
    {
      accessorKey: 'score',
      header: 'Audit Score',
      cell: (info: any) => {
        const val = info.getValue() || 5;
        return (
          <div className="flex items-center gap-1 font-bold text-amber-500">
            <span>{val} / 5</span>
            <Star size={14} className="fill-amber-400" />
          </div>
        );
      }
    },
    {
      accessorKey: 'remarks',
      header: 'Inspection Remarks',
      cell: (info: any) => <span className="text-xs text-neu-muted line-clamp-1">{info.getValue() || 'Passed inspection'}</span>
    },
    {
      accessorKey: 'audit_date',
      header: 'Audit Date',
      cell: (info: any) => info.getValue() ? format(new Date(info.getValue()), 'MMM dd, yyyy') : 'N/A'
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: (info: any) => (
        <button 
          onClick={() => handleDeleteAudit(info.row.original.id)} 
          className="p-1.5 text-neu-muted hover:text-red-500 hover:scale-110 transition-all cursor-pointer" 
          title="Delete Record"
        >
          <Trash2 size={16} />
        </button>
      )
    }
  ];

  if (loading) {
    return (
      <div className="space-y-6">
        <h2 className="text-xl font-display font-bold text-neu-fg">Quality Audits & Inspection</h2>
        <SkeletonCard className="h-[400px]" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-up">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-xl font-display font-bold text-neu-fg">Quality Audits & Inspection</h2>
          <p className="text-neu-muted text-sm">Directly synchronized with database `quality_audits` table ({audits.length} audits logged).</p>
        </div>
        <NeuButton onClick={() => setIsModalOpen(true)}>
          <Plus size={18} />
          Record Quality Audit
        </NeuButton>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <StatCard title="Total Audits" value={audits.length} icon={CheckCircle} />
        <StatCard title="Average Quality Score" value={Number(avgScore)} prefix="" icon={Star} />
        <StatCard title="Compliance Rate" value={100} suffix="%" icon={Award} />
      </div>

      <NeuCard className="p-4 flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="w-full md:max-w-md">
          <NeuInput 
            placeholder="Search remarks or inspectors..." 
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
                { label: 'Logged Today', value: 'today' },
                { label: 'Logged This Week', value: 'week' },
                { label: 'Logged This Month', value: 'month' },
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
            icon={CheckCircle} 
            title="No quality audits recorded" 
            description="No quality inspection records found in the database matching your search."
            action={
              <NeuButton variant="secondary" onClick={() => setIsModalOpen(true)}>
                <Plus size={18} />
                Record Quality Audit
              </NeuButton>
            }
          />
        </NeuCard>
      ) : (
        <NeuTable data={filtered} columns={columns} />
      )}

      {/* Record Audit Modal */}
      <NeuModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Record Quality Inspection Audit">
        <form onSubmit={handleCreateAudit} className="space-y-4">
          <NeuSelect 
            label="Inspector / Auditor" 
            options={employees.map(e => ({ label: `${e.full_name || 'Staff'} (${e.role || 'Member'})`, value: e.id }))} 
            value={auditorId}
            onChange={(e) => setAuditorId(e.target.value)}
          />
          <NeuSelect 
            label="Audit Rating Score" 
            options={[
              { label: '5 Stars — Excellent / Perfect', value: '5' },
              { label: '4 Stars — Good / Acceptable', value: '4' },
              { label: '3 Stars — Average / Needs Improvement', value: '3' },
              { label: '2 Stars — Poor / Unsatisfactory', value: '2' },
              { label: '1 Star — Fail / Re-inspection Needed', value: '1' },
            ]} 
            value={score}
            onChange={(e) => setScore(e.target.value)}
          />
          <NeuInput 
            label="Audit Date" 
            type="date"
            value={auditDate} 
            onChange={(e) => setAuditDate(e.target.value)} 
            required 
          />
          <NeuInput 
            label="Inspection Remarks / Notes" 
            placeholder="Detailed quality audit findings..." 
            value={remarks} 
            onChange={(e) => setRemarks(e.target.value)} 
            required
          />
          <div className="flex justify-end gap-3 pt-4">
            <NeuButton type="button" variant="secondary" onClick={() => setIsModalOpen(false)}>
              Cancel
            </NeuButton>
            <NeuButton type="submit">
              Save Quality Audit
            </NeuButton>
          </div>
        </form>
      </NeuModal>
    </div>
  );
}
