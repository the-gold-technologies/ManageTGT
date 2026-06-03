'use client'

import { useState } from 'react'
import { Users, User, Shield } from 'lucide-react'
import { updateMemberRole } from '@/app/actions/team'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { Profile } from '@/types'
import { Button } from '@/components/ui/button'
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
  profiles: Profile[]
  currentProfile: Profile | null
}

export default function SettingsClient({ profiles, currentProfile }: SettingsClientProps) {
  const [updatingRole, setUpdatingRole] = useState<string | null>(null)

  const updateRole = async (userId: string, role: string) => {
    setUpdatingRole(userId)
    const result = await updateMemberRole(userId, role as any)
    if (!result.success) {
      toast.error(result.error || 'Failed to update role')
    } else {
      toast.success('Role updated')
    }
    setUpdatingRole(null)
  }

  const isAdmin = currentProfile?.role === 'admin'

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h2 className="text-xl font-bold text-text">Settings</h2>
        <p className="text-sm text-text-secondary mt-0.5">Manage your team and system preferences</p>
      </div>

      {/* Profile */}
      <div className="bg-bg-secondary border border-border rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <User size={15} className="text-text-muted" />
          <h3 className="text-sm font-semibold text-text">My Profile</h3>
        </div>
        {currentProfile && (
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center text-sm font-bold text-white">
              {getInitials(currentProfile.full_name)}
            </div>
            <div>
              <p className="font-semibold text-text">{currentProfile.full_name}</p>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant={ROLE_BADGE_MAP[currentProfile.role] ?? 'muted'}>
                  {currentProfile.role.replace('_', ' ')}
                </Badge>
                <span className="text-xs text-text-muted">Member since {formatDate(currentProfile.createdAt)}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Team Management (Admin only) */}
      {isAdmin && (
        <div className="bg-bg-secondary border border-border rounded-xl overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-4 border-b border-border">
            <Users size={15} className="text-text-muted" />
            <h3 className="text-sm font-semibold text-text">Team Members</h3>
          </div>
          <div className="divide-y divide-border">
            {profiles.map(profile => (
              <div key={profile.id} className="flex items-center justify-between px-5 py-3 hover:bg-bg-tertiary transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-bg-tertiary border border-border flex items-center justify-center text-xs font-bold text-text-secondary">
                    {getInitials(profile.full_name)}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-text">{profile.full_name}</p>
                    <p className="text-xs text-text-muted">Joined {formatDate(profile.createdAt)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {profile.id === currentProfile?.id ? (
                    <Badge variant={ROLE_BADGE_MAP[profile.role] ?? 'muted'}>{profile.role.replace('_', ' ')}</Badge>
                  ) : (
                    <select
                      value={profile.role}
                      onChange={e => updateRole(profile.id, e.target.value)}
                      disabled={updatingRole === profile.id}
                      className="px-2 py-1 bg-bg border border-border rounded-lg text-xs text-text focus:outline-none focus:border-primary/50 transition-all"
                    >
                      <option value="admin">Admin</option>
                      <option value="team_lead">Team Lead</option>
                      <option value="team_member">Team Member</option>
                      <option value="sales_executive">Sales Executive</option>
                    </select>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  )
}

