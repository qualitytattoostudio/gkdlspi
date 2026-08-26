'use client';

import React, { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { NeuCard } from '@/components/neu/NeuCard';
import { NeuBadge, BadgeVariant } from '@/components/neu/NeuBadge';
import { NeuButton } from '@/components/neu/NeuButton';
import { NeuInput } from '@/components/neu/NeuInput';
import { NeuSelect } from '@/components/neu/NeuSelect';
import { NeuModal } from '@/components/neu/NeuModal';
import { EmptyState } from '@/components/neu/EmptyState';
import { SkeletonCard } from '@/components/neu/SkeletonCard';
import { Calendar, Megaphone, MapPin, Clock, ChevronLeft, ChevronRight, Plus, Download, Bell } from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, addMonths, subMonths, isSameDay, parseISO } from 'date-fns';
import { toast } from '@/store/toastStore';
import { playSuccess, playError } from '@/lib/audio';

export default function CalendarPage() {
  const supabase = createClient();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState<Date | null>(new Date());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [eventType, setEventType] = useState('announcement');
  const [newTitle, setNewTitle] = useState('');
  const [newDate, setNewDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  useEffect(() => {
    async function fetchEvents() {
      setLoading(true);
      try {
        // Fetch profiles map
        const { data: profiles } = await supabase.from('profiles').select('id, full_name').eq('is_active', true);
        const profileMap = new Map<string, string>();
        (profiles || []).forEach(p => { if (p.id) profileMap.set(p.id, p.full_name || 'Staff'); });

        // Query announcements (33 rows)
        const { data: announcements } = await supabase
          .from('announcements')
          .select('*')
          .order('created_at', { ascending: false });

        // Query leave_requests (12 rows)
        const { data: leaves } = await supabase
          .from('leave_requests')
          .select('*')
          .eq('status', 'approved')
          .order('start_date', { ascending: true });

        // Query field_visits (2 rows)
        const { data: visits } = await supabase
          .from('field_visits')
          .select('*')
          .order('check_in_time', { ascending: false });

        // Query reminders
        const { data: reminders } = await supabase
          .from('reminders')
          .select('*')
          .order('date', { ascending: true });

        const allEvents: any[] = [];

        (announcements || []).forEach(a => {
          allEvents.push({
            id: a.id,
            title: a.title || 'Announcement',
            date: a.created_at ? a.created_at.split('T')[0] : null,
            type: 'announcement',
            description: a.content,
          });
        });

        (leaves || []).forEach(l => {
          if (l.start_date) {
            allEvents.push({
              id: `leave-${l.id}`,
              title: `${profileMap.get(l.user_id) || 'Staff'} — Leave (${l.leave_type || 'AL'})`,
              date: l.start_date,
              type: 'leave',
              description: l.reason || 'Approved leave',
            });
          }
        });

        (visits || []).forEach(v => {
          if (v.check_in_time) {
            allEvents.push({
              id: `visit-${v.id}`,
              title: `Field Visit — ${profileMap.get(v.user_id) || 'Executive'}`,
              date: v.check_in_time.split('T')[0],
              type: 'visit',
              description: v.check_in_location || 'GPS Field Visit',
            });
          }
        });

        (reminders || []).forEach(r => {
          if (r.date) {
            allEvents.push({
              id: `reminder-${r.id}`,
              title: r.title || 'Reminder',
              date: r.date,
              type: 'reminder',
              description: r.description || '',
            });
          }
        });

        setEvents(allEvents);
      } catch (err) {
        console.error('Error fetching calendar events:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchEvents();
  }, [supabase]);

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    const { data: { user } } = await supabase.auth.getUser();

    try {
      if (eventType === 'announcement') {
        const payload = {
          title: newTitle || 'General Announcement',
          content: newTitle || 'No details provided.',
          created_by: user?.id || null,
          created_at: new Date(newDate).toISOString(),
        };
        const { data, error } = await supabase.from('announcements').insert([payload]).select('*');
        if (!error && data && data.length > 0) {
          setEvents(prev => [...prev, { id: data[0].id, title: data[0].title, date: newDate, type: 'announcement', description: data[0].content }]);
          
          // Trigger broadcast to all active staff members
          const { data: activeProfiles } = await supabase.from('profiles').select('id').neq('is_active', false);
          if (activeProfiles && activeProfiles.length > 0) {
            const notifications = activeProfiles.map(p => ({
              user_id: p.id,
              title: '📢 New Announcement: ' + (newTitle || 'General'),
              message: newTitle || 'No details provided.',
              type: 'broadcast',
              is_read: false,
              created_at: new Date().toISOString()
            }));
            await supabase.from('erp_notifications').insert(notifications);
          }
          
          playSuccess();
          toast.success('Broadcast Sent', 'Announcement created and sent to all staff.');
        } else if (error) throw error;
      } else if (eventType === 'leave') {
        const payload = {
          user_id: user?.id || null,
          leave_type: 'Manual Entry',
          reason: newTitle || 'Manual leave entry',
          start_date: newDate,
          end_date: newDate,
          status: 'approved',
          created_at: new Date().toISOString(),
        };
        const { data, error } = await supabase.from('leave_requests').insert([payload]).select('*');
        if (!error && data && data.length > 0) {
          setEvents(prev => [...prev, { id: `leave-${data[0].id}`, title: newTitle || 'Staff Leave', date: newDate, type: 'leave', description: data[0].reason }]);
          playSuccess();
          toast.success('Leave Added', 'Manual leave entry recorded.');
        } else if (error) throw error;
      } else if (eventType === 'visit') {
        const payload = {
          user_id: user?.id || null,
          check_in_location: newTitle || 'Manual Field Visit',
          check_in_time: new Date(newDate).toISOString(),
          created_at: new Date().toISOString(),
        };
        const { data, error } = await supabase.from('field_visits').insert([payload]).select('*');
        if (!error && data && data.length > 0) {
          setEvents(prev => [...prev, { id: `visit-${data[0].id}`, title: newTitle || 'Field Visit', date: newDate, type: 'visit', description: data[0].check_in_location }]);
          playSuccess();
          toast.success('Visit Recorded', 'Manual field visit recorded.');
        } else if (error) throw error;
      } else if (eventType === 'reminder') {
        const payload = {
          user_id: user?.id || null,
          title: newTitle || 'Reminder',
          description: newTitle || '',
          date: newDate,
          created_at: new Date().toISOString(),
        };
        const { data, error } = await supabase.from('reminders').insert([payload]).select('*');
        if (!error && data && data.length > 0) {
          setEvents(prev => [...prev, { id: `reminder-${data[0].id}`, title: data[0].title, date: newDate, type: 'reminder', description: data[0].description }]);
          playSuccess();
          toast.success('Reminder Set', 'Your personal reminder has been scheduled.');
        } else if (error) throw error;
      }
    } catch (err) {
      console.error('Event insert error:', err);
      playError();
      toast.error('Event Creation Failed', 'Could not create the calendar event.');
    }
    setIsModalOpen(false);
    setNewTitle('');
    setEventType('announcement');
  };

  const daysInMonth = eachDayOfInterval({ start: startOfMonth(currentMonth), end: endOfMonth(currentMonth) });
  const startDayOfWeek = startOfMonth(currentMonth).getDay();
  const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const getEventsForDay = (day: Date) => events.filter(e => e.date && isSameDay(parseISO(e.date), day));

  const selectedDayEvents = selectedDay ? getEventsForDay(selectedDay) : [];

  const eventTypeColor: Record<string, string> = {
    announcement: 'bg-neu-accent',
    leave: 'bg-amber-400',
    visit: 'bg-emerald-400',
    reminder: 'bg-purple-500',
  };

  const exportAgendaCSV = () => {
    // Filter events to only the current month shown
    const monthEvents = events.filter(e => {
      if (!e.date) return false;
      const d = parseISO(e.date);
      return d >= startOfMonth(currentMonth) && d <= endOfMonth(currentMonth);
    }).sort((a, b) => parseISO(a.date).getTime() - parseISO(b.date).getTime());

    const csvContent = [
      ['Date', 'Type', 'Title', 'Description'],
      ...monthEvents.map(e => [
        format(parseISO(e.date), 'yyyy-MM-dd'),
        e.type.toUpperCase(),
        `"${(e.title || '').replace(/"/g, '""')}"`,
        `"${(e.description || '').replace(/"/g, '""')}"`
      ])
    ].map(row => row.join(",")).join("\n");
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Operations_Agenda_${format(currentMonth, 'MMMM_yyyy')}.csv`);
    link.click();
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <h2 className="text-xl font-display font-bold text-neu-fg">Operations Calendar</h2>
        <SkeletonCard className="h-[600px]" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-up">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-xl font-display font-bold text-neu-fg">Operations Calendar</h2>
          <p className="text-neu-muted text-sm">Synced from announcements, approved leaves, field visits, and reminders ({events.length} events).</p>
        </div>
        <div className="flex gap-3">
          <NeuButton onClick={exportAgendaCSV} variant="secondary">
            <Download size={16} />
            Export Agenda
          </NeuButton>
          <NeuButton onClick={() => setIsModalOpen(true)}>
            <Plus size={18} />
            Add Event
          </NeuButton>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar Grid */}
        <NeuCard className="lg:col-span-2 p-6">
          {/* Month Navigation */}
          <div className="flex items-center justify-between mb-6">
            <button onClick={() => setCurrentMonth(prev => subMonths(prev, 1))} className="w-9 h-9 rounded-xl bg-neu-bg shadow-neu-small hover:shadow-neu-lifted flex items-center justify-center text-neu-muted transition-all">
              <ChevronLeft size={18} />
            </button>
            <h3 className="font-display font-bold text-lg text-neu-fg">
              {format(currentMonth, 'MMMM yyyy')}
            </h3>
            <button onClick={() => setCurrentMonth(prev => addMonths(prev, 1))} className="w-9 h-9 rounded-xl bg-neu-bg shadow-neu-small hover:shadow-neu-lifted flex items-center justify-center text-neu-muted transition-all">
              <ChevronRight size={18} />
            </button>
          </div>

          {/* Weekday Headers */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {weekdays.map(d => (
              <div key={d} className="text-center text-xs font-bold text-neu-muted py-2">{d}</div>
            ))}
          </div>

          {/* Day Cells */}
          <div className="grid grid-cols-7 gap-1">
            {Array(startDayOfWeek).fill(null).map((_, i) => <div key={`empty-${i}`} />)}
            {daysInMonth.map(day => {
              const dayEvents = getEventsForDay(day);
              const isSelected = selectedDay && isSameDay(day, selectedDay);
              const isToday = isSameDay(day, new Date());
              return (
                <button
                  key={day.toISOString()}
                  onClick={() => setSelectedDay(day)}
                  className={`aspect-square rounded-xl flex flex-col items-center justify-start pt-2 gap-1 text-xs font-bold transition-all
                    ${isSelected ? 'bg-neu-accent text-white shadow-neu-lifted scale-105' :
                      isToday ? 'bg-neu-bg shadow-neu-small text-neu-accent' :
                      'bg-neu-bg hover:shadow-neu-small text-neu-fg'}`}
                >
                  <span>{format(day, 'd')}</span>
                  {dayEvents.length > 0 && (
                    <div className="flex gap-0.5 flex-wrap justify-center px-1">
                      {dayEvents.slice(0, 3).map((ev, i) => (
                        <div key={i} className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-white' : eventTypeColor[ev.type] || 'bg-neu-muted'}`} />
                      ))}
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Legend */}
          <div className="flex items-center gap-6 mt-4 pt-4 border-t border-neu-muted/10 flex-wrap">
            {[['bg-neu-accent', 'Announcements'], ['bg-amber-400', 'Leaves'], ['bg-emerald-400', 'Field Visits'], ['bg-purple-500', 'Reminders']].map(([color, label]) => (
              <div key={label} className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${color}`} />
                <span className="text-xs text-neu-muted">{label}</span>
              </div>
            ))}
          </div>
        </NeuCard>

        {/* Selected Day Events */}
        <NeuCard className="p-5 flex flex-col h-fit max-h-[600px] overflow-hidden">
          <h3 className="font-display font-bold text-neu-fg mb-4 pb-4 border-b border-neu-muted/10 shrink-0">
            {selectedDay ? format(selectedDay, 'EEEE, MMM d') : 'Select a Day'}
          </h3>
          <div className="flex-1 overflow-y-auto space-y-3 scrollbar-hide">
            {selectedDayEvents.length === 0 ? (
              <div className="text-center py-8 text-neu-muted">
                <Calendar size={28} className="mx-auto mb-2 opacity-30" />
                <p className="text-sm">No events on this day</p>
              </div>
            ) : (
              selectedDayEvents.map(ev => (
                <div key={ev.id} className="p-3 bg-neu-bg rounded-xl shadow-neu-inset-sm">
                  <div className="flex items-center gap-2 mb-1">
                    <div className={`w-2 h-2 rounded-full ${eventTypeColor[ev.type] || 'bg-neu-muted'}`} />
                    <span className="text-xs font-bold uppercase tracking-wider text-neu-muted">{ev.type}</span>
                  </div>
                  <p className="font-bold text-sm text-neu-fg">{ev.title}</p>
                  {ev.description && <p className="text-xs text-neu-muted mt-1 line-clamp-2">{ev.description}</p>}
                </div>
              ))
            )}
          </div>
        </NeuCard>
      </div>

      {/* Post Event Modal */}
      <NeuModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Create Calendar Event">
        <form onSubmit={handleCreateEvent} className="space-y-4">
          <NeuSelect 
            label="Event Type" 
            options={[
              { label: 'Company Announcement', value: 'announcement' },
              { label: 'Staff Leave', value: 'leave' },
              { label: 'Field Visit', value: 'visit' },
              { label: 'Personal / Team Reminder', value: 'reminder' },
            ]} 
            value={eventType}
            onChange={(e) => setEventType(e.target.value)}
          />
          <NeuInput
            label="Title / Details (Optional)"
            placeholder="e.g. Office Closed or John's Leave"
            value={newTitle}
            onChange={e => setNewTitle(e.target.value)}
          />
          <NeuInput
            label="Date"
            type="date"
            value={newDate}
            onChange={e => setNewDate(e.target.value)}
          />
          <div className="flex justify-end gap-3 pt-4">
            <NeuButton type="button" variant="secondary" onClick={() => setIsModalOpen(false)}>Cancel</NeuButton>
            <NeuButton type="submit">Create Event</NeuButton>
          </div>
        </form>
      </NeuModal>
    </div>
  );
}
