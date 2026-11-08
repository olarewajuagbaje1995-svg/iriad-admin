import { useState } from 'react'
import { Calendar, MapPin } from 'lucide-react'

// International observances (representative sample, dates are fixed-month/day)
const INTERNATIONAL_OBSERVANCES: { month: number; day: number; label: string }[] = [
  { month: 1, day: 1, label: "New Year's Day" },
  { month: 1, day: 27, label: 'International Day of Commemoration (Holocaust)' },
  { month: 2, day: 4, label: 'World Cancer Day' },
  { month: 2, day: 20, label: 'World Day of Social Justice' },
  { month: 3, day: 8, label: "International Women's Day" },
  { month: 3, day: 21, label: 'International Day for the Elimination of Racial Discrimination' },
  { month: 3, day: 22, label: 'World Water Day' },
  { month: 4, day: 7, label: 'World Health Day' },
  { month: 4, day: 22, label: 'Earth Day' },
  { month: 5, day: 1, label: "Workers' Day (May Day)" },
  { month: 5, day: 16, label: 'International Day of Living Together in Peace' },
  { month: 5, day: 21, label: 'World Day for Cultural Diversity' },
  { month: 6, day: 5, label: 'World Environment Day' },
  { month: 6, day: 20, label: 'World Refugee Day' },
  { month: 6, day: 26, label: 'International Day Against Drug Abuse' },
  { month: 7, day: 11, label: 'World Population Day' },
  { month: 7, day: 18, label: 'Nelson Mandela International Day' },
  { month: 8, day: 9, label: 'International Day of the World’s Indigenous Peoples' },
  { month: 8, day: 12, label: 'International Youth Day' },
  { month: 8, day: 19, label: 'World Humanitarian Day' },
  { month: 9, day: 8, label: 'International Literacy Day' },
  { month: 9, day: 15, label: 'International Day of Democracy' },
  { month: 9, day: 21, label: 'International Day of Peace' },
  { month: 10, day: 1, label: 'International Day of Older Persons' },
  { month: 10, day: 5, label: "World Teachers' Day" },
  { month: 10, day: 10, label: 'World Mental Health Day' },
  { month: 10, day: 13, label: 'International Day for Disaster Reduction' },
  { month: 10, day: 16, label: 'World Food Day' },
  { month: 10, day: 17, label: 'International Day for the Eradication of Poverty' },
  { month: 11, day: 16, label: 'International Day for Tolerance' },
  { month: 11, day: 20, label: "Universal Children's Day" },
  { month: 11, day: 25, label: 'International Day for the Elimination of Violence Against Women' },
  { month: 12, day: 1, label: 'World AIDS Day' },
  { month: 12, day: 3, label: "International Day of Persons with Disabilities" },
  { month: 12, day: 5, label: 'World Soil Day' },
  { month: 12, day: 10, label: 'Human Rights Day' },
]

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

