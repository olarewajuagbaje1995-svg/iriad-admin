import { z } from 'zod'

// ============================================================
// Shared Zod validation schemas for IRIAD forms
// These are used with react-hook-form + @hookform/resolvers
// ============================================================

export const loginSchema = z.object({
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
})

export type LoginFormData = z.infer<typeof loginSchema>

export const reportSchema = z.object({
  activities: z.string().min(1, 'Describe activities carried out'),
  tasks: z.string().min(1, 'List tasks completed'),
  meetings: z.string().optional(),
  achievements: z.string().optional(),
  challenges: z.string().optional(),
  outstanding: z.string().optional(),
  nextPlan: z.string().min(1, 'Describe next week/month plan'),
})

export type ReportFormData = z.infer<typeof reportSchema>

export const knowledgeSourceSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  sourceType: z.enum(['text', 'url', 'faq', 'file']),
  contentText: z.string().optional(),
  srcUrl: z.string().url('Enter a valid URL').optional(),
  faqQuestion: z.string().optional(),
  faqAnswer: z.string().optional(),
  audience: z.enum(['all_staff', 'selected_roles', 'admin_only']),
})

export type KnowledgeSourceFormData = z.infer<typeof knowledgeSourceSchema>

export const announcementSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  body: z.string().min(1, 'Announcement body is required'),
  category: z.enum(['general', 'operations', 'hr', 'it', 'finance']).default('general'),
})

export type AnnouncementFormData = z.infer<typeof announcementSchema>

export const leaveRequestSchema = z.object({
  leaveType: z.string().min(1, 'Select a leave type'),
  startDate: z.string().min(1, 'Start date is required'),
  endDate: z.string().min(1, 'End date is required'),
  reason: z.string().min(1, 'Reason is required'),
})

export type LeaveRequestFormData = z.infer<typeof leaveRequestSchema>

export const attendanceCorrectionSchema = z.object({
  correctionType: z.string().min(1, 'Select a correction type'),
  oldValue: z.string().optional(),
  newValue: z.string().min(1, 'New value is required'),
  reason: z.string().min(1, 'Reason is required'),
})

export type AttendanceCorrectionFormData = z.infer<typeof attendanceCorrectionSchema>
