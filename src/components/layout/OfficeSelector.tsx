'use client';

import React, { useEffect, useState } from 'react';
import { useAppStore } from '@/store/appStore';
import { createClient } from '@/lib/supabase/client';
import { Building2, ChevronDown } from 'lucide-react';

interface Office {
  id: string;
  name: string;
}

export function OfficeSelector() {
  const { activeOfficeId, setActiveOfficeId } = useAppStore();
  const [offices, setOffices] = useState<Office[]>([]);
  const [isLocked, setIsLocked] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    async function loadData() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('role, office_id')
        .eq('id', user.id)
        .single();

      if (profile) {
        if (profile.role === 'manager') {
          // Locked to their own office
          setIsLocked(true);
          setActiveOfficeId(profile.office_id);
          const { data: myOffice } = await supabase.from('offices').select('id, name').eq('id', profile.office_id).single();
          if (myOffice) setOffices([myOffice]);
        } else {
          // GM or Super Admin
          setIsLocked(false);
          const { data: allOffices } = await supabase.from('offices').select('id, name');
          if (allOffices) {
            setOffices(allOffices);
            if (!activeOfficeId && allOffices.length > 0) {
              setActiveOfficeId(allOffices[0].id);
            }
          }
        }
      }
    }
    loadData();
  }, [supabase, activeOfficeId, setActiveOfficeId]);

  if (offices.length === 0) return null;

  return (
    <div className="relative">
      <div className="flex items-center gap-3 bg-neu-bg rounded-full px-4 py-2 shadow-neu-inset">
        <Building2 size={18} className="text-neu-accent" />
        {isLocked ? (
          <span className="text-sm font-medium text-neu-fg min-w-[120px]">
            {offices[0]?.name || 'Loading...'}
          </span>
        ) : (
          <select
            value={activeOfficeId || ''}
            onChange={(e) => setActiveOfficeId(e.target.value)}
            className="bg-transparent text-sm font-medium text-neu-fg outline-none appearance-none min-w-[120px] cursor-pointer"
          >
            <option value="all">All Branches</option>
            {offices.map((office) => (
              <option key={office.id} value={office.id}>
                {office.name}
              </option>
            ))}
          </select>
        )}
        {!isLocked && <ChevronDown size={16} className="text-neu-muted" />}
      </div>
    </div>
  );
}
