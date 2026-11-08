import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

/** Return the current moment expressed in Africa/Lagos wall-clock time. */
function nowLagos(): Date {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'Africa/Lagos' }))
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser()
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { attendance_type = 'office', check_in_note, work_date } = await req.json()

    // Get user profile
    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('role, organisation_id')
      .eq('id', user.id)
      .single()
    if (profileError || !profile?.organisation_id) {
      return new Response(JSON.stringify({ error: 'Profile not found' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const orgId = profile.organisation_id
    const targetDate = work_date || nowLagos().toISOString().slice(0, 10)

    // Check working calendar (holiday?)
    const { data: calendar } = await supabaseClient
      .from('working_calendar')
      .select('is_workday, label')
      .eq('organisation_id', orgId)
      .eq('date', targetDate)
      .single()
    if (calendar && !calendar.is_workday) {
      return new Response(JSON.stringify({ error: `${targetDate} is a holiday: ${calendar.label}` }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Check workday (Monday=1 ... Sunday=7) using Lagos wall-clock time
    const dayOfWeek = nowLagos().getDay() || 7
    const { data: policy } = await supabaseClient
      .from('attendance_policy')
      .select('working_days, morning_open_time, morning_close_time, on_time_threshold_minutes, grace_period_minutes')
      .eq('organisation_id', orgId)
      .single()
    if (!policy || !policy.working_days.includes(dayOfWeek)) {
      return new Response(JSON.stringify({ error: `${targetDate} is not a working day` }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Check attendance session is open
    const { data: session } = await supabaseClient
      .from('attendance_sessions')
      .select('morning_opened_at, morning_closed_at, morning_open_override')
      .eq('organisation_id', orgId)
      .eq('work_date', targetDate)
      .single()

    // Determine check-in window
    const openTime = policy.morning_open_time // '08:00'
    const closeTime = policy.morning_close_time // '09:00'
    const grace = policy.grace_period_minutes ?? 0

    // Build the effective check-in timestamp (Lagos time)
    const nowLagos = new Date()
    // Check if we're within the allowed check-in window
    const [openH, openM] = openTime.split(':').map(Number)
    const [closeH, closeM] = closeTime.split(':').map(Number)
    const checkInTime = nowLagos.getHours() * 60 + nowLagos.getMinutes()
    const openMinutes = openH * 60 + openM
    const closeMinutes = closeH * 60 + closeM + grace

    if (checkInTime < openMinutes) {
      return new Response(JSON.stringify({ error: `Check-in opens at ${openTime}` }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    if (checkInTime > closeMinutes) {
      return new Response(JSON.stringify({ error: `Check-in window closed at ${closeTime}` }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Check session open (must exist and be opened, unless override)
    if (!session || (!session.morning_open_override && !session.morning_opened_at)) {
      return new Response(JSON.stringify({ error: 'Attendance session not yet opened for today' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Determine late status
    const threshold = policy.on_time_threshold_minutes ?? 0
    const isLate = checkInTime > openMinutes + threshold

    // Upsert attendance (unique org+staff+date)
    const { data: attendance, error: attError } = await supabaseClient
      .from('attendance')
      .upsert([{
        organisation_id: orgId,
        staff_id: user.id,
        attendance_date: targetDate,
        check_in_at: nowLagos.toISOString(),
        attendance_type,
        check_in_note,
        status: isLate ? 'late' : 'checked_in',
        is_late: isLate,
        updated_at: nowLagos.toISOString(),
      }], { onConflict: 'organisation_id,staff_id,attendance_date' })
      .select().single()

    if (attError) throw attError

    return new Response(JSON.stringify({ success: true, attendance, is_late: isLate }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || 'Internal error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
