import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const LAGOS_TZ = 'Africa/Lagos'

/** Current moment expressed in Africa/Lagos wall-clock time. */
function nowLagos(): Date {
  return new Date(new Date().toLocaleString('en-US', { timeZone: LAGOS_TZ }))
}

/** Lagos calendar date (YYYY-MM-DD) for a given moment (defaults to now). */
function lagosDate(d: Date = nowLagos()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: LAGOS_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d)
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  })
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    // Service-role client (bypasses RLS) carrying the caller's JWT so
    // auth.getUser() resolves the acting user.
    const sb = createClient(supabaseUrl, serviceRole, {
      global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
    })

    const { data: { user }, error: userError } = await sb.auth.getUser()
    if (userError || !user) {
      return json({ error: 'Unauthorized' }, 401)
    }

    const { data: profile } = await sb
      .from('profiles')
      .select('id, role, organisation_id')
      .eq('id', user.id)
      .single()
    if (!profile?.organisation_id) {
      return json({ error: 'Profile not found' }, 400)
    }

    const role: string = profile.role
    const orgId: string = profile.organisation_id
    const isAdmin = role === 'admin' || role === 'director'

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
    const action: string = String(body.action ?? '')

    // ------------------------------------------------------------------
    // GET STATUS — today's record + window state (staff or admin)
    // ------------------------------------------------------------------
    if (action === 'get_status') {
      const workDate: string = (body.work_date ?? lagosDate()) as string

      const [policyRes, sessionRes, recordRes] = await Promise.all([
        sb.from('attendance_policy')
          .select('working_days, morning_open_time, morning_close_time, on_time_threshold_minutes, grace_period_minutes')
          .eq('organisation_id', orgId)
          .maybeSingle(),
        sb.from('attendance_sessions')
          .select('morning_opened_at, morning_closed_at, morning_open_override, sign_out_opened_at, sign_out_closed_at, sign_out_open_override')
          .eq('organisation_id', orgId)
          .eq('work_date', workDate)
          .maybeSingle(),
        isAdmin
          ? sb.from('attendance').select('*').eq('organisation_id', orgId).eq('attendance_date', workDate).order('staff_id')
          : sb.from('attendance').select('*').eq('staff_id', user.id).eq('attendance_date', workDate).maybeSingle(),
      ])

      const policy = policyRes.data
      const session = sessionRes.data
      const todayRecord = Array.isArray(recordRes.data) ? recordRes.data[0] : recordRes.data

      const now = nowLagos()
      const dayOfWeek = now.getDay() || 7
      const isWorkday = policy?.working_days?.includes(dayOfWeek) ?? false
      const [openH, openM] = (policy?.morning_open_time ?? '08:00').split(':').map(Number)
      const [closeH, closeM] = (policy?.morning_close_time ?? '09:00').split(':').map(Number)
      const grace = policy?.grace_period_minutes ?? 0
      const checkInMinutes = now.getHours() * 60 + now.getMinutes()
      const openMinutes = openH * 60 + openM
      const closeMinutes = closeH * 60 + closeM + grace
      const checkInWindowOpen =
        session?.morning_open_override || session?.morning_opened_at
          ? checkInMinutes >= openMinutes && checkInMinutes <= closeMinutes
          : false

      return json({
        work_date: workDate,
        role,
        is_workday: isWorkday,
        check_in_window_open: checkInWindowOpen,
        sign_out_window_open: !!(
          session?.sign_out_open_override || session?.sign_out_opened_at
        ),
        today_record: todayRecord ?? null,
        policy,
        session,
      })
    }

    // ------------------------------------------------------------------
    // CHECK IN — staff only, server-enforced window + no duplicates
    // ------------------------------------------------------------------
    if (action === 'check_in') {
      if (isAdmin) {
        return json({ error: 'Admins cannot check in' }, 403)
      }

      const workDate: string = (body.work_date ?? lagosDate()) as string
      const attendanceType: string = String(body.attendance_type ?? 'office')
      const checkInNote: string | null = body.check_in_note ?? null

      // Working calendar (holiday?)
      const { data: calendar } = await sb
        .from('working_calendar')
        .select('is_workday, label')
        .eq('organisation_id', orgId)
        .eq('date', workDate)
        .maybeSingle()
      if (calendar && !calendar.is_workday) {
        return json({ error: `${workDate} is a holiday: ${calendar.label}` }, 400)
      }

      // Attendance policy
      const { data: policy } = await sb
        .from('attendance_policy')
        .select('working_days, morning_open_time, morning_close_time, on_time_threshold_minutes, grace_period_minutes')
        .eq('organisation_id', orgId)
        .single()
      if (!policy) {
        return json({ error: 'Attendance policy not configured for this organisation' }, 400)
      }

      const dayOfWeek = nowLagos().getDay() || 7
      if (!policy.working_days.includes(dayOfWeek)) {
        return json({ error: `${workDate} is not a working day` }, 400)
      }

      // Attendance session must be opened for today (admin-controlled)
      const { data: session } = await sb
        .from('attendance_sessions')
        .select('morning_opened_at, morning_open_override')
        .eq('organisation_id', orgId)
        .eq('work_date', workDate)
        .maybeSingle()
      if (!session || (!session.morning_open_override && !session.morning_opened_at)) {
        return json({ error: 'Check-in window not yet opened for today' }, 400)
      }

      // Time window enforcement (Africa/Lagos)
      const now = nowLagos()
      const [openH, openM] = policy.morning_open_time.split(':').map(Number)
      const [closeH, closeM] = policy.morning_close_time.split(':').map(Number)
      const grace = policy.grace_period_minutes ?? 0
      const checkInMinutes = now.getHours() * 60 + now.getMinutes()
      const openMinutes = openH * 60 + openM
      const closeMinutes = closeH * 60 + closeM + grace

      if (checkInMinutes < openMinutes) {
        return json({ error: `Check-in opens at ${policy.morning_open_time}` }, 400)
      }
      if (checkInMinutes > closeMinutes) {
        return json({ error: `Check-in window closed at ${policy.morning_close_time}` }, 400)
      }

      const threshold = policy.on_time_threshold_minutes ?? 0
      const isLate = checkInMinutes > openMinutes + threshold

      // Prevent duplicate check-in for staff/date
      const { data: existing } = await sb
        .from('attendance')
        .select('id, check_in_at, status')
        .eq('organisation_id', orgId)
        .eq('staff_id', user.id)
        .eq('attendance_date', workDate)
        .maybeSingle()
      if (existing) {
        return json({
          error: 'Already checked in today',
          attendance_id: existing.id,
          check_in_at: existing.check_in_at,
          status: existing.status,
        }, 409)
      }

      const checkInAt = nowLagos().toISOString()
      const { data: attendance, error: attError } = await sb
        .from('attendance')
        .insert([{
          organisation_id: orgId,
          staff_id: user.id,
          attendance_date: workDate,
          check_in_at: checkInAt,
          attendance_type: attendanceType,
          check_in_note: checkInNote,
          status: isLate ? 'late' : 'checked_in',
          is_late: isLate,
          created_at: checkInAt,
          updated_at: checkInAt,
        }])
        .select().single()

      if (attError) throw attError

      return json({ success: true, attendance, is_late })
    }

    // ------------------------------------------------------------------
    // SIGN OUT — staff only, must be checked in today, window open
    // ------------------------------------------------------------------
    if (action === 'sign_out') {
      if (isAdmin) {
        return json({ error: 'Admins cannot sign out' }, 403)
      }

      const workDate: string = (body.work_date ?? lagosDate()) as string

      const { data: record } = await sb
        .from('attendance')
        .select('id, check_in_at, check_out_at, status')
        .eq('organisation_id', orgId)
        .eq('staff_id', user.id)
        .eq('attendance_date', workDate)
        .maybeSingle()
      if (!record || !record.check_in_at) {
        return json({ error: 'No check-in record for today' }, 400)
      }
      if (record.check_out_at) {
        return json({ error: 'Already checked out today' }, 400)
      }

      // Sign-out window must be open (admin-controlled)
      const { data: session } = await sb
        .from('attendance_sessions')
        .select('sign_out_opened_at, sign_out_open_override')
        .eq('organisation_id', orgId)
        .eq('work_date', workDate)
        .maybeSingle()
      if (!session || (!session.sign_out_open_override && !session.sign_out_opened_at)) {
        return json({ error: 'Sign-out window is not open yet' }, 400)
      }

      const checkOutAt = nowLagos().toISOString()
      const { data: attendance, error: attError } = await sb
        .from('attendance')
        .update({
          check_out_at: checkOutAt,
          status: 'checked_out',
          updated_at: checkOutAt,
        })
        .eq('id', record.id)
        .select().single()

      if (attError) throw attError

      return json({ success: true, attendance })
    }

    // ------------------------------------------------------------------
    // TOGGLE MORNING — admin/director only
    // ------------------------------------------------------------------
    if (action === 'toggle_morning') {
      if (!isAdmin) {
        return json({ error: 'Admins only' }, 403)
      }

      const workDate: string = (body.work_date ?? lagosDate()) as string
      const open: boolean = body.open === true

      const nowISO = nowLagos().toISOString()
      const { data: session, error } = await sb
        .from('attendance_sessions')
        .upsert({
          organisation_id: orgId,
          work_date: workDate,
          morning_open_override: open,
          morning_opened_at: open ? nowISO : null,
          morning_closed_at: open ? null : nowISO,
          updated_at: nowISO,
        }, { onConflict: 'organisation_id,work_date' })
        .select().single()

      if (error) throw error

      return json({ success: true, session, action: open ? 'opened' : 'closed', work_date: workDate })
    }

    // ------------------------------------------------------------------
    // TOGGLE SIGN OUT — admin/director only
    // ------------------------------------------------------------------
    if (action === 'toggle_sign_out') {
      if (!isAdmin) {
        return json({ error: 'Admins only' }, 403)
      }

      const workDate: string = (body.work_date ?? lagosDate()) as string
      const open: boolean = body.open === true

      const nowISO = nowLagos().toISOString()
      const { data: session, error } = await sb
        .from('attendance_sessions')
        .upsert({
          organisation_id: orgId,
          work_date: workDate,
          sign_out_open_override: open,
          sign_out_opened_at: open ? nowISO : null,
          sign_out_closed_at: open ? null : nowISO,
          updated_at: nowISO,
        }, { onConflict: 'organisation_id,work_date' })
        .select().single()

      if (error) throw error

      return json({ success: true, session, action: open ? 'opened' : 'closed', work_date: workDate })
    }

    return json({ error: 'Unknown action' }, 400)
  } catch (err: any) {
    return json({ error: err.message || 'Internal error' }, 500)
  }
})
