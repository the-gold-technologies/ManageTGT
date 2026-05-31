'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Plus, Search, UserCog, User, Shield, Briefcase, Target, type LucideIcon } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import type { Profile, UserRole } from '@/types'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { formatDate } from '@/lib/utils'
import TeamModal from './team-modal'
import { updateMemberRole } from '@/app/actions/team'

interface TeamClientProps {
  initialProfiles: Profile[]
  userRole: string
}

const ROLE_BADGE_MAP: Record<UserRole, 'default' | 'info' | 'success' | 'warning' | 'muted'> = {
  admin: 'warning',
  team_lead: 'info',
  sales_executive: 'success',
  team_member: 'default',
}

const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Admin',
  team_lead: 'Team Lead',
  sales_executive: 'Sales Executive',
  team_member: 'Team Member',
}

const ROLE_ICONS: Record<UserRole, LucideIcon> = {
  admin: Shield,
  team_lead: Briefcase,
  sales_executive: Target,
  team_member: User,
}

export default function TeamClient({ initialProfiles, userRole }: TeamClientProps) {
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const qc = useQueryClient()
  const supabase = createClient()

  const { data: profiles } = useQuery({
    queryKey: ['team'],
    queryFn: async () => {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: true })
      return data as Profile[]
    },
    initialData: initialProfiles,
  })

  const updateRoleMutation = useMutation({
    mutationFn: async ({ id, newRole }: { id: string; newRole: UserRole }) => {
      const result = await updateMemberRole(id, newRole)
      if (result.error) throw new Error(result.error)
      return result
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['team'] })
      toast.success('Role updated successfully')
    },
    onError: (err) => toast.error(err.message || 'Failed to update role'),
  })

  const filtered = (profiles ?? []).filter(p => 
    p.full_name.toLowerCase().includes(search.toLowerCase()) ||
    ROLE_LABELS[p.role].toLowerCase().includes(search.toLowerCase())
  )

  const containerVariants = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.04 } } }
  const itemVariants = { hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0 } }
  
  const isAdmin = userRole === 'admin'

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-text">Team Members</h2>
          <p className="text-sm text-text-secondary mt-0.5">{profiles?.length ?? 0} total members</p>
        </div>
        <Button onClick={() => setModalOpen(true)}>
          <Plus size={15} /> Add Member
        </Button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search members..."
            className="w-full pl-9 pr-4 py-2 bg-bg-secondary border border-border rounded-lg text-sm text-text placeholder:text-text-muted focus:outline-none focus:border-primary/50 transition-all"
          />
        </div>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <UserCog size={36} className="text-text-muted mb-3" />
          <p className="text-text-secondary font-medium">No team members found</p>
        </div>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-bg-tertiary border-b border-border">
                  <th className="text-left px-6 py-3 text-xs font-semibold text-text-secondary uppercase tracking-wider">Member</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-text-secondary uppercase tracking-wider">Role</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-text-secondary uppercase tracking-wider">Joined Date</th>
                </tr>
              </thead>
              <motion.tbody variants={containerVariants} initial="hidden" animate="show">
                {filtered.map(profile => {
                  const RoleIcon = ROLE_ICONS[profile.role] || User
                  return (
                    <motion.tr
                      key={profile.id}
                      variants={itemVariants}
                      className="border-b border-border bg-bg-secondary hover:bg-bg-tertiary transition-colors"
                    >
                      <td className="px-6 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center">
                            {profile.full_name.charAt(0)}
                          </div>
                          <span className="font-medium text-text">{profile.full_name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-3">
                        {isAdmin ? (
                          <div className="flex items-center gap-2">
                            <RoleIcon size={14} className="text-text-muted" />
                            <select
                              value={profile.role}
                              onChange={(e) => updateRoleMutation.mutate({ id: profile.id, newRole: e.target.value as UserRole })}
                              className="bg-bg border border-border rounded-lg px-2 py-1 text-xs text-text focus:outline-none focus:border-primary/50 transition-all"
                            >
                              <option value="admin">Admin</option>
                              <option value="team_lead">Team Lead</option>
                              <option value="sales_executive">Sales Executive</option>
                              <option value="team_member">Team Member</option>
                            </select>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <RoleIcon size={14} className="text-text-muted" />
                            <Badge variant={ROLE_BADGE_MAP[profile.role]}>
                              {ROLE_LABELS[profile.role]}
                            </Badge>
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-3 text-text-secondary">
                        {formatDate(profile.created_at)}
                      </td>
                    </motion.tr>
                  )
                })}
              </motion.tbody>
            </table>
          </div>
        </div>
      )}

      <TeamModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        userRole={userRole}
      />
    </div>
  )
}
