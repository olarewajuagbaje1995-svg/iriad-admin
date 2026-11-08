import { Role } from '@/config/brand'
import type { Profile } from '@/lib/supabase'

type RoleHierarchy = Record<Role, number>

const ROLE_RANK: RoleHierarchy = {
  staff: 1,
  director: 2,
  admin: 3,
}

export function roleRank(role: Role | null | undefined): number {
  return ROLE_RANK[role ?? 'staff'] ?? 0
}

export function canManage(role: Role | null, targetRole: Role | null): boolean {
  if (!role) return false
  // Admin and Director can manage Staff; neither can promote/demote to Admin/Director
  if (role === 'admin' || role === 'director') {
    return targetRole === 'staff' || targetRole === null
  }
  return false
}

export function isAdmin(role: Role | null | undefined): boolean {
  return role === 'admin'
}

export function isDirector(role: Role | null | undefined): boolean {
  return role === 'director'
}

export function isAdminOrDirector(role: Role | null | undefined): boolean {
  return role === 'admin' || role === 'director'
}

export function canManageKnowledgeBase(role: Role | null | undefined): boolean {
  return role === 'admin' || role === 'director'
}

export function canViewOrgWide(role: Role | null | undefined): boolean {
  return role === 'admin' || role === 'director'
}

export function getOrgId(profile: Profile | null | undefined): string | null {
  return profile?.organisation_id ?? null
}
