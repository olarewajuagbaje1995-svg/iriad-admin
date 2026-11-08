import { describe, expect, it } from 'vitest'
import { canManage, isAdmin, isDirector, isAdminOrDirector, roleRank } from '@/lib/permissions'

describe('permissions — role helpers', () => {
  it('roleRank orders roles from staff to admin', () => {
    expect(roleRank('staff')).toBe(1)
    expect(roleRank('director')).toBe(2)
    expect(roleRank('admin')).toBe(3)
    // null / undefined fall back to 'staff' (rank 1) per role ?? 'staff'
    expect(roleRank(null)).toBe(1)
    expect(roleRank(undefined)).toBe(1)
  })

  it('isAdmin is true only for admin', () => {
    expect(isAdmin('admin')).toBe(true)
    expect(isAdmin('director')).toBe(false)
    expect(isAdmin('staff')).toBe(false)
    expect(isAdmin(null)).toBe(false)
    expect(isAdmin(undefined)).toBe(false)
  })

  it('isDirector is true only for director', () => {
    expect(isDirector('director')).toBe(true)
    expect(isDirector('admin')).toBe(false)
    expect(isDirector('staff')).toBe(false)
    expect(isDirector(null)).toBe(false)
  })

  it('isAdminOrDirector is true for admin and director', () => {
    expect(isAdminOrDirector('admin')).toBe(true)
    expect(isAdminOrDirector('director')).toBe(true)
    expect(isAdminOrDirector('staff')).toBe(false)
    expect(isAdminOrDirector(null)).toBe(false)
  })

  it('canManage: admin and director manage staff only', () => {
    expect(canManage('admin', 'staff')).toBe(true)
    expect(canManage('director', 'staff')).toBe(true)
    expect(canManage('admin', 'director')).toBe(false)
    expect(canManage('director', 'admin')).toBe(false)
    expect(canManage('admin', 'admin')).toBe(false)
    expect(canManage('director', 'director')).toBe(false)
  })

  it('canManage: staff manages nobody', () => {
    expect(canManage('staff', 'staff')).toBe(false)
  })

  it('canManage: null role manages nobody', () => {
    expect(canManage(null, 'staff')).toBe(false)
  })
})
