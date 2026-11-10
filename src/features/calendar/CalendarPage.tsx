import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { Search, Plus, Trash2, Clock, ChevronLeft, ChevronRight } from 'lucide-react';

type CalendarEvent = {
  id: string;
  title: string;
  event_date: string;
  event_time: string;
  category: 'work' | 'personal' | 'meeting' | 'important';
  is_international?: boolean;
};

const defaultInternationalEvents: CalendarEvent[] = [
  { id: 'int-1', title: 'International Day for Tolerance', event_date: '2026-11-16', event_time: '09:00', category: 'important', is_international: true },
  { id: 'int-2', title: "Universal Children's Day", event_date: '2026-11-20', event_time: '10:00', category: 'meeting', is_international: true },
  { id: 'int-3', title: 'Elimination of Violence Against Women', event_date: '2026-11-25', event_time: '09:30', category: 'important', is_international: true },
];

const monthNames = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const daysOfWeek = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function CalendarPage() {
  const [currentDate, setCurrentDate] = useState(new Date(2026, 10, 10));
  const [view, setView] = useState<'Month' | 'Week' | 'Agenda'>('Month');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [showModal, setShowModal] = useState(false);
  const [dbEvents, setDbEvents] = useState<CalendarEvent[]>([]);

  const [newEvent, setNewEvent] = useState({
    title: '',
    event_date: new Date().toISOString().split('T')[0],
    event_time: '09:00',
    category: 'work' as CalendarEvent['category']
  });

  useEffect(() => {
    fetchEvents();
  }, []);

  async function fetchEvents() {
    const { data, error } = await supabase.from('calendar_events').select('*');
    if (!error && data) {
      const formatted = data.map(item => ({
        id: item.id,
        title: item.title,
        event_date: item.event_date || item.date,
        event_time: item.event_time || item.time || '09:00',
        category: item.category || 'work'
      }));
      setDbEvents(formatted);
    }
  }

  const allEvents = useMemo(() => {
    return [...defaultInternationalEvents, ...dbEvents];
  }, [dbEvents]);

  const filteredEvents = useMemo(() => {
    return allEvents.filter(event => {
      const matchesSearch = event.title.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCat = selectedCategory === 'All' || event.category.toLowerCase() === selectedCategory.toLowerCase();
      return matchesSearch && matchesCat;
    });
  }, [allEvents, searchQuery, selectedCategory]);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const monthDays = useMemo(() => {
    const firstDayIndex = new Date(year, month, 1).getDay();
    const totalDays = new Date(year, month + 1, 0).getDate();

    const daysArray = [];
    for (let i = 0; i < firstDayIndex; i++) {
      const prevDate = new Date(year, month, 0 - (firstDayIndex - 1 - i));
      daysArray.push({ date: prevDate, isCurrentMonth: false });
    }
    for (let i = 1; i <= totalDays; i++) {
      const currDate = new Date(year, month, i);
      daysArray.push({ date: currDate, isCurrentMonth: true });
    }
    const remaining = 7 - (daysArray.length % 7);
    if (remaining < 7) {
      for (let i = 1; i <= remaining; i++) {
        const nextDate = new Date(year, month + 1, i);
        daysArray.push({ date: nextDate, isCurrentMonth: false });
      }
    }
    return daysArray;
  }, [year, month]);

  const formatDateKey = (date: Date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  async function handleAddEvent(e: React.FormEvent) {
    e.preventDefault();
    const { data: userData } = await supabase.auth.getUser();

    const payload = {
      title: newEvent.title,
      event_date: newEvent.event_date,
      event_time: newEvent.event_time,
      category: newEvent.category,
      created_by: userData.user?.id || null
    };

    const { error } = await supabase.from('calendar_events').insert([payload]);

    if (!error) {
      setShowModal(false);
      setNewEvent({ title: '', event_date: new Date().toISOString().split('T')[0], event_time: '09:00', category: 'work' });
      fetchEvents();
    } else {
      alert('Error creating event. Ensure calendar_events table exists in Supabase.');
    }
  }

  async function handleDelete(id: string, isInternational?: boolean) {
    if (isInternational) {
      alert('Default international events cannot be deleted.');
      return;
    }
    if (!window.confirm('Are you sure you want to delete this event?')) return;
    await supabase.from('calendar_events').delete().eq('id', id);
    fetchEvents();
  }

  const categoryColors: Record<string, string> = {
    work: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    personal: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    meeting: 'bg-amber-50 text-amber-700 border-amber-200',
    important: 'bg-rose-50 text-rose-700 border-rose-200'
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-2xl border border-neutral-100 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Organisational Calendar</h1>
          <p className="text-sm text-neutral-500 mt-0.5">
            {monthNames[month]} {year} · {filteredEvents.length} events scheduled
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex bg-neutral-100 p-1 rounded-xl">
            {(['Month', 'Week', 'Agenda'] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  view === v ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-500 hover:text-neutral-900'
                }`}
              >
                {v}
              </button>
            ))}
          </div>

          <button
            onClick={() => setCurrentDate(new Date())}
            className="px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-xl text-xs font-semibold transition-colors"
          >
            Today
          </button>

          <div className="flex items-center bg-neutral-100 rounded-xl overflow-hidden">
            <button onClick={() => setCurrentDate(new Date(year, month - 1, 1))} className="p-2 hover:bg-neutral-200 text-neutral-600 transition-colors">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button onClick={() => setCurrentDate(new Date(year, month + 1, 1))} className="p-2 hover:bg-neutral-200 text-neutral-600 transition-colors">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-xs font-semibold shadow-sm shadow-indigo-200 transition-all"
          >
            <Plus className="w-4 h-4" />
            Add event
          </button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-3 text-neutral-400" />
          <input
            type="text"
            placeholder="Search events across all dates..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-neutral-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
          />
        </div>

        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="px-4 py-2.5 bg-white border border-neutral-200 rounded-xl text-xs font-medium text-neutral-700 outline-none focus:border-indigo-500"
        >
          <option value="All">All Categories</option>
          <option value="work">Work</option>
          <option value="meeting">Meeting</option>
          <option value="important">Important</option>
          <option value="personal">Personal</option>
        </select>
      </div>

      {view === 'Month' && (
        <div className="bg-white rounded-2xl border border-neutral-100 shadow-sm overflow-hidden">
          <div className="grid grid-cols-7 border-b border-neutral-100 bg-neutral-50/50">
            {daysOfWeek.map((day) => (
              <div key={day} className="py-3 text-center text-[11px] font-bold uppercase tracking-wider text-neutral-400">
                {day}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 auto-rows-fr bg-neutral-100 gap-px">
            {monthDays.map((item, idx) => {
              const dateKey = formatDateKey(item.date);
              const dayEvents = filteredEvents.filter((ev) => ev.event_date === dateKey);
              const isToday = dateKey === formatDateKey(new Date());

              return (
                <div
                  key={idx}
                  className={`min-h-[120px] bg-white p-2.5 flex flex-col transition-colors hover:bg-neutral-50/50 ${
                    !item.isCurrentMonth ? 'bg-neutral-50/30 text-neutral-300' : 'text-neutral-800'
                  }`}
                >
                  <div className="flex justify-between items-center mb-1.5">
                    <span
                      className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                        isToday ? 'bg-indigo-600 text-white shadow-sm' : item.isCurrentMonth ? 'text-neutral-800' : 'text-neutral-300'
                      }`}
                    >
                      {item.date.getDate()}
                    </span>
                  </div>

                  <div className="flex-1 space-y-1 overflow-y-auto max-h-[90px]">
                    {dayEvents.map((ev) => (
                      <div
                        key={ev.id}
                        className={`group relative text-[11px] px-2 py-1 rounded-lg border font-medium truncate flex items-center justify-between ${
                          categoryColors[ev.category] || 'bg-neutral-50 text-neutral-700 border-neutral-200'
                        }`}
                        title={`${ev.event_time} - ${ev.title}`}
                      >
                        <span className="truncate">{ev.title}</span>
                        {!ev.is_international && (
                          <button
                            onClick={() => handleDelete(ev.id)}
                            className="opacity-0 group-hover:opacity-100 ml-1 text-neutral-400 hover:text-rose-600 transition-opacity"
                          >
                            ×
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {(view === 'Agenda' || view === 'Week') && (
        <div className="bg-white rounded-2xl border border-neutral-100 shadow-sm overflow-hidden divide-y divide-neutral-100">
          {filteredEvents.length === 0 ? (
            <div className="p-12 text-center text-neutral-400 text-xs font-medium">
              No events found matching your filter.
            </div>
          ) : (
            filteredEvents.map((ev) => (
              <div key={ev.id} className="p-5 flex items-center justify-between hover:bg-neutral-50/50 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="text-center bg-indigo-50 text-indigo-700 rounded-xl p-2.5 min-w-[55px]">
                    <span className="block text-[10px] font-bold uppercase">
                      {new Date(ev.event_date).toLocaleDateString('en-US', { month: 'short' })}
                    </span>
                    <span className="block text-base font-extrabold">
                      {new Date(ev.event_date).getDate()}
                    </span>
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-neutral-900">{ev.title}</h4>
                    <div className="flex items-center gap-3 mt-1 text-xs text-neutral-500">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        {ev.event_time}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${categoryColors[ev.category]}`}>
                        {ev.category}
                      </span>
                      {ev.is_international && (
                        <span className="text-[10px] text-indigo-600 font-semibold bg-indigo-50 px-2 py-0.5 rounded-full">
                          Global Civic Event
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {!ev.is_international && (
                  <button
                    onClick={() => handleDelete(ev.id)}
                    className="p-2 text-neutral-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-neutral-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <form onSubmit={handleAddEvent} className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="px-6 py-4 border-b border-neutral-100 flex justify-between items-center">
              <h3 className="text-base font-bold text-neutral-900">Create New Event</h3>
              <button type="button" onClick={() => setShowModal(false)} className="text-neutral-400 hover:text-neutral-600 text-xl">&times;</button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-neutral-600 mb-1">Event Title</label>
                <input
                  required
                  type="text"
                  placeholder="E.g., Quarterly Board Review"
                  value={newEvent.title}
                  onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl text-xs font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-neutral-600 mb-1">Date</label>
                  <input
                    required
                    type="date"
                    value={newEvent.event_date}
                    onChange={(e) => setNewEvent({ ...newEvent, event_date: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl text-xs font-medium focus:bg-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-neutral-600 mb-1">Time</label>
                  <input
                    required
                    type="time"
                    value={newEvent.event_time}
                    onChange={(e) => setNewEvent({ ...newEvent, event_time: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl text-xs font-medium focus:bg-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-600 mb-1">Category</label>
                <select
                  value={newEvent.category}
                  onChange={(e) => setNewEvent({ ...newEvent, category: e.target.value as any })}
                  className="w-full px-3.5 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl text-xs font-medium text-neutral-700 outline-none focus:border-indigo-500"
                >
                  <option value="work">Work</option>
                  <option value="meeting">Meeting</option>
                  <option value="important">Important</option>
                  <option value="personal">Personal</option>
                </select>
              </div>
            </div>

            <div className="px-6 py-4 bg-neutral-50 flex justify-end gap-2 border-t border-neutral-100">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-xs font-bold text-neutral-600 hover:bg-neutral-200/50 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm transition-colors"
              >
                Save Event
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
