'use client';

import React, { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { NeuCard } from '@/components/neu/NeuCard';
import { NeuButton } from '@/components/neu/NeuButton';
import { NeuInput } from '@/components/neu/NeuInput';
import { SkeletonCard } from '@/components/neu/SkeletonCard';
import { Settings, Save, Building, ShieldCheck, CheckCircle } from 'lucide-react';

export default function SettingsPage() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const [businessName, setBusinessName] = useState('V-Syncer Enterprise');
  const [businessEmail, setBusinessEmail] = useState('admin@v-syncer.com');
  const [businessPhone, setBusinessPhone] = useState('+91 98765 43210');
  const [gstin, setGstin] = useState('');
  const [currency, setCurrency] = useState('INR');
  const [settingId, setSettingId] = useState<string | null>(null);

  useEffect(() => {
    async function fetchSettings() {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('business_settings')
          .select('*')
          .limit(1);

        if (!error && data && data.length > 0) {
          const s = data[0];
          setSettingId(s.id);
          if (s.business_name) setBusinessName(s.business_name);
          if (s.business_email) setBusinessEmail(s.business_email);
          if (s.business_phone) setBusinessPhone(s.business_phone);
          if (s.gstin) setGstin(s.gstin);
          if (s.currency) setCurrency(s.currency);
        }
      } catch (err) {
        console.error('Error fetching settings:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchSettings();
  }, [supabase]);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSavedSuccess(false);

    const payload = {
      business_name: businessName,
      business_email: businessEmail,
      business_phone: businessPhone,
      gstin,
      currency,
      updated_at: new Date().toISOString()
    };

    try {
      if (settingId) {
        await supabase.from('business_settings').update(payload).eq('id', settingId);
      } else {
        const { data } = await supabase.from('business_settings').insert([payload]).select('id');
        if (data && data.length > 0) setSettingId(data[0].id);
      }
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 4000);
    } catch (err) {
      console.error('Error saving settings:', err);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <h2 className="text-xl font-display font-bold text-neu-fg">System & Business Settings</h2>
        <SkeletonCard className="h-[400px]" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-up">
      <div>
        <h2 className="text-xl font-display font-bold text-neu-fg">System & Business Settings</h2>
        <p className="text-neu-muted text-sm">Synchronized with database `business_settings` table.</p>
      </div>

      {savedSuccess && (
        <div className="p-4 rounded-xl bg-green-500/10 text-green-700 text-sm font-bold border border-green-500/20 flex items-center gap-2 animate-fade-up">
          <CheckCircle size={18} />
          <span>System settings updated and saved to database successfully!</span>
        </div>
      )}

      <NeuCard className="p-6 max-w-2xl space-y-6">
        <form onSubmit={handleSaveSettings} className="space-y-5">
          <div className="flex items-center gap-2 pb-3 border-b border-neu-muted/10">
            <Building size={20} className="text-neu-accent" />
            <h3 className="font-display font-bold text-lg text-neu-fg">Enterprise Profile</h3>
          </div>

          <NeuInput
            label="Business Name"
            value={businessName}
            onChange={e => setBusinessName(e.target.value)}
            required
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <NeuInput
              label="Business Email"
              type="email"
              value={businessEmail}
              onChange={e => setBusinessEmail(e.target.value)}
              required
            />
            <NeuInput
              label="Business Phone"
              value={businessPhone}
              onChange={e => setBusinessPhone(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <NeuInput
              label="GSTIN / Tax ID"
              placeholder="e.g. 27AAAAA0000A1Z5"
              value={gstin}
              onChange={e => setGstin(e.target.value)}
            />
            <NeuInput
              label="Currency Code"
              value={currency}
              onChange={e => setCurrency(e.target.value)}
              required
            />
          </div>

          <div className="pt-4 flex justify-end">
            <NeuButton type="submit" disabled={saving}>
              <Save size={18} />
              {saving ? 'Saving to DB...' : 'Save Settings'}
            </NeuButton>
          </div>
        </form>
      </NeuCard>
    </div>
  );
}
