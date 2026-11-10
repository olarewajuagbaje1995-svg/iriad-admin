import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { formatLagos, lagosToday, isSameLagosDay } from '@/lib/dates'
import { useAuth } from '@/hooks/useAuth'
import { isAdminOrDirector } from '@/lib/permissions'
import { type Role } from '@/config/brand'
import {
  Calendar, Plus, Search, X, ChevronLeft, ChevronRight,
  Clock, Edit2, Trash2, Filter,
} from 'lucide-react'

/* ------------------------------------------------------------------ */
/*  Event categories with colours                                     */
/* ------------------------------------------------------------------ */

const EVENT_CATEGORIES: { key: string; label: string; color: string }[] = [
  { key: 'meeting', label: 'Meeting', color: 'bg-blue-500' },
  { key: 'deadline', label: 'Deadline', color: 'bg-red-500' },
  { key: 'workshop', label: 'Workshop', color: 'bg-purple-500' },
  { key: 'training', label: 'Training', color: 'bg-emerald-500' },
  { key: 'holiday', label: 'Holiday', color: 'bg-amber-500' },
  { key: 'personal', label: 'Personal', color: 'bg-neutral-400' },
  { key: 'other', label: 'Other', color: 'bg-brand-600' },
]

const categoryColor = (key: string) => {
  const c = EVENT_CATEGORIES.find((x) => x.key === key)
  return c ? c.color : 'bg-neutral-400'
}

type CalendarEvent = {
  id: string
  title: string
  description?: string | null
  category?: string | null
  event_date?: string | null
  event_time?: string | null
  start_at?: string | null
  end_at?: string | null
  location?: string | null
  created_by?: string | null
  created_at?: string | null
  profiles?: { full_name?: string | null } | null
}

/* ------------------------------------------------------------------ */
/*  Calendar page                                                     */
/* ------------------------------------------------------------------ */

