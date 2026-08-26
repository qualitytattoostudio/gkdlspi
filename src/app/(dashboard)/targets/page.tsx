'use client';

import React, { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { NeuCard } from '@/components/neu/NeuCard';
import { NeuButton } from '@/components/neu/NeuButton';
import { NeuInput } from '@/components/neu/NeuInput';
import { NeuSelect } from '@/components/neu/NeuSelect';
import { NeuModal } from '@/components/neu/NeuModal';
import { NeuBadge, BadgeVariant } from '@/components/neu/NeuBadge';
import { EmptyState } from '@/components/neu/EmptyState';
import { SkeletonCard } from '@/components/neu/SkeletonCard';
import { StatCard } from '@/components/neu/StatCard';
import { Target, Award, CheckCircle, Plus, TrendingUp, Users, Calendar, Trash2, Flag, CheckSquare, Download, FileText } from 'lucide-react';
import { format } from 'date-fns';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import Papa from 'papaparse';
import { toast } from '@/store/toastStore';
import { playSuccess, playError } from '@/lib/audio';

export default function TargetsPage() {
  const supabase = createClient();
  const [goals, setGoals] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [milestonesMap, setMilestonesMap] = useState<Record<string, any[]>>({});
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isMilestoneModalOpen, setIsMilestoneModalOpen] = useState(false);
  const [selectedGoalForMilestone, setSelectedGoalForMilestone] = useState<any>(null);

  // Form State for Goal Allocation
  const [employeeId, setEmployeeId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [goalType, setGoalType] = useState('revenue');
  const [targetValue, setTargetValue] = useState('');
  const [dueDate, setDueDate] = useState(format(new Date(Date.now() + 30 * 86400000), 'yyyy-MM-dd'));

  // Form State for Milestone Creation
  const [milestoneTitle, setMilestoneTitle] = useState('');
  const [milestoneTargetValue, setMilestoneTargetValue] = useState('');

  useEffect(() => {
    async function fetchGoalsAndMilestones() {
      setLoading(true);
      try {
        // Fetch profiles for employee selection dropdown
        const { data: profData } = await supabase
          .from('profiles')
          .select('id, full_name, role')
          .eq('is_active', true)
          .order('full_name', { ascending: true });

        setEmployees(profData || []);
        if (profData && profData.length > 0) {
          setEmployeeId(profData[0].id);
        }

        const profileMap = new Map<string, string>();
        (profData || []).forEach(p => {
          if (p.id) profileMap.set(p.id, p.full_name || 'Employee');
        });

        // Query employee_goals
        const { data: goalData, error } = await supabase
          .from('employee_goals')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) throw error;

        // Query goal_milestones table
        const { data: msData } = await supabase
          .from('goal_milestones')
          .select('*')
          .order('created_at', { ascending: true });

        const msMap: Record<string, any[]> = {};
        (msData || []).forEach(m => {
          if (!msMap[m.goal_id]) msMap[m.goal_id] = [];
          msMap[m.goal_id].push(m);
        });
        setMilestonesMap(msMap);

        const mapped = (goalData || []).map(g => ({
          ...g,
          employee_name: profileMap.get(g.employee_id) || 'Staff Member',
          assigned_by_name: profileMap.get(g.assigned_by) || 'Manager',
        }));

        setGoals(mapped);
      } catch (err) {
        console.error('Error fetching employee_goals:', err);
        setGoals([]);
      } finally {
        setLoading(false);
      }
    }
    fetchGoalsAndMilestones();

    // Supabase Realtime Subscription for automatic v-attendee sync
    const goalsChannel = supabase
      .channel('realtime_goals')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'employee_goals' }, (payload) => {
        if (payload.eventType === 'UPDATE') {
          setGoals(prev => prev.map(g => g.id === payload.new.id ? { ...g, ...payload.new } : g));
        } else if (payload.eventType === 'INSERT') {
          setGoals(prev => [payload.new, ...prev]);
        } else if (payload.eventType === 'DELETE') {
          setGoals(prev => prev.filter(g => g.id !== payload.old.id));
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'goal_milestones' }, (payload) => {
        if (payload.eventType === 'UPDATE' || payload.eventType === 'INSERT') {
          const goalId = payload.new.goal_id;
          if (goalId) {
            setMilestonesMap(prev => {
              const currentList = prev[goalId] || [];
              const exists = currentList.some(m => m.id === payload.new.id);
              const newList = exists 
                ? currentList.map(m => m.id === payload.new.id ? payload.new : m)
                : [...currentList, payload.new];
              return { ...prev, [goalId]: newList };
            });
          }
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(goalsChannel);
    };
  }, [supabase]);

  const handleAllocateGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    const { data: { user } } = await supabase.auth.getUser();

    const empName = employees.find(e => e.id === employeeId)?.full_name || 'Staff Member';

    const newGoalPayload = {
      employee_id: employeeId || null,
      title,
      description,
      goal_type: goalType,
      target_value: parseFloat(targetValue) || 100,
      current_value: 0,
      currency: 'INR',
      status: 'active',
      due_date: dueDate,
      assigned_by: user?.id || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    try {
      const { data, error } = await supabase
        .from('employee_goals')
        .insert([newGoalPayload])
        .select('*');

      if (!error && data && data.length > 0) {
        setGoals(prev => [{
          ...data[0],
          employee_name: empName,
          assigned_by_name: 'Manager'
        }, ...prev]);
        playSuccess();
        toast.success('Goal Allocated', 'Target assigned to staff member.');
      } else {
        setGoals(prev => [{
          id: `G-${Date.now()}`,
          ...newGoalPayload,
          employee_name: empName,
          assigned_by_name: 'Manager'
        }, ...prev]);
      }
    } catch (err) {
      console.error('Goal allocation error:', err);
      playError();
    }

    setIsModalOpen(false);
    setTitle('');
    setDescription('');
    setTargetValue('');
  };

  const handleAddMilestone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGoalForMilestone) return;

    const goalId = selectedGoalForMilestone.id;
    const newMsPayload = {
      goal_id: goalId,
      title: milestoneTitle,
      target_value: parseFloat(milestoneTargetValue) || 0,
      is_completed: false,
      created_at: new Date().toISOString(),
    };

    try {
      const { data, error } = await supabase
        .from('goal_milestones')
        .insert([newMsPayload])
        .select('*');

      if (!error && data && data.length > 0) {
        setMilestonesMap(prev => ({
          ...prev,
          [goalId]: [...(prev[goalId] || []), data[0]]
        }));
        playSuccess();
        toast.success('Milestone Saved', 'Milestone added to target.');
      } else {
        setMilestonesMap(prev => ({
          ...prev,
          [goalId]: [...(prev[goalId] || []), { id: `MS-${Date.now()}`, ...newMsPayload }]
        }));
      }
    } catch (err) {
      console.error('Milestone add error:', err);
      playError();
    }

    setIsMilestoneModalOpen(false);
    setMilestoneTitle('');
    setMilestoneTargetValue('');
  };

  const handleToggleMilestone = async (goalId: string, milestoneId: string, currentCompleted: boolean) => {
    const nextState = !currentCompleted;
    try {
      await supabase
        .from('goal_milestones')
        .update({ 
          is_completed: nextState, 
          achieved_at: nextState ? new Date().toISOString() : null 
        })
        .eq('id', milestoneId);
    } catch (err) {
      console.error('Milestone update error:', err);
    }

    // Update local milestones map
    const updatedMilestones = (milestonesMap[goalId] || []).map(m => m.id === milestoneId ? { ...m, is_completed: nextState } : m);
    setMilestonesMap(prev => ({
      ...prev,
      [goalId]: updatedMilestones
    }));

    // Recalculate target current_value based on completed milestones
    const targetGoal = goals.find(g => g.id === goalId);
    if (targetGoal) {
      const completedValue = updatedMilestones.reduce((acc, m) => {
        if (m.is_completed) {
          return acc + (Number(m.target_value) || 0);
        }
        return acc;
      }, 0);

      const totalMilestonesCount = updatedMilestones.length;
      const completedMilestonesCount = updatedMilestones.filter(m => m.is_completed).length;

      let newCurrentValue = completedValue;
      if (completedValue === 0 && totalMilestonesCount > 0) {
        newCurrentValue = Math.round((completedMilestonesCount / totalMilestonesCount) * Number(targetGoal.target_value));
      }

      try {
        await supabase
          .from('employee_goals')
          .update({ 
            current_value: newCurrentValue,
            status: newCurrentValue >= Number(targetGoal.target_value) ? 'completed' : 'active',
            updated_at: new Date().toISOString()
          })
          .eq('id', goalId);
      } catch (err) {
        console.error('Goal current_value update error:', err);
      }

      setGoals(prev => prev.map(g => g.id === goalId ? { 
        ...g, 
        current_value: newCurrentValue,
        status: newCurrentValue >= Number(targetGoal.target_value) ? 'completed' : 'active'
      } : g));
    }
  };

  const handleDeleteGoal = async (id: string) => {
    try {
      await supabase.from('employee_goals').delete().eq('id', id);
      setGoals(goals.filter(g => g.id !== id));
      playSuccess();
      toast.success('Goal Removed', 'Target has been deleted.');
    } catch {
      playError();
      toast.error('Deletion Failed', 'Could not delete target.');
    }
  };

  const exportGoalsPDF = () => {
    if (goals.length === 0) {
      toast.warning('No Goals', 'There are no goals to export.');
      return;
    }
    const doc = new jsPDF();
    doc.text('V-Syncer Operations — Employee Target & Goals Report', 14, 15);
    doc.setFontSize(10);
    doc.text(`Generated: ${format(new Date(), 'yyyy-MM-dd HH:mm')} | Total Targets: ${goals.length}`, 14, 22);

    autoTable(doc, {
      startY: 28,
      head: [['Employee', 'Goal Title', 'Metric Type', 'Target Value', 'Progress', 'Status', 'Due Date']],
      body: goals.map(g => {
        const milestones = milestonesMap[g.id] || [];
        let cur = Number(g.current_value) || 0;
        const tgt = Number(g.target_value) || 1;
        if (milestones.length > 0) {
          const completedVal = milestones.reduce((sum, m) => m.is_completed ? sum + (Number(m.target_value) || 0) : sum, 0);
          if (completedVal > 0) cur = completedVal;
        }
        const pct = Math.min(Math.round((cur / tgt) * 100), 100);

        return [
          g.employee_name || 'Staff Member',
          g.title || 'Goal',
          g.goal_type || 'Target',
          `${tgt}`,
          `${cur} (${pct}%)`,
          (g.status || 'active').toUpperCase(),
          g.due_date ? format(new Date(g.due_date), 'yyyy-MM-dd') : 'No Deadline'
        ];
      })
    });
    doc.save(`Target_Performance_Report_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
    playSuccess();
    toast.success('PDF Downloaded', 'Target performance report downloaded as PDF.');
  };

  const exportGoalsCSV = () => {
    if (goals.length === 0) {
      toast.warning('No Goals', 'There are no goals to export.');
      return;
    }
    const csvData = goals.map(g => {
      const milestones = milestonesMap[g.id] || [];
      let cur = Number(g.current_value) || 0;
      const tgt = Number(g.target_value) || 1;
      if (milestones.length > 0) {
        const completedVal = milestones.reduce((sum, m) => m.is_completed ? sum + (Number(m.target_value) || 0) : sum, 0);
        if (completedVal > 0) cur = completedVal;
      }
      const pct = Math.min(Math.round((cur / tgt) * 100), 100);

      return {
        Employee: g.employee_name,
        GoalTitle: g.title,
        Description: g.description || 'N/A',
        MetricType: g.goal_type,
        TargetValue: tgt,
        CurrentValue: cur,
        ProgressPercentage: `${pct}%`,
        Status: g.status,
        DueDate: g.due_date,
        AssignedBy: g.assigned_by_name
      };
    });

    const csv = Papa.unparse(csvData);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Target_Performance_Report_${format(new Date(), 'yyyy-MM-dd')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    playSuccess();
    toast.success('CSV Downloaded', 'Target performance report downloaded as CSV.');
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <h2 className="text-xl font-display font-bold text-neu-fg">Employee Goals & Target Allocation</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => <SkeletonCard key={i} className="h-32" />)}
        </div>
        <SkeletonCard className="h-[400px]" />
      </div>
    );
  }

  const activeGoalsCount = goals.filter(g => g.status === 'active').length;
  const completedGoalsCount = goals.filter(g => g.status === 'completed' || Number(g.current_value) >= Number(g.target_value)).length;

  return (
    <div className="space-y-6 animate-fade-up">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-xl font-display font-bold text-neu-fg">Goal Allocation & Target Management</h2>
          <p className="text-neu-muted text-sm">Directly synchronized with v-attendee `employee_goals` and `goal_milestones` tables ({goals.length} goals allocated).</p>
        </div>
        <div className="flex gap-2.5">
          <NeuButton onClick={exportGoalsPDF} variant="secondary">
            <FileText size={16} />
            PDF Report
          </NeuButton>
          <NeuButton onClick={exportGoalsCSV} variant="secondary">
            <Download size={16} />
            CSV Export
          </NeuButton>
          <NeuButton onClick={() => setIsModalOpen(true)}>
            <Plus size={18} />
            Allocate Goal to Staff
          </NeuButton>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <StatCard title="Total Goals Allocated" value={goals.length} icon={Target} />
        <StatCard title="Active In-Progress Goals" value={activeGoalsCount} icon={TrendingUp} />
        <StatCard title="Completed / Achieved" value={completedGoalsCount} icon={CheckCircle} />
      </div>

      {/* Goal Cards */}
      {goals.length === 0 ? (
        <NeuCard>
          <EmptyState 
            icon={Target} 
            title="No employee goals allocated" 
            description="No targets or goals assigned in the v-attendee database yet."
            action={
              <NeuButton variant="secondary" onClick={() => setIsModalOpen(true)}>
                <Plus size={18} />
                Allocate Goal to Staff
              </NeuButton>
            }
          />
        </NeuCard>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {goals.map((g) => {
            const milestones = milestonesMap[g.id] || [];
            let cur = Number(g.current_value) || 0;
            const tgt = Number(g.target_value) || 1;

            if (milestones.length > 0) {
              const completedVal = milestones.reduce((sum, m) => m.is_completed ? sum + (Number(m.target_value) || 0) : sum, 0);
              if (completedVal > 0) {
                cur = completedVal;
              } else {
                const doneCount = milestones.filter(m => m.is_completed).length;
                cur = Math.round((doneCount / milestones.length) * tgt);
              }
            }

            const pct = Math.min(Math.round((cur / tgt) * 100), 100);
            const isCurrency = g.currency === 'INR' || g.goal_type === 'revenue';

            return (
              <NeuCard key={g.id} className="p-6 flex flex-col justify-between space-y-4 hover:shadow-neu-lifted transition-all">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-neu-accent">{g.goal_type || 'Target'}</span>
                      <NeuBadge variant={g.status === 'active' ? 'warning' : 'success'}>{g.status || 'Active'}</NeuBadge>
                    </div>
                    <h3 className="font-display font-bold text-lg text-neu-fg mt-1">{g.title || 'Goal Title'}</h3>
                    {g.description && <p className="text-xs text-neu-muted mt-1">{g.description}</p>}
                  </div>
                  <button 
                    onClick={() => handleDeleteGoal(g.id)}
                    className="p-1.5 text-neu-muted hover:text-red-500 transition-all cursor-pointer"
                    title="Remove Goal"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>

                <div className="p-3 bg-neu-bg shadow-neu-inset-sm rounded-xl space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-neu-fg flex items-center gap-1">
                      <Users size={14} className="text-neu-accent" /> {g.employee_name}
                    </span>
                    <span className="text-neu-muted font-medium">
                      Target: {isCurrency ? `₹${tgt.toLocaleString()}` : `${tgt}`}
                    </span>
                  </div>

                  <div className="flex justify-between items-baseline text-xs pt-1">
                    <span className="text-neu-muted">Progress ({pct}%)</span>
                    <span className="font-display font-bold text-neu-fg">
                      {isCurrency ? `₹${cur.toLocaleString()}` : cur} / {isCurrency ? `₹${tgt.toLocaleString()}` : tgt}
                    </span>
                  </div>

                  {/* Neumorphic Progress Track */}
                  <div className="w-full h-3.5 rounded-full bg-neu-bg shadow-neu-inset p-0.5 overflow-hidden">
                    <div 
                      className="h-full rounded-full bg-gradient-to-r from-neu-accent to-neu-accent-secondary transition-all duration-700 ease-out shadow-neu-small"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>

                {/* Target Milestones Sub-Section */}
                <div className="space-y-2 pt-2 border-t border-neu-muted/10">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-neu-fg flex items-center gap-1">
                      <Flag size={14} className="text-neu-accent" /> Target Milestones ({milestones.length})
                    </span>
                    <button
                      onClick={() => {
                        setSelectedGoalForMilestone(g);
                        setIsMilestoneModalOpen(true);
                      }}
                      className="text-[11px] font-bold text-neu-accent hover:underline flex items-center gap-0.5 cursor-pointer"
                    >
                      <Plus size={12} /> Add Milestone
                    </button>
                  </div>

                  {milestones.length === 0 ? (
                    <p className="text-[11px] text-neu-muted italic">No milestones added for this target yet.</p>
                  ) : (
                    <div className="space-y-1.5 max-h-32 overflow-y-auto scrollbar-hide">
                      {milestones.map((ms) => (
                        <div key={ms.id} className="flex items-center justify-between p-2 rounded-lg bg-neu-bg shadow-neu-inset-sm text-xs">
                          <button
                            onClick={() => handleToggleMilestone(g.id, ms.id, ms.is_completed)}
                            className="flex items-center gap-2 text-left cursor-pointer hover:opacity-80 transition-opacity"
                          >
                            <CheckSquare size={14} className={ms.is_completed ? 'text-emerald-500' : 'text-neu-muted'} />
                            <span className={ms.is_completed ? 'line-through text-neu-muted font-medium' : 'font-bold text-neu-fg'}>
                              {ms.title}
                            </span>
                          </button>
                          {ms.target_value > 0 && (
                            <span className="text-[10px] font-bold text-neu-accent bg-neu-accent/10 px-2 py-0.5 rounded-full">
                              {isCurrency ? `₹${ms.target_value}` : ms.target_value}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex justify-between items-center text-[11px] text-neu-muted pt-2 border-t border-neu-muted/10">
                  <span className="flex items-center gap-1">
                    <Calendar size={12} /> Due: {g.due_date ? format(new Date(g.due_date), 'MMM dd, yyyy') : 'No deadline'}
                  </span>
                  <span>Allocated by: {g.assigned_by_name}</span>
                </div>
              </NeuCard>
            );
          })}
        </div>
      )}

      {/* Allocate Goal Modal */}
      <NeuModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Allocate Goal / Target to Staff">
        <form onSubmit={handleAllocateGoal} className="space-y-4">
          <NeuSelect 
            label="Assign to Employee (Profiles)" 
            options={employees.map(e => ({ label: `${e.full_name || 'Staff'} (${e.role || 'Member'})`, value: e.id }))} 
            value={employeeId}
            onChange={(e) => setEmployeeId(e.target.value)}
          />
          <NeuInput 
            label="Goal Title" 
            placeholder="e.g. Q3 Revenue Target / 50 Completed Jobs" 
            value={title} 
            onChange={(e) => setTitle(e.target.value)} 
            required 
          />
          <NeuSelect 
            label="Goal Metric Type" 
            options={[
              { label: 'Revenue Target (INR)', value: 'revenue' },
              { label: 'Work Orders Completed (Jobs)', value: 'jobs' },
              { label: 'Attendance Rate (%)', value: 'attendance' },
              { label: 'Quality Score (/5)', value: 'quality' },
            ]} 
            value={goalType}
            onChange={(e) => setGoalType(e.target.value)}
          />
          <NeuInput 
            label="Target Value" 
            type="number"
            placeholder="e.g. 50000 or 50" 
            value={targetValue} 
            onChange={(e) => setTargetValue(e.target.value)} 
            required 
          />
          <NeuInput 
            label="Due Date" 
            type="date"
            value={dueDate} 
            onChange={(e) => setDueDate(e.target.value)} 
            required 
          />
          <NeuInput 
            label="Description / KPI Instructions" 
            placeholder="Enter goal milestones or notes..." 
            value={description} 
            onChange={(e) => setDescription(e.target.value)} 
          />
          <div className="flex justify-end gap-3 pt-4">
            <NeuButton type="button" variant="secondary" onClick={() => setIsModalOpen(false)}>
              Cancel
            </NeuButton>
            <NeuButton type="submit">
              Allocate Goal
            </NeuButton>
          </div>
        </form>
      </NeuModal>

      {/* Add Milestone Modal */}
      <NeuModal isOpen={isMilestoneModalOpen} onClose={() => setIsMilestoneModalOpen(false)} title={`Add Milestone to Target`}>
        <form onSubmit={handleAddMilestone} className="space-y-4">
          <p className="text-xs text-neu-muted font-medium">
            Adding milestone for: <span className="font-bold text-neu-fg">{selectedGoalForMilestone?.title}</span> ({selectedGoalForMilestone?.employee_name})
          </p>
          <NeuInput 
            label="Milestone Title" 
            placeholder="e.g. Phase 1: Complete 25 Sites / Achieve ₹25,000" 
            value={milestoneTitle} 
            onChange={(e) => setMilestoneTitle(e.target.value)} 
            required 
          />
          <NeuInput 
            label="Milestone Target Value" 
            type="number"
            placeholder="e.g. 25000" 
            value={milestoneTargetValue} 
            onChange={(e) => setMilestoneTargetValue(e.target.value)} 
          />
          <div className="flex justify-end gap-3 pt-4">
            <NeuButton type="button" variant="secondary" onClick={() => setIsMilestoneModalOpen(false)}>
              Cancel
            </NeuButton>
            <NeuButton type="submit">
              Save Milestone
            </NeuButton>
          </div>
        </form>
      </NeuModal>
    </div>
  );
}
