import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/hooks/useToast'
import { findAccount } from '@/lib/demoAuth'
import { ROLE_LABELS, type Role } from '@/config/brand'
import { User, Lock, RefreshCw } from 'lucide-react'

const MIN_PASSWORD_LENGTH = 8

export default function AccountSettingsPage() {
  const { profile, signOut, demoMode } = useAuth()
  const { toast, success, error } = useToast()
  const role = (profile?.role as Role | null) ?? null
  const [isLoading, setIsLoading] = useState(true)
  const [fullName, setFullName] = useState(profile?.full_name ?? '')
  const [email, setEmail] = useState(profile?.email ?? '')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url ?? null)
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    setIsLoading(false)
  }, [profile])

  const updateProfile = async () => {
    if (!profile?.id) return
    try {
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ full_name: fullName, email })
        .eq('id', profile.id)
      if (updateError) throw updateError
      success('Profile updated successfully.')
    } catch (err: any) {
      error(err.message || 'Failed to update profile.')
    }
  }

  /** Optionally verify the current password before allowing a change. */
  const verifyCurrentPassword = async (): Promise<boolean> => {
    if (!currentPassword) return true
    const userEmail = profile?.email
    if (!userEmail) return false
    if (demoMode) {
      const account = findAccount(userEmail)
      return Boolean(account && account.password === currentPassword)
    }
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: userEmail,
      password: currentPassword,
    })
    return !signInError
  }

  const updatePassword = async () => {
    if (!newPassword || !confirmPassword) {
      error('Please enter and confirm your new password.')
      return
    }
    if (newPassword !== confirmPassword) {
      error('Passwords do not match.')
      return
    }
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      error(`New password must be at least ${MIN_PASSWORD_LENGTH} characters.`)
      return
    }
    if (!(await verifyCurrentPassword())) {
      error('Current password is incorrect.')
      return
    }
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword })
      if (updateError) throw updateError
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      success('Password updated successfully.')
    } catch (err: any) {
      error(err.message || 'Failed to update password.')
    }
  }

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      error('Please upload an image file.')
      return
    }
    setAvatarUrl(URL.createObjectURL(file))
    toast('Avatar selected. Click Save avatar to upload.', { type: 'info' })
  }

  const saveAvatar = async () => {
    if (!profile?.id || !avatarUrl) return
    setUploading(true)
    try {
      // Note: in a real app this would upload to Supabase Storage and store the path
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: avatarUrl })
        .eq('id', profile.id)
      if (updateError) throw updateError
      setUploading(false)
      success('Avatar updated successfully.')
    } catch (err: any) {
      setUploading(false)
      error(err.message || 'Failed to upload avatar.')
    }
  }

  if (isLoading) return <div className="p-6">Loading settings…</div>

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-neutral-900">Account Settings</h2>
        <p className="text-sm text-neutral-500">Manage your profile, password, email, and avatar.</p>
      </div>

      {/* Profile section */}
      <div className="card p-5">
        <h3 className="text-sm font-semibold text-neutral-900 uppercase tracking-wider mb-4">Profile</h3>
        <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-4">
          <div className="flex flex-col items-center gap-3">
            <div className="w-20 h-20 rounded-full border border-neutral-200 overflow-hidden bg-neutral-100 flex items-center justify-center">
              {avatarUrl ? (
                <img src={avatarUrl} alt="avatar" className="w-full h-full object-cover" />
              ) : (
                <User className="w-10 h-10 text-neutral-400" />
              )}
            </div>
            <input
              type="file"
              accept="image/*"
              onChange={handleAvatarChange}
              className="block w-full text-sm text-neutral-600 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-brand-50 file:text-brand-700 hover:file:bg-brand-100"
            />
            <button
              onClick={saveAvatar}
              disabled={uploading}
              className="text-xs px-3 py-1.5 rounded border border-neutral-300 text-neutral-600 hover:bg-neutral-100 disabled:opacity-50"
            >
              {uploading ? 'Uploading…' : 'Save avatar'}
            </button>
          </div>
          <div className="col-span-2 sm:col-span-3 lg:col-span-3">
            <div className="space-y-4">
              <div>
                <label className="label block mb-1">Full name</label>
                <input
                  className="input"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Full name"
                />
              </div>
              <div>
                <label className="label block mb-1">Email</label>
                <input
                  className="input"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="email@iriad.example"
                />
              </div>
              <div>
                <label className="label block mb-1">Role</label>
                <input
                  className="input bg-neutral-50 text-neutral-500"
                  readOnly
                  value={ROLE_LABELS[role ?? 'staff']}
                />
                <p className="text-[10px] text-neutral-500 mt-1">Role cannot be changed here. Contact an admin to change your role.</p>
              </div>
              <div>
                <label className="label block mb-1">Department</label>
                <input className="input bg-neutral-50 text-neutral-500" readOnly value={profile?.department_id ?? '—'} />
              </div>
              <button onClick={updateProfile} className="btn-primary text-sm">
                <RefreshCw className="w-4 h-4 mr-2" /> Save profile
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Password section */}
      <div className="card p-5">
        <h3 className="text-sm font-semibold text-neutral-900 uppercase tracking-wider mb-4">Password</h3>
        <div className="space-y-4">
          <div>
            <label className="label block mb-1">Current password</label>
            <input
              className="input"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="••••••••"
            />
            <p className="text-[10px] text-neutral-500 mt-1">
              Optional. Leave blank to skip current-password verification.
            </p>
          </div>
          <div>
            <label className="label block mb-1">New password</label>
            <input
              className="input"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>
          <div>
            <label className="label block mb-1">Confirm new password</label>
            <input
              className="input"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>
          <button onClick={updatePassword} className="btn-primary text-sm">
            <Lock className="w-4 h-4 mr-2" /> Change password
          </button>
          <p className="text-[10px] text-neutral-500">Changing your password will sign you out of all other sessions.</p>
        </div>
      </div>

      <div className="card p-5">
        <h3 className="text-sm font-semibold text-neutral-900 uppercase tracking-wider mb-4">Danger zone</h3>
        <p className="text-sm text-neutral-500 mb-4">Signing out will end your current session.</p>
        <button
          onClick={() => signOut()}
          className="text-red-600 hover:text-red-700 flex items-center gap-2 text-sm font-medium"
        >
          <User className="w-4 h-4" /> Sign out
        </button>
      </div>
    </div>
  )
}
