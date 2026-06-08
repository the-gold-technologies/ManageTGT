'use client'

import { useActionState, useEffect, useRef } from 'react'
import { User, Key, Loader2 } from 'lucide-react'
import { changePasswordAction } from '@/app/actions/password'
import { toast } from 'sonner'
import type { Profile } from '@/types'
import { Badge } from '@/components/ui/badge'
import { getInitials } from '@/lib/utils'
import { formatDate } from '@/lib/utils'

const ROLE_BADGE_MAP: Record<string, 'default' | 'success' | 'warning' | 'info' | 'muted'> = {
  admin: 'danger' as any,
  team_lead: 'default',
  team_member: 'info',
  sales_executive: 'success',
}

interface SettingsClientProps {
  currentProfile: Profile | null
}

export default function SettingsClient({ currentProfile }: SettingsClientProps) {
  const [passState, passAction, isPending] = useActionState(changePasswordAction, undefined)
  const formRef = useRef<HTMLFormElement>(null)

  useEffect(() => {
    if (passState?.error) {
      toast.error(passState.error)
    }
    if (passState?.success) {
      toast.success('Password updated successfully')
      formRef.current?.reset()
    }
  }, [passState])

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h2 className="text-xl font-bold text-text">Settings</h2>
        <p className="text-sm text-text-secondary mt-0.5">Manage your user profile and preferences</p>
      </div>

      {/* Profile */}
      <div className="bg-bg-secondary border border-border rounded-xl p-6">
        <div className="flex items-center gap-2 mb-6">
          <User size={16} className="text-text-muted" />
          <h3 className="text-sm font-semibold text-text">My Profile</h3>
        </div>
        {currentProfile && (
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
            <div className="w-20 h-20 rounded-full bg-primary flex items-center justify-center text-xl font-bold text-white overflow-hidden shrink-0 border border-border shadow-glow-sm">
              {currentProfile.avatar_url ? (
                <img src={currentProfile.avatar_url} alt={currentProfile.full_name} className="w-full h-full object-cover" />
              ) : (
                getInitials(currentProfile.full_name)
              )}
            </div>
            <div className="space-y-2.5 flex-1 w-full">
              <div>
                <p className="text-lg font-bold text-text">{currentProfile.full_name}</p>
                <p className="text-xs text-text-muted mt-0.5">{currentProfile.email}</p>
              </div>
              <div className="flex flex-wrap items-center gap-4 text-xs pt-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-text-muted">Role:</span>
                  <Badge variant={ROLE_BADGE_MAP[currentProfile.role] ?? 'muted'}>
                    {currentProfile.role.replace('_', ' ')}
                  </Badge>
                </div>
                <div className="text-text-muted">
                  <span>Joined:</span> <span className="text-text-secondary font-medium ml-1">{formatDate(currentProfile.createdAt)}</span>
                </div>
                <div className="text-text-muted truncate max-w-xs" title={currentProfile.id}>
                  <span>ID:</span> <span className="text-text-secondary font-mono text-[10px] ml-1">{currentProfile.id}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Change Password */}
      <div className="bg-bg-secondary border border-border rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Key size={15} className="text-text-muted" />
          <h3 className="text-sm font-semibold text-text">Change Password</h3>
        </div>
        <form ref={formRef} action={passAction} className="space-y-4 max-w-md">
          <div className="space-y-1.5">
            <label htmlFor="currentPassword" className="text-xs font-medium text-text-secondary">
              Current Password
            </label>
            <input
              id="currentPassword"
              name="currentPassword"
              type="password"
              required
              className="w-full px-3.5 py-2 bg-bg border border-border rounded-lg text-xs text-text placeholder:text-text-muted focus:outline-none focus:border-primary/50 transition-all"
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="newPassword" className="text-xs font-medium text-text-secondary">
              New Password
            </label>
            <input
              id="newPassword"
              name="newPassword"
              type="password"
              required
              className="w-full px-3.5 py-2 bg-bg border border-border rounded-lg text-xs text-text placeholder:text-text-muted focus:outline-none focus:border-primary/50 transition-all"
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="confirmNewPassword" className="text-xs font-medium text-text-secondary">
              Confirm New Password
            </label>
            <input
              id="confirmNewPassword"
              name="confirmNewPassword"
              type="password"
              required
              className="w-full px-3.5 py-2 bg-bg border border-border rounded-lg text-xs text-text placeholder:text-text-muted focus:outline-none focus:border-primary/50 transition-all"
            />
          </div>
          <button
            type="submit"
            disabled={isPending}
            className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary-hover disabled:opacity-60 disabled:cursor-not-allowed text-white rounded-lg text-xs font-semibold active:scale-95 transition-all shadow-glow-sm"
          >
            {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {isPending ? 'Updating...' : 'Update Password'}
          </button>
        </form>
      </div>

    </div>
  )
}