export default function CalendarPage() {
  const { profile } = useAuth()
  const role = (profile?.role as Role | null) ?? null
  const canManage = isAdminOrDirector(role)
  const orgId = profile?.organisation_id ?? null

  const [view, setView] = useState<'month' | 'week' | 'agenda'>('month')
  const [currentDate, setCurrentDate] = useState(new Date())
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<CalendarEvent | null>(null)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()
  const todayStr = lagosToday()

  /* ---- fetch ---- */

  const loadEvents = useCallback(async () => {
    if (!orgId) {
      setEvents([])
      setLoading(false)
      return
    }
    try {
      const { data, error } = await supabase
        .from('calendar_events')
        .select('*, profiles(full_name)')
        .eq('organisation_id', orgId)
        .order('start_at', { ascending: true })
      if (error) throw error
      setEvents((data ?? []) as CalendarEvent[])
    } catch {
      // table may not exist until migration runs
    } finally {
      setLoading(false)
    }
  }, [orgId])

  useEffect(() => {
    loadEvents()
  }, [loadEvents])

  /* ---- derived ---- */

  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const firstDayOfMonth = new Date(year, month, 1).getDay() // 0 = Sunday

  const filteredEvents = useMemo(() => {
    return events.filter((e) => {
      if (search && !e.title.toLowerCase().includes(search.toLowerCase())) return false
      if (categoryFilter !== 'all' && e.category !== categoryFilter) return false
      return true
    })
  }, [events, search, categoryFilter])

  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>()
    for (const e of events) {
      const key = e.event_date ?? e.start_at?.slice(0, 10)
      if (!key) continue
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(e)
    }
    return map
  }, [events])

  const navigateMonth = (delta: number) => {
    setCurrentDate((d) => new Date(d.getFullYear(), d.getMonth() + delta, 1))
  }

  const goToday = () => setCurrentDate(new Date())

  const isToday = (d: number) => {
    if (!d) return false
    const check = new Date(year, month, d)
    return isSameLagosDay(check, todayStr)
  }

  /* ---- create / update / delete ---- */

  const saveEvent = async (values: {
    title: string
    description: string
    category: string
    eventDate: string
    eventTime: string
    endDate: string
    endTime: string
    location: string
  }) => {
    if (!orgId || !profile) return
    setSaving(true)
    try {
      const startAt = new Date(`${values.eventDate}T${values.eventTime}:00`).toISOString()
      const endAt = new Date(`${values.endDate}T${values.endTime}:00`).toISOString()
      const payload = {
        organisation_id: orgId,
        title: values.title,
        description: values.description || null,
        category: values.category,
        event_date: values.eventDate,
        event_time: values.eventTime,
        start_at: startAt,
        end_at: endAt,
        location: values.location || null,
        created_by: profile.id,
      }
      if (editing) {
        await supabase.from('calendar_events').update(payload).eq('id', editing.id)
      } else {
        await supabase.from('calendar_events').insert(payload)
      }
      setModalOpen(false)
      setEditing(null)
      await loadEvents()
    } catch (e: any) {
      alert(e.message || 'Failed to save event')
    } finally {
      setSaving(false)
    }
  }

  const deleteEvent = async (id: string) => {
    if (!window.confirm('Delete this event?')) return
    setDeletingId(id)
    try {
      await supabase.from('calendar_events').delete().eq('id', id)
      await loadEvents()
    } catch (e: any) {
      alert(e.message || 'Failed to delete event')
    } finally {
      setDeletingId(null)
    }
  }

  const openCreate = () => { setEditing(null); setModalOpen(true) }
  const openEdit = (e: CalendarEvent) => { setEditing(e); setModalOpen(true) }

  /* ---- render helpers ---- */

  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ]

  const dayEvents = (d: number) => {
    const key = new Date(year, month, d).toISOString().slice(0, 10)
    return eventsByDate.get(key) ?? []
  }

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center">
        Loading calendar…
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white rounded-xl border border-neutral-100 p-6 shadow-sm">
        <div>
          <h2 className="text-xl font-semibold text-neutral-900">Organisational Calendar</h2>
          <p className="text-sm text-neutral-500">
            {MONTH_NAMES[month]} {year} • {filteredEvents.length} event{filteredEvents.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex items-end gap-3">
          <div className="flex gap-1">
            {['month', 'week', 'agenda'].map((v) => (
              <button
                key={v}
                onClick={() => setView(v as any)}
                className={`px-3 py-1.5 text-xs rounded border ${
                  view === v
                    ? 'bg-brand-100 text-brand-700 border-brand-200'
                    : 'bg-white text-neutral-600 border-neutral-200 hover:bg-neutral-50'
                }`}
              >
                {v === 'month' ? 'Month' : v === 'week' ? 'Week' : 'Agenda'}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <button
              onClick={goToday}
              className="px-3 py-1.5 text-xs rounded border border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50"
            >
              Today
            </button>
            <button
              onClick={openCreate}
              disabled={!canManage}
              className={`px-4 py-1.5 rounded border text-sm font-medium flex items-center gap-1.5 ${
                canManage
                  ? 'bg-brand-600 border-brand-600 text-white hover:bg-brand-700 shadow-sm shadow-brand-600/20'
                  : 'bg-neutral-100 border-neutral-200 text-neutral-400 opacity-60 cursor-not-allowed'
              }`}
            >
              <Plus className="w-3 h-3" /> Add event
            </button>
          </div>
        </div>
      </div>

      {/* Search & filters (agenda-focused but visible everywhere) */}
      <div className="card p-4">
        <div className="flex flex-col lg:flex-row gap-4 items-end">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
            <input
              type="text"
              placeholder="Search events…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 rounded border border-neutral-200 bg-white text-sm text-neutral-900 focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
            />
          </div>
          <div className="relative flex-1 min-w-[200px]">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 rounded border border-neutral-200 bg-white text-sm text-neutral-900 focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
            >
              <option value="all">All categories</option>
              {EVENT_CATEGORIES.map((c) => (
                <option key={c.key} value={c.key}>{c.label}</option>
              ))}
            </select>
          </div>
          {!canManage && (
            <span className="text-xs text-neutral-500 italic">View only — sign in as admin/director to create events.</span>
          )}
        </div>
      </div>

      {/* Month view */}
      {view === 'month' && (
        <div className="card p-4">
          <div className="flex items-center justify-between mb-4">
            <button onClick={() => navigateMonth(-1)} className="p-2 text-neutral-500 hover:text-neutral-900">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-lg font-semibold text-neutral-900">{MONTH_NAMES[month]} {year}</span>
            <button onClick={() => navigateMonth(1)} className="ml-2 p-2 text-neutral-500 hover:text-neutral-900">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-7 gap-0.5 mb-2">
            {weekDays.map((wd) => (
              <div key={wd} className="text-center text-xs font-medium text-neutral-500 uppercase tracking-wider">
                {wd}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-0.5">
            {Array.from({ length: firstDayOfMonth }).map((_, i) => (
              <div key={`empty-${i}`} className="aspect-square" />
            ))}
            {Array.from({ length: daysInMonth }, (_, i) => {
              const d = i + 1
              const evs = dayEvents(d)
              const tdy = isToday(d)
              return (
                <div
                  key={d}
                  className={`aspect-square flex flex-col items-center justify-start p-1.5 rounded-lg border cursor-pointer transition-colors ${
                    tdy
                      ? 'bg-brand-50 border-brand-200'
                      : 'bg-white border-neutral-200 hover:bg-neutral-50'
                  }`}
                >
                  <span
                    className={`font-medium text-xs ${tdy ? 'text-brand-700' : 'text-neutral-700'}`}
                  >
                    {d}
                  </span>
                  {evs.slice(0, 3).map((e) => (
                    <div
                      key={e.id}
                      className={`mt-[2px] w-2 h-2 rounded-full ${categoryColor(e.category ?? 'other')}`}
                    />
                  ))}
                  {evs.length > 3 && (
                    <div className="mt-[2px] text-[9px] text-neutral-400">+{evs.length - 3}</div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Week view */}
      {view === 'week' && (
        <div className="card p-4">
          <div className="flex items-center justify-between mb-4">
            <button onClick={() => navigateMonth(-7)} className="p-2 text-neutral-500 hover:text-neutral-900">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-lg font-semibold text-neutral-900">
              Week of {formatLagos(new Date(year, month, 1 - firstDayOfMonth), { month: 'short', day: 'numeric', year: 'numeric' })}
            </span>
            <button onClick={() => navigateMonth(7)} className="ml-2 p-2 text-neutral-500 hover:text-neutral-900">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-7 gap-1">
            {weekDays.map((wd, i) => {
              const d = new Date(year, month, 1 + i - firstDayOfMonth)
              const evs = dayEvents(d.getDate())
              return (
                <div key={i} className="border border-neutral-200 rounded-lg bg-white overflow-hidden flex flex-col">
                  <div className="px-2 py-1 bg-neutral-50 border-b border-neutral-100">
                    <div className="text-[10px] font-medium text-neutral-500 uppercase">{wd}</div>
                    <div className="text-[11px] font-medium text-neutral-700">{d.getDate()}</div>
                  </div>
                  <div className="flex-1 p-1 space-y-1 overflow-hidden">
                    {evs.map((e) => (
                      <div
                        key={e.id}
                        className="px-2 py-1 rounded text-[10px] font-medium text-white truncate border border-white/40"
                        style={{ backgroundColor: categoryColor(e.category ?? 'other').replace('bg-', 'text-') === 'text-transparent' ? '' : categoryColor(e.category ?? 'other').replace('500', '600') }}
                      >
                        {e.title}
                      </div>
                    ))}
                    {evs.length === 0 && <div className="text-[9px] text-neutral-300">—</div>}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Agenda view */}
      {view === 'agenda' && (
        <div className="card p-4">
          <div className="space-y-3">
            {filteredEvents.length === 0 ? (
              <div className="text-center py-12 text-neutral-500">
                <Calendar className="w-8 h-8 mx-auto text-neutral-300 mb-3" />
                <p className="text-sm text-neutral-500">No events found.</p>
              </div>
            ) : (
              filteredEvents.map((e) => {
                const start = e.event_date ?? e.start_at?.slice(0, 10)
                const time = e.event_time ?? e.start_at?.slice(11, 16)
                return (
                  <div
                    key={e.id}
                    className="flex items-start gap-3 p-3 rounded-lg border border-neutral-100 bg-white hover:bg-neutral-50 transition-colors group"
                  >
                    <div
                      className={`p-1.5 rounded-lg ${categoryColor(e.category ?? 'other')} text-white`}
                    >
                      <Clock className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2">
                        <div className="text-sm font-semibold text-neutral-900 truncate">{e.title}</div>
                        <span className={`text-[10px] font-semibold rounded-full px-1.5 py-0.5 border ${categoryColor(e.category ?? 'other').replace('500', '100')} ${categoryColor(e.category ?? 'other').replace('500', '700')}`}>
                          {EVENT_CATEGORIES.find((c) => c.key === e.category)?.label ?? e.category}
                        </span>
                      </div>
                      {e.description && (
                        <div className="text-xs text-neutral-500 mt-0.5 truncate">{e.description}</div>
                      )}
                      <div className="text-xs text-neutral-400 mt-1">
                        {start ? formatLagos(start, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                        {time ? ` • ${time}` : ''}
                        {e.location ? ` • ${e.location}` : ''}
                        {e.profiles?.full_name && ` • by ${e.profiles.full_name}`}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {canManage && (
                        <button
                          onClick={() => openEdit(e)}
                          className="p-1.5 rounded text-neutral-400 hover:text-brand-600 hover:bg-neutral-100"
                          title="Edit"
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>
                      )}
                      {canManage && (
                        <button
                          onClick={() => deleteEvent(e.id)}
                          className="p-1.5 rounded text-neutral-400 hover:text-red-600 hover:bg-red-50"
                          title="Delete"
                          disabled={deletingId === e.id}
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      )}

      {/* Create / Edit modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={(e) => {
          if (e.target === e.currentTarget) setModalOpen(false)
        }}>
          <div className="bg-white rounded-xl border border-neutral-200 shadow-xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-neutral-900">
                {editing ? 'Edit event' : 'Create event'}
              </h3>
              <button
                onClick={() => setModalOpen(false)}
                className="p-1 text-neutral-400 hover:text-neutral-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={(e) => {
              e.preventDefault()
              const fd = new FormData(e.target as HTMLFormElement)
              saveEvent({
                title: fd.get('title') as string,
                description: fd.get('description') as string,
                category: fd.get('category') as string,
                eventDate: fd.get('eventDate') as string,
                eventTime: fd.get('eventTime') as string,
                endDate: fd.get('endDate') as string,
                endTime: fd.get('endTime') as string,
                location: fd.get('location') as string,
              })
            }}>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1">Event title</label>
                  <input
                    name="title"
                    defaultValue={editing?.title ?? ''}
                    className="w-full px-3 py-1.5 rounded border border-neutral-200 bg-white text-sm text-neutral-900 focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1">Category</label>
                  <select
                    name="category"
                    defaultValue={editing?.category ?? 'meeting'}
                    className="w-full px-3 py-1.5 rounded border border-neutral-200 bg-white text-sm text-neutral-900 focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
                  >
                    {EVENT_CATEGORIES.map((c) => (
                      <option key={c.key} value={c.key}>{c.label}</option>
                    ))}
                  </select>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-medium text-neutral-700 mb-1">Date</label>
                    <input
                      name="eventDate"
                      type="date"
                      defaultValue={editing?.event_date ?? todayStr}
                      className="w-full px-3 py-1.5 rounded border border-neutral-200 bg-white text-sm text-neutral-900 focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-neutral-700 mb-1">Time</label>
                    <input
                      name="eventTime"
                      type="time"
                      defaultValue={editing?.event_time ?? '09:00'}
                      className="w-full px-3 py-1.5 rounded border border-neutral-200 bg-white text-sm text-neutral-900 focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
                      required
                    />
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-medium text-neutral-700 mb-1">End date</label>
                    <input
                      name="endDate"
                      type="date"
                      defaultValue={editing?.event_date ?? todayStr}
                      className="w-full px-3 py-1.5 rounded border border-neutral-200 bg-white text-sm text-neutral-900 focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-neutral-700 mb-1">End time</label>
                    <input
                      name="endTime"
                      type="time"
                      defaultValue={editing?.event_time ?? '10:00'}
                      className="w-full px-3 py-1.5 rounded border border-neutral-200 bg-white text-sm text-neutral-900 focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1">Location</label>
                  <input
                    name="location"
                    defaultValue={editing?.location ?? ''}
                    className="w-full px-3 py-1.5 rounded border border-neutral-200 bg-white text-sm text-neutral-900 focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
                    placeholder="Optional location"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1">Description</label>
                  <textarea
                    name="description"
                    defaultValue={editing?.description ?? ''}
                    rows={3}
                    className="w-full px-3 py-1.5 rounded border border-neutral-200 bg-white text-sm text-neutral-900 focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
                    placeholder="Optional description"
                  />
                </div>
              </div>
              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-1.5 rounded border border-neutral-200 bg-white text-sm font-medium text-neutral-700 hover:bg-neutral-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-1.5 rounded bg-brand-600 border-brand-600 text-white text-sm font-medium hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm shadow-brand-600/20"
                >
                  {saving ? 'Saving…' : 'Save event'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
