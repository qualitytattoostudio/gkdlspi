'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { NeuCard } from '@/components/neu/NeuCard';
import { NeuInput } from '@/components/neu/NeuInput';
import { NeuButton } from '@/components/neu/NeuButton';
import { VSyncerLogo } from '@/components/brand/Logo';
import { Lock, Mail, AlertCircle } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) throw authError;

      if (data.user) {
        // Fetch user profile role
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', data.user.id)
          .single();

        const role = profile?.role?.toLowerCase();
        
        // Strict role validation: GM, Manager, Admin allowed
        if (role && !['manager', 'gm', 'general_manager', 'admin', 'superadmin'].includes(role)) {
          await supabase.auth.signOut();
          setError('Access Denied: Only General Managers and Admin staff are authorized.');
          setLoading(false);
          return;
        }

        router.push('/dashboard');
        router.refresh();
      }
    } catch (err: any) {
      setError(err.message || 'Failed to authenticate. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-neu-bg flex items-center justify-center p-4">
      <div className="w-full max-w-md animate-fade-up space-y-6">
        {/* Brand Header */}
        <div className="flex flex-col items-center justify-center text-center space-y-3">
          <VSyncerLogo size="lg" showText={false} />
          <h1 className="text-2xl font-display font-bold text-neu-fg tracking-tight">V-SYNCER PRO</h1>
          <p className="text-neu-muted text-sm max-w-xs">General Manager Web Portal</p>
        </div>

        {/* Neumorphic Login Card */}
        <NeuCard className="p-8 space-y-6">
          <form onSubmit={handleLogin} className="space-y-5">
            {error && (
              <div className="p-4 rounded-xl bg-red-500/10 text-red-600 text-xs font-bold border border-red-500/20 shadow-neu-inset-sm flex items-center gap-2">
                <AlertCircle size={16} className="shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <NeuInput
              label="Manager Email"
              type="email"
              placeholder="gm@v-syncer.com"
              icon={<Mail size={18} />}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />

            <NeuInput
              label="Password"
              type="password"
              placeholder="••••••••"
              icon={<Lock size={18} />}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />

            <NeuButton
              type="submit"
              disabled={loading}
              className="w-full h-12 text-base font-bold shadow-neu-lifted"
            >
              {loading ? 'Authenticating...' : 'Sign In to Manager Portal'}
            </NeuButton>
          </form>
        </NeuCard>

        {/* Footer info */}
        <p className="text-center text-xs text-neu-muted">
          &copy; {new Date().getFullYear()} Operations Portal
        </p>
      </div>
    </div>
  );
}
