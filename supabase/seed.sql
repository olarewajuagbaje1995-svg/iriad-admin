-- Seed data for local development only. LABELLED AS DEMO — never real staff data.
-- Run against a fresh Supabase project AFTER applying migrations 001–008.
-- WARNING: Do not commit real credentials or real personal data.

-- 1. Ensure IRIAD organisation exists (also inserted in migration 001)
insert into public.organisations (id, name, slug, website, address, phone, email, timezone)
values (
  '00000000-0000-0000-0000-000000000001',
  'Initiative for Research, Innovation, and Advocacy in Development (IRIAD)',
  'iriad',
  'https://iriadng.org/',
  '9B Omolara Adeyemi Street, Kings Park IV Estate, Kukwaba, Abuja',
  '+234 704 740 2288',
  'iriadev2020@gmail.com',
  'Africa/Lagos'
) on conflict (slug) do nothing;

-- 2. Departments
insert into public.departments (organisation_id, name, description) values
  ('00000000-0000-0000-0000-000000000001', 'Executive Office', 'CEO and executive leadership support'),
  ('00000000-0000-0000-0000-000000000001', 'Programmes', 'Research, advocacy and programme delivery'),
  ('00000000-0000-0000-0000-000000000001', 'Finance & Admin', 'Finance, HR and administration'),
  ('00000000-0000-0000-0000-000000000001', 'Research & Documentation', 'Research, publications and knowledge management')
on conflict do nothing;

-- 3. Attendance policy for IRIAD (Mon–Fri, 8:00–9:00 check-in)
insert into public.attendance_policy (organisation_id, working_days, morning_open_time, morning_close_time, on_time_threshold_minutes, sign_out_open, grace_period_minutes, allow_manual_extension, reminder_times)
values (
  '00000000-0000-0000-0000-000000000001',
  '{1,2,3,4,5}',
  '08:00',
  '09:00',
  0,
  false,
  15,
  false,
  '{"07:45","08:45"}'
) on conflict (organisation_id) do nothing;

-- NOTE: Real Supabase Auth users must be created via the Supabase dashboard or auth API.
-- The profile records below reference auth.users IDs that must be created first.
-- Example placeholder profiles (replace id values with real auth.users IDs after signup):
/*
insert into public.profiles (id, organisation_id, department_id, email, full_name, role, phone, is_active) values
  ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000001', null, 'ceo@iriad.example', 'Ada Nkwocha (CEO)', 'ceo', '+234 800 000 0001', true),
  ('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000001', null, 'admin@iriad.example', 'Bala Ibrahim (Staff Admin)', 'staff_admin', '+234 800 000 0002', true),
  ('33333333-3333-3333-3333-333333333333', '00000000-0000-0000-0000-000000000001', null, 'staff@iriad.example', 'Chinwe Okafor (Staff)', 'staff', '+234 800 000 0003', true);
*/

-- 4. System settings (demo defaults)
insert into public.system_settings (organisation_id, key, value, description) values
  ('00000000-0000-0000-0000-000000000001', 'report_weekly_deadline', '"Friday"', 'Weekly report deadline rule'),
  ('00000000-0000-0000-0000-000000000001', 'report_monthly_deadline', '"Last working day of month"', 'Monthly report deadline rule'),
  ('00000000-0000-0000-0000-000000000001', 'email_daily_report', 'true', 'Send daily 9:00 AM attendance snapshot'),
  ('00000000-0000-0000-0000-000000000001', 'n8n_base_url', '""', 'n8n base URL for webhooks')
on conflict (organisation_id, key) do nothing;

-- 5. Demo reporting periods
insert into public.reporting_periods (organisation_id, period_type, label, start_date, end_date, due_date, deadline_rule)
values
  ('00000000-0000-0000-0000-000000000001', 'weekly', 'Week of 2026-11-02', '2026-11-02', '2026-11-08', '2026-11-06', 'Friday'),
  ('00000000-0000-0000-0000-000000000001', 'monthly', 'November 2026', '2026-11-01', '2026-11-30', '2026-11-30', 'Last working day of month')
on conflict do nothing;

-- 6. Email report recipients (configured by admin — not hardcoded in workflows)
insert into public.email_report_recipients (organisation_id, email, name, report_types, is_active) values
  ('00000000-0000-0000-0000-000000000001', 'admin@iriad.example', 'Staff Admin', '{"daily","weekly","monthly"}', true),
  ('00000000-0000-0000-0000-000000000001', 'ceo@iriad.example', 'CEO', '{"daily","weekly","monthly"}', true)
on conflict do nothing;
