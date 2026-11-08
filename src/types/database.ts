export type Database = {
  public: {
    Tables: {
      organisations: {
        Row: { id: string; name: string | null; slug: string | null; website: string | null; address: string | null; phone: string | null; email: string | null; logo_url: string | null; timezone: string; is_active: boolean; created_at: string; updated_at: string }
        Insert: { id?: string; name?: string; slug?: string; website?: string; address?: string; phone?: string; email?: string; logo_url?: string; timezone?: string; is_active?: boolean; created_at?: string; updated_at?: string }
        Update: { id?: string; name?: string; slug?: string; website?: string; address?: string; phone?: string; email?: string; logo_url?: string; timezone?: string; is_active?: boolean; created_at?: string; updated_at?: string }
      }
      profiles: {
        Row: { id: string; organisation_id: string | null; department_id: string | null; email: string | null; full_name: string | null; role: string | null; avatar_url: string | null; phone: string | null; is_active: boolean | null; created_at: string; updated_at: string }
        Insert: { id?: string; organisation_id?: string; department_id?: string; email?: string; full_name?: string; role?: string; avatar_url?: string; phone?: string; is_active?: boolean; created_at?: string; updated_at?: string }
        Update: { id?: string; organisation_id?: string; department_id?: string; email?: string; full_name?: string; role?: string; avatar_url?: string; phone?: string; is_active?: boolean; created_at?: string; updated_at?: string }
      }
      departments: {
        Row: { id: string; organisation_id: string; name: string; description: string | null; created_at: string; updated_at: string }
        Insert: { id?: string; organisation_id: string; name: string; description?: string; created_at?: string; updated_at?: string }
        Update: { id?: string; organisation_id?: string; name?: string; description?: string; created_at?: string; updated_at?: string }
      }
      organisation_members: {
        Row: { id: string; organisation_id: string; profile_id: string; role: string; created_at: string }
        Insert: { id?: string; organisation_id: string; profile_id: string; role?: string; created_at?: string }
        Update: { id?: string; organisation_id?: string; profile_id?: string; role?: string; created_at?: string }
      }
      system_settings: {
        Row: { id: string; organisation_id: string; key: string; value: any; description: string | null; created_at: string; updated_at: string }
        Insert: { id?: string; organisation_id: string; key: string; value?: any; description?: string; created_at?: string; updated_at?: string }
        Update: { id?: string; organisation_id?: string; key?: string; value?: any; description?: string; created_at?: string; updated_at?: string }
      }
      activity_logs: {
        Row: { id: string; organisation_id: string; actor_id: string | null; action: string; target_type: string | null; target_id: string | null; metadata: any; created_at: string }
        Insert: { id?: string; organisation_id: string; actor_id?: string; action: string; target_type?: string; target_id?: string; metadata?: any; created_at?: string }
        Update: { id?: string; organisation_id?: string; actor_id?: string; action?: string; target_type?: string; target_id?: string; metadata?: any; created_at?: string }
      }
      attendance_policy: {
        Row: { id: string; organisation_id: string; working_days: number[]; morning_open_time: string; morning_close_time: string; on_time_threshold_minutes: number; sign_out_open: boolean; sign_out_scheduled: boolean; grace_period_minutes: number; allow_manual_extension: boolean; reminder_times: string[]; created_at: string; updated_at: string }
        Insert: { id?: string; organisation_id: string; working_days?: number[]; morning_open_time?: string; morning_close_time?: string; on_time_threshold_minutes?: number; sign_out_open?: boolean; sign_out_scheduled?: boolean; grace_period_minutes?: number; allow_manual_extension?: boolean; reminder_times?: string[]; created_at?: string; updated_at?: string }
        Update: { id?: string; organisation_id?: string; working_days?: number[]; morning_open_time?: string; morning_close_time?: string; on_time_threshold_minutes?: number; sign_out_open?: boolean; sign_out_scheduled?: boolean; grace_period_minutes?: number; allow_manual_extension?: boolean; reminder_times?: string[]; created_at?: string; updated_at?: string }
      }
      working_calendar: {
        Row: { id: string; organisation_id: string; date: string; is_workday: boolean; label: string | null; created_at: string }
        Insert: { id?: string; organisation_id: string; date: string; is_workday?: boolean; label?: string; created_at?: string }
        Update: { id?: string; organisation_id?: string; date?: string; is_workday?: boolean; label?: string; created_at?: string }
      }
      attendance_sessions: {
        Row: { id: string; organisation_id: string; work_date: string; morning_opened_at: string | null; morning_closed_at: string | null; sign_out_opened_at: string | null; sign_out_closed_at: string | null; morning_open_override: boolean; sign_out_open_override: boolean; created_at: string; updated_at: string }
        Insert: { id?: string; organisation_id: string; work_date: string; morning_opened_at?: string; morning_closed_at?: string; sign_out_opened_at?: string; sign_out_closed_at?: string; morning_open_override?: boolean; sign_out_open_override?: boolean; created_at?: string; updated_at?: string }
        Update: { id?: string; organisation_id?: string; work_date?: string; morning_opened_at?: string; morning_closed_at?: string; sign_out_opened_at?: string; sign_out_closed_at?: string; morning_open_override?: boolean; sign_out_open_override?: boolean; created_at?: string; updated_at?: string }
      }
      attendance: {
        Row: { id: string; organisation_id: string; staff_id: string; attendance_date: string; check_in_at: string | null; check_out_at: string | null; attendance_type: string; status: string; is_late: boolean; check_in_note: string | null; created_at: string; updated_at: string }
        Insert: { id?: string; organisation_id: string; staff_id: string; attendance_date: string; check_in_at?: string; check_out_at?: string; attendance_type?: string; status?: string; is_late?: boolean; check_in_note?: string; created_at?: string; updated_at?: string }
        Update: { id?: string; organisation_id?: string; staff_id?: string; attendance_date?: string; check_in_at?: string; check_out_at?: string; attendance_type?: string; status?: string; is_late?: boolean; check_in_note?: string; created_at?: string; updated_at?: string }
      }
      attendance_corrections: {
        Row: { id: string; organisation_id: string; attendance_id: string | null; staff_id: string; requested_by: string; approved_by: string | null; correction_type: string; old_value: string | null; new_value: string; reason: string; status: string; reviewed_at: string | null; created_at: string; updated_at: string }
        Insert: { id?: string; organisation_id: string; attendance_id?: string; staff_id: string; requested_by: string; approved_by?: string; correction_type: string; old_value?: string; new_value: string; reason: string; status?: string; reviewed_at?: string; created_at?: string; updated_at?: string }
        Update: { id?: string; organisation_id?: string; attendance_id?: string; staff_id?: string; requested_by?: string; approved_by?: string; correction_type?: string; old_value?: string; new_value?: string; reason?: string; status?: string; reviewed_at?: string; created_at?: string; updated_at?: string }
      }
      leave_requests: {
        Row: { id: string; organisation_id: string; staff_id: string; leave_type: string; start_date: string; end_date: string; reason: string; status: string; approved_by: string | null; reviewed_at: string | null; created_at: string; updated_at: string }
        Insert: { id?: string; organisation_id: string; staff_id: string; leave_type: string; start_date: string; end_date: string; reason: string; status?: string; approved_by?: string; reviewed_at?: string; created_at?: string; updated_at?: string }
        Update: { id?: string; organisation_id?: string; staff_id?: string; leave_type?: string; start_date?: string; end_date?: string; reason?: string; status?: string; approved_by?: string; reviewed_at?: string; created_at?: string; updated_at?: string }
      }
      projects: {
        Row: { id: string; organisation_id: string; title: string; description: string | null; objectives: string | null; start_date: string | null; end_date: string | null; project_lead_id: string | null; status: string; created_by: string; created_at: string; updated_at: string }
        Insert: { id?: string; organisation_id: string; title: string; description?: string; objectives?: string; start_date?: string; end_date?: string; project_lead_id?: string; status?: string; created_by: string; created_at?: string; updated_at?: string }
        Update: { id?: string; organisation_id?: string; title?: string; description?: string; objectives?: string; start_date?: string; end_date?: string; project_lead_id?: string; status?: string; created_by?: string; created_at?: string; updated_at?: string }
      }
      project_members: {
        Row: { id: string; project_id: string; profile_id: string; role: string; joined_at: string }
        Insert: { id?: string; project_id: string; profile_id: string; role?: string; joined_at?: string }
        Update: { id?: string; project_id?: string; profile_id?: string; role?: string; joined_at?: string }
      }
      project_milestones: {
        Row: { id: string; project_id: string; title: string; description: string | null; due_date: string | null; status: string; created_at: string; updated_at: string }
        Insert: { id?: string; project_id: string; title: string; description?: string; due_date?: string; status?: string; created_at?: string; updated_at?: string }
        Update: { id?: string; project_id?: string; title?: string; description?: string; due_date?: string; status?: string; created_at?: string; updated_at?: string }
      }
      tasks: {
        Row: { id: string; organisation_id: string; project_id: string | null; title: string; description: string | null; instructions: string | null; priority: string; status: string; due_date: string | null; created_by: string; created_at: string; updated_at: string }
        Insert: { id?: string; organisation_id: string; project_id?: string; title: string; description?: string; instructions?: string; priority?: string; status?: string; due_date?: string; created_by: string; created_at?: string; updated_at?: string }
        Update: { id?: string; organisation_id?: string; project_id?: string; title?: string; description?: string; instructions?: string; priority?: string; status?: string; due_date?: string; created_by?: string; created_at?: string; updated_at?: string }
      }
      task_assignees: {
        Row: { id: string; task_id: string; profile_id: string; assigned_at: string; assigned_by: string | null }
        Insert: { id?: string; task_id: string; profile_id: string; assigned_at?: string; assigned_by?: string }
        Update: { id?: string; task_id?: string; profile_id?: string; assigned_at?: string; assigned_by?: string }
      }
      task_updates: {
        Row: { id: string; task_id: string; profile_id: string; status: string; progress_note: string | null; submitted_at: string | null; created_at: string }
        Insert: { id?: string; task_id: string; profile_id: string; status: string; progress_note?: string; submitted_at?: string; created_at?: string }
        Update: { id?: string; task_id?: string; profile_id?: string; status?: string; progress_note?: string; submitted_at?: string; created_at?: string }
      }
      project_tables: {
        Row: { id: string; project_id: string; title: string; description: string | null; created_by: string; created_at: string; updated_at: string }
        Insert: { id?: string; project_id: string; title: string; description?: string; created_by: string; created_at?: string; updated_at?: string }
        Update: { id?: string; project_id?: string; title?: string; description?: string; created_by?: string; created_at?: string; updated_at?: string }
      }
      project_table_columns: {
        Row: { id: string; table_id: string; name: string; column_type: string; options: any; is_required: boolean; position: number; created_at: string }
        Insert: { id?: string; table_id: string; name: string; column_type: string; options?: any; is_required?: boolean; position?: number; created_at?: string }
        Update: { id?: string; table_id?: string; name?: string; column_type?: string; options?: any; is_required?: boolean; position?: number; created_at?: string }
      }
      project_table_rows: {
        Row: { id: string; table_id: string; data: any; created_by: string; created_at: string; updated_at: string }
        Insert: { id?: string; table_id: string; data?: any; created_by: string; created_at?: string; updated_at?: string }
        Update: { id?: string; table_id?: string; data?: any; created_by?: string; created_at?: string; updated_at?: string }
      }
      project_deliverables: {
        Row: { id: string; project_id: string; title: string; description: string | null; due_date: string | null; status: string; version: number; submitted_at: string | null; submitted_by: string | null; created_at: string; updated_at: string }
        Insert: { id?: string; project_id: string; title: string; description?: string; due_date?: string; status?: string; version?: number; submitted_at?: string; submitted_by?: string; created_at?: string; updated_at?: string }
        Update: { id?: string; project_id?: string; title?: string; description?: string; due_date?: string; status?: string; version?: number; submitted_at?: string; submitted_by?: string; created_at?: string; updated_at?: string }
      }
      project_reviews: {
        Row: { id: string; deliverable_id: string; reviewer_id: string; decision: string; comments: string | null; reviewed_at: string; created_at: string }
        Insert: { id?: string; deliverable_id: string; reviewer_id: string; decision: string; comments?: string; reviewed_at?: string; created_at?: string }
        Update: { id?: string; deliverable_id?: string; reviewer_id?: string; decision?: string; comments?: string; reviewed_at?: string; created_at?: string }
      }
      reporting_periods: {
        Row: { id: string; organisation_id: string; period_type: string; label: string; start_date: string; end_date: string; due_date: string; deadline_rule: string | null; is_closed: boolean; created_at: string; updated_at: string }
        Insert: { id?: string; organisation_id: string; period_type: string; label: string; start_date: string; end_date: string; due_date: string; deadline_rule?: string; is_closed?: boolean; created_at?: string; updated_at?: string }
        Update: { id?: string; organisation_id?: string; period_type?: string; label?: string; start_date?: string; end_date?: string; due_date?: string; deadline_rule?: string; is_closed?: boolean; created_at?: string; updated_at?: string }
      }
      weekly_reports: {
        Row: { id: string; organisation_id: string; reporting_period_id: string | null; staff_id: string; reporting_week_start: string; activities_carried_out: string | null; tasks_completed: string | null; meetings_attended: string | null; achievements_outcomes: string | null; challenges: string | null; outstanding_activities: string | null; next_week_plan: string; supporting_documents: any; status: string; submitted_at: string | null; version: number; created_at: string; updated_at: string }
        Insert: { id?: string; organisation_id: string; reporting_period_id?: string; staff_id: string; reporting_week_start: string; activities_carried_out?: string; tasks_completed?: string; meetings_attended?: string; achievements_outcomes?: string; challenges?: string; outstanding_activities?: string; next_week_plan?: string; supporting_documents?: any; status?: string; submitted_at?: string; version?: number; created_at?: string; updated_at?: string }
        Update: { id?: string; organisation_id?: string; reporting_period_id?: string; staff_id?: string; reporting_week_start?: string; activities_carried_out?: string; tasks_completed?: string; meetings_attended?: string; achievements_outcomes?: string; challenges?: string; outstanding_activities?: string; next_week_plan?: string; supporting_documents?: any; status?: string; submitted_at?: string; version?: number; created_at?: string; updated_at?: string }
      }
      monthly_reports: {
        Row: { id: string; organisation_id: string; reporting_period_id: string | null; staff_id: string; reporting_month: string; major_activities: string | null; key_achievements: string | null; project_contributions: string | null; meetings_engagements: string | null; challenges_lessons: string | null; outstanding_responsibilities: string | null; recommendations: string | null; next_month_priorities: string | null; supporting_documents: any; status: string; submitted_at: string | null; version: number; created_at: string; updated_at: string }
        Insert: { id?: string; organisation_id: string; reporting_period_id?: string; staff_id: string; reporting_month: string; major_activities?: string; key_achievements?: string; project_contributions?: string; meetings_engagements?: string; challenges_lessons?: string; outstanding_responsibilities?: string; recommendations?: string; next_month_priorities?: string; supporting_documents?: any; status?: string; submitted_at?: string; version?: number; created_at?: string; updated_at?: string }
        Update: { id?: string; organisation_id?: string; reporting_period_id?: string; staff_id?: string; reporting_month?: string; major_activities?: string; key_achievements?: string; project_contributions?: string; meetings_engagements?: string; challenges_lessons?: string; outstanding_responsibilities?: string; recommendations?: string; next_month_priorities?: string; supporting_documents?: any; status?: string; submitted_at?: string; version?: number; created_at?: string; updated_at?: string }
      }
      report_reviews: {
        Row: { id: string; organisation_id: string; weekly_report_id: string | null; monthly_report_id: string | null; reviewer_id: string; decision: string; comments: string | null; reviewed_at: string; created_at: string }
        Insert: { id?: string; organisation_id: string; weekly_report_id?: string; monthly_report_id?: string; reviewer_id: string; decision: string; comments?: string; reviewed_at?: string; created_at?: string }
        Update: { id?: string; organisation_id?: string; weekly_report_id?: string; monthly_report_id?: string; reviewer_id?: string; decision?: string; comments?: string; reviewed_at?: string; created_at?: string }
      }
      report_schedules: {
        Row: { id: string; organisation_id: string; report_type: string; deadline_rule: string; reminder_cadence: string; grace_period_days: number; recipients: any; is_active: boolean; created_at: string; updated_at: string }
        Insert: { id?: string; organisation_id: string; report_type: string; deadline_rule: string; reminder_cadence: string; grace_period_days?: number; recipients?: any; is_active?: boolean; created_at?: string; updated_at?: string }
        Update: { id?: string; organisation_id?: string; report_type?: string; deadline_rule?: string; reminder_cadence?: string; grace_period_days?: number; recipients?: any; is_active?: boolean; created_at?: string; updated_at?: string }
      }
      chat_rooms: {
        Row: { id: string; organisation_id: string; name: string; description: string | null; image_url: string | null; is_private: boolean; is_archived: boolean; who_can_send: string; created_by: string; created_at: string; updated_at: string }
        Insert: { id?: string; organisation_id: string; name: string; description?: string; image_url?: string; is_private?: boolean; is_archived?: boolean; who_can_send?: string; created_by: string; created_at?: string; updated_at?: string }
        Update: { id?: string; organisation_id?: string; name?: string; description?: string; image_url?: string; is_private?: boolean; is_archived?: boolean; who_can_send?: string; created_by?: string; created_at?: string; updated_at?: string }
      }
      chat_room_members: {
        Row: { id: string; room_id: string; profile_id: string; is_room_admin: boolean; joined_at: string }
        Insert: { id?: string; room_id: string; profile_id: string; is_room_admin?: boolean; joined_at?: string }
        Update: { id?: string; room_id?: string; profile_id?: string; is_room_admin?: boolean; joined_at?: string }
      }
      chat_messages: {
        Row: { id: string; room_id: string; profile_id: string; parent_message_id: string | null; body: string; message_type: string; edited: boolean; deleted: boolean; created_at: string; updated_at: string }
        Insert: { id?: string; room_id: string; profile_id: string; parent_message_id?: string; body: string; message_type?: string; edited?: boolean; deleted?: boolean; created_at?: string; updated_at?: string }
        Update: { id?: string; room_id?: string; profile_id?: string; parent_message_id?: string; body?: string; message_type?: string; edited?: boolean; deleted?: boolean; created_at?: string; updated_at?: string }
      }
      chat_message_attachments: {
        Row: { id: string; message_id: string; storage_path: string; file_name: string; file_type: string; file_size: number; created_at: string }
        Insert: { id?: string; message_id: string; storage_path: string; file_name: string; file_type: string; file_size: number; created_at?: string }
        Update: { id?: string; message_id?: string; storage_path?: string; file_name?: string; file_type?: string; file_size?: number; created_at?: string }
      }
      chat_message_reactions: {
        Row: { id: string; message_id: string; profile_id: string; emoji: string; created_at: string }
        Insert: { id?: string; message_id: string; profile_id: string; emoji: string; created_at?: string }
        Update: { id?: string; message_id?: string; profile_id?: string; emoji?: string; created_at?: string }
      }
      chat_message_reads: {
        Row: { id: string; message_id: string; profile_id: string; read_at: string }
        Insert: { id?: string; message_id: string; profile_id: string; read_at?: string }
        Update: { id?: string; message_id?: string; profile_id?: string; read_at?: string }
      }
      announcements: {
        Row: { id: string; organisation_id: string; title: string; body: string; category: string | null; attachment_url: string | null; expires_at: string | null; is_pinned: boolean; comments_closed: boolean; is_published: boolean; published_at: string | null; created_by: string; created_at: string; updated_at: string }
        Insert: { id?: string; organisation_id: string; title: string; body: string; category?: string; attachment_url?: string; expires_at?: string; is_pinned?: boolean; comments_closed?: boolean; is_published?: boolean; published_at?: string; created_by: string; created_at?: string; updated_at?: string }
        Update: { id?: string; organisation_id?: string; title?: string; body?: string; category?: string; attachment_url?: string; expires_at?: string; is_pinned?: boolean; comments_closed?: boolean; is_published?: boolean; published_at?: string; created_by?: string; created_at?: string; updated_at?: string }
      }
      announcement_comments: {
        Row: { id: string; announcement_id: string; profile_id: string; body: string; created_at: string; updated_at: string }
        Insert: { id?: string; announcement_id: string; profile_id: string; body: string; created_at?: string; updated_at?: string }
        Update: { id?: string; announcement_id?: string; profile_id?: string; body?: string; created_at?: string; updated_at?: string }
      }
      announcement_reads: {
        Row: { id: string; announcement_id: string; profile_id: string; read_at: string }
        Insert: { id?: string; announcement_id: string; profile_id: string; read_at?: string }
        Update: { id?: string; announcement_id?: string; profile_id?: string; read_at?: string }
      }
      documents: {
        Row: { id: string; organisation_id: string; title: string; category: string | null; description: string | null; storage_path: string; file_name: string; file_type: string; file_size: number; owner_id: string; linked_to_type: string | null; linked_to_id: string | null; version: number; is_public: boolean; created_at: string; updated_at: string }
        Insert: { id?: string; organisation_id: string; title: string; category?: string; description?: string; storage_path: string; file_name: string; file_type: string; file_size: number; owner_id: string; linked_to_type?: string; linked_to_id?: string; version?: number; is_public?: boolean; created_at?: string; updated_at?: string }
        Update: { id?: string; organisation_id?: string; title?: string; category?: string; description?: string; storage_path?: string; file_name?: string; file_type?: string; file_size?: number; owner_id?: string; linked_to_type?: string; linked_to_id?: string; version?: number; is_public?: boolean; created_at?: string; updated_at?: string }
      }
      document_versions: {
        Row: { id: string; document_id: string; storage_path: string; file_name: string; file_type: string; file_size: number; version: number; uploaded_by: string; created_at: string }
        Insert: { id?: string; document_id: string; storage_path: string; file_name: string; file_type: string; file_size: number; version: number; uploaded_by: string; created_at?: string }
        Update: { id?: string; document_id?: string; storage_path?: string; file_name?: string; file_type?: string; file_size?: number; version?: number; uploaded_by?: string; created_at?: string }
      }
      calendar_events: {
        Row: { id: string; organisation_id: string; title: string; description: string | null; event_type: string; start_at: string; end_at: string; location: string | null; participants: any; related_to_type: string | null; related_to_id: string | null; created_by: string; created_at: string; updated_at: string }
        Insert: { id?: string; organisation_id: string; title: string; description?: string; event_type: string; start_at: string; end_at: string; location?: string; participants?: any; related_to_type?: string; related_to_id?: string; created_by: string; created_at?: string; updated_at?: string }
        Update: { id?: string; organisation_id?: string; title?: string; description?: string; event_type?: string; start_at?: string; end_at?: string; location?: string; participants?: any; related_to_type?: string; related_to_id?: string; created_by?: string; created_at?: string; updated_at?: string }
      }
      notifications: {
        Row: { id: string; organisation_id: string; recipient_id: string; actor_id: string | null; type: string; title: string; body: string | null; link: string | null; is_read: boolean; read_at: string | null; created_at: string }
        Insert: { id?: string; organisation_id: string; recipient_id: string; actor_id?: string; type: string; title: string; body?: string; link?: string; is_read?: boolean; read_at?: string; created_at?: string }
        Update: { id?: string; organisation_id?: string; recipient_id?: string; actor_id?: string; type?: string; title?: string; body?: string; link?: string; is_read?: boolean; read_at?: string; created_at?: string }
      }
      email_report_recipients: {
        Row: { id: string; organisation_id: string; email: string; name: string | null; report_types: string[]; is_active: boolean; created_at: string; updated_at: string }
        Insert: { id?: string; organisation_id: string; email: string; name?: string; report_types?: string[]; is_active?: boolean; created_at?: string; updated_at?: string }
        Update: { id?: string; organisation_id?: string; email?: string; name?: string; report_types?: string[]; is_active?: boolean; created_at?: string; updated_at?: string }
      }
      generated_reports: {
        Row: { id: string; organisation_id: string; report_type: string; period_start: string; period_end: string; generated_at: string; generated_by: string | null; html_path: string | null; pdf_path: string | null; delivery_status: string; idempotency_key: string; created_at: string }
        Insert: { id?: string; organisation_id: string; report_type: string; period_start: string; period_end: string; generated_at?: string; generated_by?: string; html_path?: string; pdf_path?: string; delivery_status?: string; idempotency_key: string; created_at?: string }
        Update: { id?: string; organisation_id?: string; report_type?: string; period_start?: string; period_end?: string; generated_at?: string; generated_by?: string; html_path?: string; pdf_path?: string; delivery_status?: string; idempotency_key?: string; created_at?: string }
      }
      email_logs: {
        Row: { id: string; organisation_id: string | null; recipient: string; subject: string | null; provider_message_id: string | null; status: string; failure_reason: string | null; sent_at: string }
        Insert: { id?: string; organisation_id?: string; recipient: string; subject?: string; provider_message_id?: string; status: string; failure_reason?: string; sent_at?: string }
        Update: { id?: string; organisation_id?: string; recipient?: string; subject?: string; provider_message_id?: string; status?: string; failure_reason?: string; sent_at?: string }
      }
      automation_runs: {
        Row: { id: string; organisation_id: string | null; workflow_name: string; trigger: string | null; status: string; started_at: string; completed_at: string | null; input: any; output: any; error: string | null }
        Insert: { id?: string; organisation_id?: string; workflow_name: string; trigger?: string; status?: string; started_at?: string; completed_at?: string; input?: any; output?: any; error?: string }
        Update: { id?: string; organisation_id?: string; workflow_name?: string; trigger?: string; status?: string; started_at?: string; completed_at?: string; input?: any; output?: any; error?: string }
      }
      knowledge_collections: {
        Row: { id: string; organisation_id: string; title: string; description: string | null; created_by: string; created_at: string; updated_at: string }
        Insert: { id?: string; organisation_id: string; title: string; description?: string; created_by: string; created_at?: string; updated_at?: string }
        Update: { id?: string; organisation_id?: string; title?: string; description?: string; created_by?: string; created_at?: string; updated_at?: string }
      }
      knowledge_sources: {
        Row: { id: string; organisation_id: string; collection_id: string | null; title: string; description: string | null; source_type: string; storage_path: string | null; url: string | null; content: string | null; audience: string; allowed_roles: string[]; tags: string[]; effective_date: string | null; is_enabled: boolean; indexing_status: string; last_indexed_at: string | null; error_message: string | null; created_by: string; created_at: string; updated_at: string }
        Insert: { id?: string; organisation_id: string; collection_id?: string; title: string; description?: string; source_type: string; storage_path?: string; url?: string; content?: string; audience?: string; allowed_roles?: string[]; tags?: string[]; effective_date?: string; is_enabled?: boolean; indexing_status?: string; last_indexed_at?: string; error_message?: string; created_by: string; created_at?: string; updated_at?: string }
        Update: { id?: string; organisation_id?: string; collection_id?: string; title?: string; description?: string; source_type?: string; storage_path?: string; url?: string; content?: string; audience?: string; allowed_roles?: string[]; tags?: string[]; effective_date?: string; is_enabled?: boolean; indexing_status?: string; last_indexed_at?: string; error_message?: string; created_by?: string; created_at?: string; updated_at?: string }
      }
      knowledge_chunks: {
        Row: { id: string; organisation_id: string; source_id: string; collection_id: string | null; chunk_index: number; content: string; embedding: number[] | null; metadata: any; visibility: string; allowed_roles: string[]; created_at: string; updated_at: string }
        Insert: { id?: string; organisation_id: string; source_id: string; collection_id?: string; chunk_index: number; content: string; embedding?: number[]; metadata?: any; visibility?: string; allowed_roles?: string[]; created_at?: string; updated_at?: string }
        Update: { id?: string; organisation_id?: string; source_id?: string; collection_id?: string; chunk_index?: number; content?: string; embedding?: number[]; metadata?: any; visibility?: string; allowed_roles?: string[]; created_at?: string; updated_at?: string }
      }
      knowledge_ingestion_jobs: {
        Row: { id: string; organisation_id: string; source_id: string; status: string; started_at: string | null; completed_at: string | null; error_message: string | null; chunks_created: number; created_at: string }
        Insert: { id?: string; organisation_id: string; source_id: string; status?: string; started_at?: string; completed_at?: string; error_message?: string; chunks_created?: number; created_at?: string }
        Update: { id?: string; organisation_id?: string; source_id?: string; status?: string; started_at?: string; completed_at?: string; error_message?: string; chunks_created?: number; created_at?: string }
      }
      chatbot_conversations: {
        Row: { id: string; organisation_id: string; profile_id: string; title: string | null; created_at: string; updated_at: string }
        Insert: { id?: string; organisation_id: string; profile_id: string; title?: string; created_at?: string; updated_at?: string }
        Update: { id?: string; organisation_id?: string; profile_id?: string; title?: string; created_at?: string; updated_at?: string }
      }
      chatbot_messages: {
        Row: { id: string; conversation_id: string; profile_id: string; role: string; content: string; sources: any; created_at: string }
        Insert: { id?: string; conversation_id: string; profile_id: string; role: string; content: string; sources?: any; created_at?: string }
        Update: { id?: string; conversation_id?: string; profile_id?: string; role?: string; content?: string; sources?: any; created_at?: string }
      }
      chatbot_feedback: {
        Row: { id: string; message_id: string; profile_id: string; rating: string; comment: string | null; created_at: string }
        Insert: { id?: string; message_id: string; profile_id: string; rating: string; comment?: string; created_at?: string }
        Update: { id?: string; message_id?: string; profile_id?: string; rating?: string; comment?: string; created_at?: string }
      }
    }
    Views: {}
    Functions: {}
    Enums: {}
    CompositeTypes: {}
  }
}
