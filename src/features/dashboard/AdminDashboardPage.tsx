import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  Users, FolderKanban, ClipboardList,
  CalendarDays, Clock,
  TrendingUp, Activity, UserRound, ArrowUpRight
} from "lucide-react";
import "./AdminDashboard.css";

export default function AdminDashboard() {
  const [metrics, setMetrics] = useState({
    staffCount: 0,
    projectCount: 0,
    taskCount: 0,
    attendanceTodayCount: 0
  });
  const [attendanceList, setAttendanceList] = useState<any[]>([]);
  const [projectList, setProjectList] = useState<any[]>([]);
  const [activityList, setActivityList] = useState<any[]>([]);
  const [eventList, setEventList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [period, setPeriod] = useState("This week");

  const safeCount = async (query: any) => {
    try {
      const res = await query;
      return res.count ?? 0;
    } catch {
      return 0;
    }
  };

  const safeData = async (query: any) => {
    try {
      const res = await query;
      return res.data ?? [];
    } catch {
      return [];
    }
  };

  useEffect(() => {
    async function fetchDashboardData() {
      setLoading(true);
      const todayStr = new Date().toISOString().split("T")[0];

      // 1. Fetch live metrics counts
      const [staffCount, projectCount, taskCount, attendanceTodayCount] = await Promise.all([
        safeCount(supabase.from("profiles").select("*", { count: "exact", head: true })),
        safeCount(supabase.from("projects").select("*", { count: "exact", head: true })),
        safeCount(supabase.from("tasks").select("*", { count: "exact", head: true })),
        safeCount(supabase.from("attendance").select("*", { count: "exact", head: true }).eq("date", todayStr)),
      ]);

      setMetrics({
        staffCount,
        projectCount,
        taskCount,
        attendanceTodayCount,
      });

      // 2. Fetch today's attendance logs
      const todayAttendance = await safeData(
        supabase
          .from("attendance")
          .select("*")
          .eq("date", todayStr)
          .order("time_in", { ascending: false })
          .limit(4)
      );
      setAttendanceList(todayAttendance);

      // 3. Fetch projects
      const projectsData = await safeData(
        supabase.from("projects").select("*").limit(3)
      );
      setProjectList(projectsData.length > 0 ? projectsData : [
        { title: "Electoral Accountability", owner: "Research Team", progress: 82, status: "On track" },
        { title: "Community Development", owner: "Programme Team", progress: 64, status: "In progress" },
        { title: "Policy Research Initiative", owner: "Research Team", progress: 45, status: "In progress" },
      ]);

      // 4. Fetch recent attendance activities
      const recentAtt = await safeData(
        supabase
          .from("attendance")
          .select("full_name, role, time_in")
          .order("time_in", { ascending: false })
          .limit(4)
      );

      const formattedActivities = (recentAtt || []).map((a: any) => ({
        title: "Attendance recorded",
        detail: `${a.full_name || "Staff"} · ${a.role || "Staff"}`,
        time: new Date(a.time_in).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        icon: UserRound,
      }));

      setActivityList(formattedActivities.length > 0 ? formattedActivities : [
        { title: "System initialized", detail: "IRIAD Operations Portal active", time: "Just now", icon: Activity },
      ]);

      // 5. Fetch calendar events
      const eventsData = await safeData(
        supabase
          .from("calendar_events")
          .select("*")
          .order("event_date", { ascending: true })
          .limit(3)
      );

      setEventList(eventsData.length > 0 ? eventsData : [
        { title: "Programme planning meeting", event_date: "2026-11-16", event_time: "10:00 AM", category: "meeting" },
        { title: "Project implementation review", event_date: "2026-11-20", event_time: "01:00 PM", category: "review" },
      ]);

      setLoading(false);
    }

    fetchDashboardData();
  }, []);

  const stats = [
    { label: "Active Staff", value: String(metrics.staffCount), change: "Organisation members", icon: Users, color: "teal" },
    { label: "Active Projects", value: String(metrics.projectCount), change: "Active initiatives", icon: FolderKanban, color: "blue" },
    { label: "Open Tasks", value: String(metrics.taskCount), change: "Pending assignments", icon: ClipboardList, color: "purple" },
    { label: "Attendance Today", value: String(metrics.attendanceTodayCount), change: `${Math.round((metrics.attendanceTodayCount / (metrics.staffCount || 1)) * 100)}% of staff`, icon: CalendarDays, color: "orange" },
  ];

  if (loading) {
    return <div className="p-12 text-center text-neutral-500 animate-pulse font-medium">Loading command center...</div>;
  }

  return (
    <div className="dashboard-content space-y-6">
      <section className="welcome-section flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-2xl border border-neutral-100 shadow-sm">
        <div>
          <div className="welcome-date flex items-center gap-2 text-xs font-bold text-indigo-600 mb-1">
            <span className="live-dot w-2 h-2 rounded-full bg-emerald-500 inline-block animate-pulse" /> ORGANISATION OVERVIEW
          </div>
          <h1 className="text-2xl font-extrabold text-neutral-900">Good day, Administrator</h1>
          <p className="text-sm text-neutral-500 mt-0.5">Here's what's happening across your organisation today.</p>
        </div>
        <div className="welcome-actions flex items-center gap-3">
          <select value={period} onChange={(e) => setPeriod(e.target.value)} className="px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-xs font-semibold text-neutral-700 outline-none">
            <option>This week</option>
            <option>This month</option>
            <option>This quarter</option>
          </select>
        </div>
      </section>

      {/* Stats Grid */}
      <section className="stats-grid grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <article className="stat-card bg-white p-5 rounded-2xl border border-neutral-100 shadow-sm" key={stat.label}>
              <div className="stat-top flex justify-between items-center mb-2">
                <span className="text-xs font-bold text-neutral-400 uppercase tracking-wider">{stat.label}</span>
                <div className={`stat-icon p-2 rounded-xl bg-neutral-50 ${stat.color}`}>
                  <Icon size={18} className="text-indigo-600" />
                </div>
              </div>
              <h2 className="text-2xl font-extrabold text-neutral-900 mb-1">{stat.value}</h2>
              <div className="stat-bottom flex items-center text-xs text-neutral-500">
                <span className="stat-indicator flex items-center gap-1 font-medium text-emerald-600"><TrendingUp size={13} /> {stat.change}</span>
              </div>
            </article>
          );
        })}
      </section>

      {/* Middle Grid: Projects & Attendance */}
      <section className="dashboard-middle grid grid-cols-1 lg:grid-cols-2 gap-6">
        <article className="panel project-panel bg-white p-6 rounded-2xl border border-neutral-100 shadow-sm">
          <div className="panel-heading flex justify-between items-center mb-6">
            <div>
              <h3 className="text-base font-bold text-neutral-900">Project performance</h3>
              <p className="text-xs text-neutral-500 mt-0.5">Monitor your ongoing initiatives</p>
            </div>
          </div>

          <div className="project-summary flex justify-between items-center p-4 bg-neutral-50 rounded-xl mb-4">
            <div>
              <strong className="text-xl font-extrabold text-neutral-900">76%</strong>
              <span className="block text-xs text-neutral-500">Overall progress</span>
            </div>
            <div className="summary-badge flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full"><TrendingUp size={14} /> On track</div>
          </div>

          <div className="project-list space-y-4">
            {projectList.map((project, idx) => (
              <div className="project-item space-y-1.5" key={idx}>
                <div className="project-info flex justify-between items-center text-xs font-semibold">
                  <div>
                    <strong className="text-neutral-900">{project.title || project.name}</strong>
                    <small className="block text-neutral-400 font-normal">{project.owner || "Assigned Team"}</small>
                  </div>
                  <span className="text-neutral-700 font-bold">{project.progress || 70}%</span>
                </div>
                <div className="project-progress w-full h-2 bg-neutral-100 rounded-full overflow-hidden">
                  <div className="bg-indigo-600 h-full rounded-full" style={{ width: `${project.progress || 70}%` }} />
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className="panel attendance-panel bg-white p-6 rounded-2xl border border-neutral-100 shadow-sm flex flex-col justify-between">
          <div>
            <div className="panel-heading flex justify-between items-center mb-6">
              <div>
                <h3 className="text-base font-bold text-neutral-900">Staff attendance</h3>
                <p className="text-xs text-neutral-500 mt-0.5">Today's attendance activity</p>
              </div>
            </div>

            <div className="attendance-summary grid grid-cols-3 gap-2 p-4 bg-neutral-50 rounded-xl mb-4 text-center">
              <div>
                <strong className="text-lg font-extrabold text-neutral-900 block">{metrics.attendanceTodayCount}</strong>
                <span className="text-[11px] text-neutral-500">Present</span>
              </div>
              <div>
                <strong className="text-lg font-extrabold text-neutral-900 block">{Math.max(0, metrics.staffCount - metrics.attendanceTodayCount)}</strong>
                <span className="text-[11px] text-neutral-500">Pending</span>
              </div>
              <div>
                <strong className="text-lg font-extrabold text-neutral-900 block">{metrics.staffCount}</strong>
                <span className="text-[11px] text-neutral-500">Total Staff</span>
              </div>
            </div>

            <div className="attendance-list space-y-3">
              {attendanceList.length === 0 ? (
                <p className="text-xs text-neutral-400 text-center py-4">No staff checked in yet today.</p>
              ) : (
                attendanceList.map((person, idx) => (
                  <div className="attendance-row flex items-center justify-between py-2 border-b border-neutral-50 last:border-0" key={idx}>
                    <div className="flex items-center gap-3">
                      <div className="person-avatar w-8 h-8 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-xs">
                        {(person.full_name || "S").substring(0, 2).toUpperCase()}
                      </div>
                      <div className="person-details">
                        <strong className="text-xs font-bold text-neutral-900 block">{person.full_name || "Staff Member"}</strong>
                        <small className="text-[11px] text-neutral-400 capitalize">{person.role || "Staff"}</small>
                      </div>
                    </div>
                    <div className="attendance-time text-right">
                      <span className="text-xs font-semibold text-neutral-700 block">
                        {person.time_in ? new Date(person.time_in).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"}
                      </span>
                      <small className="text-[10px] text-emerald-600 font-bold flex items-center gap-1 justify-end"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" /> Present</small>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </article>
      </section>

      {/* Bottom Grid: Activity & Events */}
      <section className="dashboard-bottom grid grid-cols-1 lg:grid-cols-2 gap-6">
        <article className="panel activity-panel bg-white p-6 rounded-2xl border border-neutral-100 shadow-sm">
          <div className="panel-heading flex justify-between items-center mb-4">
            <div>
              <h3 className="text-base font-bold text-neutral-900">Recent activity</h3>
              <p className="text-xs text-neutral-500 mt-0.5">Latest updates from your team</p>
            </div>
          </div>
          <div className="activity-list space-y-4">
            {activityList.map((item, index) => {
              const Icon = item.icon;
              return (
                <div className="activity-item flex items-center justify-between gap-3" key={index}>
                  <div className="flex items-center gap-3">
                    <div className="activity-icon p-2 rounded-xl bg-neutral-50 text-indigo-600"><Icon size={16} /></div>
                    <div className="activity-details">
                      <strong className="text-xs font-bold text-neutral-900 block">{item.title}</strong>
                      <small className="text-[11px] text-neutral-400">{item.detail}</small>
                    </div>
                  </div>
                  <span className="activity-time text-[11px] text-neutral-400 whitespace-nowrap">{item.time}</span>
                </div>
              );
            })}
          </div>
        </article>

        <article className="panel events-panel bg-white p-6 rounded-2xl border border-neutral-100 shadow-sm">
          <div className="panel-heading flex justify-between items-center mb-4">
            <div>
              <h3 className="text-base font-bold text-neutral-900">Upcoming events</h3>
              <p className="text-xs text-neutral-500 mt-0.5">What's coming up next</p>
            </div>
          </div>

          <div className="events-list space-y-3">
            {eventList.map((event, idx) => {
              const dateObj = new Date(event.event_date || event.date);
              const dayNum = dateObj.getDate() || "12";
              const monthStr = dateObj.toLocaleDateString("en-US", { month: "short" }).toUpperCase() || "NOV";
              return (
                <div className="event-item flex items-center justify-between p-3 bg-neutral-50/50 rounded-xl border border-neutral-100" key={idx}>
                  <div className="flex items-center gap-3">
                    <div className="event-date bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-lg text-center min-w-[45px]">
                      <strong className="block text-sm font-extrabold">{dayNum}</strong>
                      <span className="block text-[9px] font-bold uppercase">{monthStr}</span>
                    </div>
                    <div className="event-info">
                      <strong className="text-xs font-bold text-neutral-900 block">{event.title}</strong>
                      <small className="text-[11px] text-neutral-400 flex items-center gap-1 mt-0.5"><Clock size={11} /> {event.event_time || event.time || "All day"}</small>
                    </div>
                  </div>
                  <ArrowUpRight size={16} className="text-neutral-400" />
                </div>
              );
            })}
          </div>
        </article>
      </section>

      <footer className="dashboard-footer flex justify-between items-center text-xs text-neutral-400 pt-4 border-t border-neutral-100">
        <span>© 2026 Initiative for Research, Innovation and Advocacy in Development</span>
        <span>Knowledge · Inclusion · Impact</span>
      </footer>
    </div>
  );
}
