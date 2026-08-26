'use client';

import React, { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { createClient } from '@/lib/supabase/client';
import { NeuCard } from '@/components/neu/NeuCard';
import { NeuBadge } from '@/components/neu/NeuBadge';
import { SkeletonCard } from '@/components/neu/SkeletonCard';
import { MapPin, Navigation, UserCheck } from 'lucide-react';
import { format } from 'date-fns';

const LiveMap = dynamic(() => import('@/components/map/LiveMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-neu-bg shadow-neu-inset rounded-2xl p-12">
      <SkeletonCard className="w-full h-full" />
    </div>
  ),
});

export default function LiveTrackingPage() {
  const supabase = createClient();
  const [locations, setLocations] = useState<any[]>([]);
  const [execPoints, setExecPoints] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchLiveLocations() {
      setLoading(true);

      try {
        // Fetch profiles map to resolve user_id to full_name
        const { data: profiles } = await supabase.from('profiles').select('id, full_name, role').eq('is_active', true);
        const profileMap = new Map<string, string>();
        (profiles || []).forEach(p => {
          if (p.id) profileMap.set(p.id, p.full_name || 'Field Executive');
        });

        // Fetch field visits
        const { data: visits } = await supabase
          .from('field_visits')
          .select('*')
          .order('check_in_time', { ascending: false });

        // Fetch exec_locations ordered by newest first
        const { data: execs } = await supabase
          .from('exec_locations')
          .select('*')
          .order('created_at', { ascending: false });

        setLocations((visits || []).map(v => ({
          ...v,
          title: profileMap.get(v.user_id) || 'Field Executive'
        })));
        
        // STRICT DEDUPLICATION: 1 single location pin per user_id!
        const latestPerPerson = new Map<string, any>();

        (execs || []).forEach((row) => {
          const userId = row.user_id;
          if (userId && !latestPerPerson.has(userId)) {
            // First time seeing this user_id -> it is their newest GPS location!
            latestPerPerson.set(userId, row);
          }
        });

        const uniquePoints = Array.from(latestPerPerson.values()).map((row, idx) => {
          const name = profileMap.get(row.user_id) || `Field Executive ${idx + 1}`;
          const recordedTime = row.created_at || row.recorded_at;
          const timeStr = recordedTime ? format(new Date(recordedTime), 'MMM dd, hh:mm a') : 'Active';

          return {
            id: row.id || row.user_id,
            user_id: row.user_id,
            latitude: Number(row.latitude || row.lat),
            longitude: Number(row.longitude || row.lng),
            title: name,
            subtitle: `Current GPS Location (${timeStr})`,
            recordedAt: timeStr,
            battery: row.battery_level ? `${row.battery_level}%` : 'Normal',
            status: row.status || 'Active',
          };
        }).filter(p => !isNaN(p.latitude) && !isNaN(p.longitude));

        setExecPoints(uniquePoints);
      } catch (err) {
        console.error('Error fetching live tracking:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchLiveLocations();
  }, [supabase]);

  if (loading) {
    return (
      <div className="space-y-6">
        <h2 className="text-xl font-display font-bold text-neu-fg">Executive Current Location Map</h2>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <SkeletonCard className="lg:col-span-2 h-[600px]" />
          <SkeletonCard className="h-[600px]" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-up h-full flex flex-col">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-display font-bold text-neu-fg">Executive Current Location Map</h2>
          <p className="text-neu-muted text-sm">Showing exactly ONE single current location pin for each field executive.</p>
        </div>
        <div className="flex items-center gap-2 bg-neu-bg shadow-neu-inset px-4 py-2 rounded-full text-xs font-bold text-neu-accent">
          <div className="w-2 h-2 rounded-full bg-neu-accent-secondary animate-ping" />
          <span>{execPoints.length} Executives Synced (1 Pin Each)</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 min-h-[600px]">
        {/* Interactive Leaflet Map showing exactly 1 pin per executive */}
        <NeuCard className="lg:col-span-2 p-3 flex flex-col relative h-[600px]">
          <LiveMap locations={execPoints} />
        </NeuCard>

        {/* Executive List */}
        <NeuCard className="flex flex-col h-[600px] overflow-hidden">
          <div className="flex items-center justify-between mb-4 pb-4 border-b border-neu-muted/20 shrink-0">
            <h3 className="font-display font-bold text-neu-fg">Current Executive Positions</h3>
            <NeuBadge variant="info">{execPoints.length} Executives</NeuBadge>
          </div>
          
          <div className="flex-1 overflow-y-auto pr-2 space-y-4 scrollbar-hide pb-4">
            {execPoints.length === 0 ? (
              <div className="text-center py-12 text-neu-muted">
                <Navigation size={32} className="mx-auto mb-3 opacity-30" />
                <p>No executive positions recorded.</p>
              </div>
            ) : (
              execPoints.map((exec) => (
                <div key={exec.id} className="bg-neu-bg rounded-xl p-4 shadow-neu-inset-sm transition-all hover:shadow-neu-inset-deep">
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="font-bold text-sm text-neu-fg flex items-center gap-1.5">
                      <UserCheck size={16} className="text-neu-accent" />
                      {exec.title}
                    </h4>
                    <span className="text-[11px] font-bold text-neu-accent-secondary px-2 py-0.5 bg-neu-accent-secondary/10 rounded-full">
                      Current Location
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-neu-muted mb-1">
                    <MapPin size={12} />
                    <span className="truncate">Lat: {exec.latitude.toFixed(4)}, Lng: {exec.longitude.toFixed(4)}</span>
                  </div>
                  <div className="flex justify-between items-center text-[11px] text-neu-muted font-medium pt-2 border-t border-neu-muted/10 mt-2">
                    <span>{exec.recordedAt}</span>
                    <span className="font-bold text-neu-fg">Battery: {exec.battery}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </NeuCard>
      </div>
    </div>
  );
}
