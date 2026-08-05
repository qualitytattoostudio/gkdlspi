'use client';

import React, { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { NeuCard } from '@/components/neu/NeuCard';
import { StatCard } from '@/components/neu/StatCard';
import { NeuBadge } from '@/components/neu/NeuBadge';
import { SkeletonCard } from '@/components/neu/SkeletonCard';
import { IndianRupee, TrendingUp, TrendingDown, Wallet, Users, BarChart } from 'lucide-react';
import { format } from 'date-fns';

export default function FinancialsPage() {
  const supabase = createClient();
  const [accounts, setAccounts] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [cashCollections, setCashCollections] = useState<any[]>([]);
  const [leaves, setLeaves] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchFinancials() {
      setLoading(true);
      try {
        const [
          { data: accData },
          { data: erpData },
          { data: leaveData },
        ] = await Promise.all([
          supabase.from('accounts').select('*'),
          supabase.from('erp_transactions').select('*').order('created_at', { ascending: false }),
          supabase.from('leave_requests').select('*').order('created_at', { ascending: false }),
        ]);

        setAccounts(accData || []);
        
        const expensesData = (erpData || []).filter((e: any) => e.type === 'expense').map((e: any) => ({
          id: e.id,
          title: e.description || e.main_category,
          date: e.transaction_date || e.created_at,
          amount: Number(e.amount) || 0
        }));
        
        const incomeData = (erpData || []).filter((e: any) => e.type !== 'expense').map((e: any) => ({
          id: e.id,
          notes: e.description || 'Income/Cash',
          recorded_at: e.transaction_date || e.created_at,
          amount: Number(e.amount) || 0
        }));

        setExpenses(expensesData);
        setCashCollections(incomeData);
        setLeaves(leaveData || []);
      } catch (err) {
        console.error('Error fetching financials:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchFinancials();
  }, [supabase]);

  const totalAllocatedBudget = accounts.reduce((s, a) => s + Number(a.allocated_funding || 0), 0);
  const totalExpenses = expenses.reduce((s, e) => s + Number(e.amount || 0), 0);
  const totalCashCollected = cashCollections.reduce((s, c) => s + Number(c.amount || 0), 0);
  const netBalance = totalAllocatedBudget - totalExpenses + totalCashCollected;
  const pendingLeaves = leaves.filter(l => l.status === 'pending').length;

  if (loading) {
    return (
      <div className="space-y-6">
        <h2 className="text-xl font-display font-bold text-neu-fg">Financial Overview</h2>
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
        <h2 className="text-xl font-display font-bold text-neu-fg">Financial Overview</h2>
        <p className="text-neu-muted text-sm">Synced from accounts, expenses, and cash collections tables in real-time.</p>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title="Allocated Budget" value={totalAllocatedBudget} prefix="₹" icon={Wallet} />
        <StatCard title="Total Expenses" value={totalExpenses} prefix="₹" icon={TrendingDown} />
        <StatCard title="Cash Collected" value={totalCashCollected} prefix="₹" icon={TrendingUp} />
        <StatCard title="Net Position" value={netBalance} prefix="₹" icon={IndianRupee} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Budget Accounts */}
        <NeuCard className="p-6">
          <h3 className="font-display font-bold text-neu-fg mb-4 flex items-center gap-2">
            <BarChart size={18} className="text-neu-accent" /> Budget Allocations
          </h3>
          {accounts.length === 0 ? (
            <p className="text-neu-muted text-sm text-center py-8">No budget accounts configured yet.</p>
          ) : (
            <div className="space-y-4">
              {accounts.map(a => (
                <div key={a.id} className="p-4 bg-neu-bg shadow-neu-inset-sm rounded-xl">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="font-bold text-neu-fg">{a.name || 'Budget Account'}</p>
                      <p className="text-xs text-neu-muted">{a.description || 'General Operations'}</p>
                    </div>
                    <span className="font-display font-black text-lg text-neu-accent">₹{Number(a.allocated_funding || 0).toLocaleString()}</span>
                  </div>
                  {a.allocated_person && (
                    <p className="text-xs text-neu-muted flex items-center gap-1">
                      <Users size={12} /> Managed by: {a.allocated_person}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </NeuCard>

        {/* Recent Expenses & Cash */}
        <NeuCard className="p-6">
          <h3 className="font-display font-bold text-neu-fg mb-4 flex items-center gap-2">
            <IndianRupee size={18} className="text-neu-accent" /> Recent Financial Activity
          </h3>
          <div className="space-y-3 max-h-[340px] overflow-y-auto scrollbar-hide">
            {expenses.length === 0 && cashCollections.length === 0 ? (
              <p className="text-neu-muted text-sm text-center py-8">No financial transactions recorded yet.</p>
            ) : (
              <>
                {expenses.map(e => (
                  <div key={e.id} className="flex justify-between items-center p-3 bg-neu-bg shadow-neu-inset-sm rounded-xl">
                    <div>
                      <p className="font-bold text-sm text-neu-fg">{e.title || e.category || 'Expense'}</p>
                      <p className="text-xs text-neu-muted">{e.date ? format(new Date(e.date), 'MMM dd, yyyy') : 'N/A'}</p>
                    </div>
                    <span className="font-bold text-red-500">−₹{Number(e.amount || 0).toLocaleString()}</span>
                  </div>
                ))}
                {cashCollections.map(c => (
                  <div key={c.id} className="flex justify-between items-center p-3 bg-neu-bg shadow-neu-inset-sm rounded-xl">
                    <div>
                      <p className="font-bold text-sm text-neu-fg">{c.notes || 'Cash Collection'}</p>
                      <p className="text-xs text-neu-muted">{c.recorded_at ? format(new Date(c.recorded_at), 'MMM dd, yyyy') : 'N/A'}</p>
                    </div>
                    <span className="font-bold text-emerald-600">+₹{Number(c.amount || 0).toLocaleString()}</span>
                  </div>
                ))}
              </>
            )}
          </div>
        </NeuCard>
      </div>

      {/* Leave Summary */}
      <NeuCard className="p-6">
        <h3 className="font-display font-bold text-neu-fg mb-4 flex items-center gap-2">
          <Users size={18} className="text-neu-accent" /> Leave Liability Summary
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Total Requests', value: leaves.length, color: 'text-neu-fg' },
            { label: 'Pending Review', value: leaves.filter(l => l.status === 'pending').length, color: 'text-amber-500' },
            { label: 'Approved', value: leaves.filter(l => l.status === 'approved').length, color: 'text-green-600' },
            { label: 'Rejected', value: leaves.filter(l => l.status === 'rejected').length, color: 'text-red-500' },
          ].map(item => (
            <div key={item.label} className="p-4 bg-neu-bg shadow-neu-inset-sm rounded-xl text-center">
              <p className={`font-display font-black text-2xl ${item.color}`}>{item.value}</p>
              <p className="text-xs text-neu-muted mt-1">{item.label}</p>
            </div>
          ))}
        </div>
      </NeuCard>
    </div>
  );
}