export default function CalendarPage() {
  const [view, setView] = useState<'month' | 'week' | 'agenda'>('month')
  const [currentDate, setCurrentDate] = useState(new Date())

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()

  // Days in current month
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const firstDayOfMonth = new Date(year, month, 1).getDay() // 0 = Sunday
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const observancesThisMonth = INTERNATIONAL_OBSERVANCES.filter(
    (o) => o.month === month + 1
  )

  const navigateMonth = (delta: number) => {
    setCurrentDate((d) => new Date(d.getFullYear(), d.getMonth() + delta, 1))
  }

  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  // Build calendar grid
  const days: number[] = []
  for (let i = 0; i < firstDayOfMonth; i++) days.push(0)
  for (let i = 1; i <= daysInMonth; i++) days.push(i)

  const isToday = (d: number) => {
    if (!d) return false
    const check = new Date(year, month, d)
    check.setHours(0, 0, 0, 0)
    return check.getTime() === today.getTime()
  }

  const getObservance = (d: number) => {
    if (!d) return null
    return observancesThisMonth.find((o) => o.day === d)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-neutral-900">Organisational Calendar</h2>
          <p className="text-sm text-neutral-500">
            International holidays, events, and deadlines with month / week / agenda views.
          </p>
        </div>
        <div className="flex gap-1">
          {[['month', 'Week', 'week'], ['week', 'Week', 'week'], ['agenda', 'Agenda', 'agenda']].map(([key, label]) => (
            <button
              key={key}
              onClick={() => setView(key as any)}
              className={`px-3 py-1.5 text-xs rounded border ${
                view === key
                  ? 'bg-brand-100 text-brand-700 border-brand-200'
                  : 'bg-white text-neutral-600 border-neutral-200 hover:bg-neutral-50'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Month header navigation */}
      <div className="flex items-center justify-between">
        <div>
          <button onClick={() => navigateMonth(-1)} className="p-2 text-neutral-500 hover:text-neutral-900">
            ◀
          </button>
          <span className="ml-2 text-lg font-semibold text-neutral-900">
            {MONTH_NAMES[month]} {year}
          </span>
          <button onClick={() => navigateMonth(1)} className="ml-2 p-2 text-neutral-500 hover:text-neutral-900">
            ▶
          </button>
        </div>
      </div>

      {view === 'month' && (
        <div className="card p-4">
          <div className="grid grid-cols-7 gap-1 mb-2">
            {weekDays.map((wd) => (
              <div key={wd} className="text-center text-xs font-medium text-neutral-500">
                {wd}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {days.map((d) => {
              const obs = getObservance(d)
              return (
                <div
                  key={d}
                  className={`aspect-square flex flex-col items-center justify-center p-1 text-xs rounded-lg border ${
                    isToday(d)
                      ? 'bg-brand-50 border-brand-200'
                      : 'bg-white border-neutral-200 hover:bg-neutral-50'
                  }`}
                >
                  {d === 0 ? (
                    <span className="text-neutral-300">—</span>
                  ) : (
                    <>
                      <span className={`font-medium ${
                        isToday(d) ? 'text-brand-700' : 'text-neutral-700'
                      }`}>{d}</span>
                      {obs && (
                        <span className="mt-[2px] text-[9px] bg-neutral-100 text-neutral-600 px-1 py-0.5 rounded">
                          {obs.label}
                        </span>
                      )}
                    </>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {view === 'week' && (
        <div className="card p-4">
          <div className="grid grid-cols-7 gap-1 mb-4">
            {weekDays.map((wd, i) => {
              const d = new Date(year, month, 1 + i - firstDayOfMonth)
              return (
                <div key={i} className="text-center text-xs font-medium text-neutral-500">
                  {wd}
                  <div className="text-[10px] text-neutral-400">
                    {d.getDate() > 0 && d.getDate() <= daysInMonth ? d.getDate() : ''}
                  </div>
                </div>
              )
            })}
          </div>
          <div className="space-y-2">
            {[0, 1, 2, 3].map((row) => (
              <div key={row} className="grid grid-cols-7 gap-1">
                {weekDays.map((_, i) => (
                  <div
                    key={i}
                    className="h-20 rounded-lg border border-neutral-200 bg-white p-2 hover:bg-neutral-50"
                  >
                    <div className="text-[10px] text-neutral-400 mb-1">No events</div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      {view === 'agenda' && (
        <div className="card p-4">
          <div className="space-y-3">
            {observancesThisMonth.map((o) => (
              <div key={`${o.month}-${o.day}`} className="flex items-start gap-3 p-3 rounded-lg border border-neutral-200 bg-white">
                <Calendar className="w-5 h-5 text-brand-600 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-neutral-900">{o.label}</div>
                  <div className="text-xs text-neutral-500">
                    {MONTH_NAMES[o.month - 1]} {o.day}, {year} • International observance
                  </div>
                </div>
                <MapPin className="w-4 h-4 text-neutral-400 mt-0.5" />
              </div>
            ))}
            <div className="text-center py-6 text-neutral-500 text-sm">
              No agenda items scheduled beyond international observances.
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
