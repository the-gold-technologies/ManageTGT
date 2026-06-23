'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Plus, Search, UserCog, User, Shield, Briefcase, Target, Trash2, Edit2, type LucideIcon } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import type { Profile } from '@/types'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { formatDate } from '@/lib/utils'
import TeamModal from './team-modal'
import { ConfirmModal } from '@/components/ui/confirm-modal'
import { updateMemberRole, getTeamMembers, removeTeamMember } from '@/app/actions/team'
import { TablePagination } from '@/components/ui/table-pagination'

interface TeamClientProps {
  initialProfiles: Profile[]
  userRole: string
}

const ROLE_BADGE_MAP: Record<string, 'default' | 'info' | 'success' | 'warning' | 'muted'> = {
  admin: 'warning',
  team_lead: 'info',
  sales_executive: 'success',
  team_member: 'default',
}

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  team_lead: 'Team Lead',
  sales_executive: 'Sales Executive',
  team_member: 'Team Member',
}

const ROLE_ICONS: Record<string, LucideIcon> = {
  admin: Shield,
  team_lead: Briefcase,
  sales_executive: Target,
  team_member: User,
}

export default function TeamClient({ initialProfiles, userRole }: TeamClientProps) {
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [selectedMember, setSelectedMember] = useState<Profile | null>(null)
  const [memberToDelete, setMemberToDelete] = useState<Profile | null>(null)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const qc = useQueryClient()
  const supabase = createClient()

  const { data: profilesData, isLoading } = useQuery({
    queryKey: ['team'],
    queryFn: async () => {
      const data = await getTeamMembers()
      return data as Profile[]
    }
  })

  const profiles = profilesData ?? initialProfiles

  const updateRoleMutation = useMutation({
    mutationFn: async ({ id, newRole }: { id: string; newRole: string }) => {
      const result = await updateMemberRole(id, newRole)
      if (result.error) throw new Error(result.error)
      return result
    },
    onMutate: async ({ id, newRole }) => {
      await qc.cancelQueries({ queryKey: ['team'] })
      const previous = qc.getQueryData<Profile[]>(['team'])
      qc.setQueryData<Profile[]>(['team'], old =>
        (old ?? []).map(p => p.id === id ? { ...p, role: newRole } : p)
      )
      return { previous }
    },
    onSuccess: () => toast.success('Role updated successfully'),
    onError: (err: any, _, context) => {
      if (context?.previous) qc.setQueryData(['team'], context.previous)
      toast.error(err.message || 'Failed to update role')
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['team'] }),
  })

  const removeMemberMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await removeTeamMember(id)
      if (res.error) throw new Error(res.error)
      return res
    },
    onMutate: async (deletedId: string) => {
      await qc.cancelQueries({ queryKey: ['team'] })
      const previous = qc.getQueryData<Profile[]>(['team'])
      qc.setQueryData<Profile[]>(['team'], old => (old ?? []).filter(p => p.id !== deletedId))
      return { previous }
    },
    onSuccess: () => {
      toast.success('Member removed successfully')
      setMemberToDelete(null)
    },
    onError: (error: any, _, context) => {
      if (context?.previous) qc.setQueryData(['team'], context.previous)
      toast.error(error.message || 'Failed to remove member')
      setMemberToDelete(null)
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['team'] }),
  })

  const filtered = (profiles ?? []).filter(p => 
    p.full_name.toLowerCase().includes(search.toLowerCase()) ||
    (ROLE_LABELS[p.role] || p.role).toLowerCase().includes(search.toLowerCase())
  )

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const safePage = Math.min(page, totalPages)
  const paginated = filtered.slice((safePage - 1) * pageSize, safePage * pageSize)

  const containerVariants = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.04 } } }
  const itemVariants = { hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0 } }
  
  const isAdmin = userRole === 'admin'
  const isLead = userRole === 'team_lead'
  const canManage = isAdmin || isLead

  return (
    <div className="flex flex-col h-full gap-4">
      {/* Header */}
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h2 className="text-xl font-bold text-text">Team Members</h2>
          <p className="text-sm text-text-secondary mt-0.5">{profiles?.length ?? 0} total members</p>
        </div>
        <Button onClick={() => {
          setSelectedMember(null)
          setModalOpen(true)
        }}>
          <Plus size={16} className="mr-2" />
          Add Member
        </Button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 shrink-0">
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
            placeholder="Search members..."
            className="w-full pl-9 pr-4 py-2 bg-bg-secondary border border-border rounded-lg text-sm text-text placeholder:text-text-muted focus:outline-none focus:border-primary/50 transition-all"
          />
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex flex-col flex-1 min-h-[400px] bg-bg-secondary border border-border rounded-xl shadow-sm overflow-hidden animate-pulse">
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center flex-1 bg-bg-secondary rounded-xl border border-border">
          <UserCog size={36} className="text-text-muted mb-3" />
          <p className="text-text-secondary font-medium">No team members found</p>
        </div>
      ) : (
        <div className="flex flex-col flex-1 min-h-0 rounded-xl border border-border overflow-hidden">
          <div className="overflow-x-auto overflow-y-auto flex-1">
            <table className="min-w-max w-full text-sm">
              <thead>
                <tr className="bg-bg-tertiary border-b border-border">
                  <th className="text-left px-6 py-3 text-xs font-semibold text-text-secondary uppercase tracking-wider whitespace-nowrap">Member</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-text-secondary uppercase tracking-wider whitespace-nowrap">Role</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-text-secondary uppercase tracking-wider whitespace-nowrap">Joined Date</th>
                  {canManage && <th className="text-right px-6 py-3 text-xs font-semibold text-text-secondary uppercase tracking-wider whitespace-nowrap">Actions</th>}
                </tr>
              </thead>
              <motion.tbody variants={containerVariants} initial="hidden" animate="show">
                {paginated.map(profile => {
                  const RoleIcon = ROLE_ICONS[profile.role] || User
                  return (
                    <motion.tr
                      key={profile.id}
                      variants={itemVariants}
                      className="border-b border-border bg-bg-secondary hover:bg-bg-tertiary transition-colors"
                    >
                      <td className="px-6 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center overflow-hidden shrink-0 border border-border">
                            {profile.avatar_url ? (
                              <img src={profile.avatar_url} alt={profile.full_name} className="w-full h-full object-cover" />
                            ) : (
                              profile.full_name.charAt(0)
                            )}
                          </div>
                          <div>
                            <span className="font-medium text-text block">{profile.full_name}</span>
                            <span className="text-xs text-text-muted block mt-0.5">{profile.email}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-3">
                        {isAdmin ? (
                          <div className="flex items-center gap-2">
                            <RoleIcon size={14} className="text-text-muted" />
                            <select
                              value={profile.role}
                              onChange={(e) => updateRoleMutation.mutate({ id: profile.id, newRole: e.target.value })}
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
                            <Badge variant={ROLE_BADGE_MAP[profile.role] || 'default'}>
                              {ROLE_LABELS[profile.role] || profile.role}
                            </Badge>
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-3 text-text-secondary">
                        {formatDate(profile.createdAt)}
                      </td>
                      {canManage && (
                        <td className="px-6 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => {
                                setSelectedMember(profile)
                                setModalOpen(true)
                              }}
                              className="w-8 h-8 rounded-lg flex items-center justify-center text-text-muted hover:text-text hover:bg-bg-tertiary transition-all"
                              title="Edit Member"
                            >
                              <Edit2 size={14} />
                            </button>
                            {isAdmin && (
                              <button
                                onClick={() => setMemberToDelete(profile)}
                                className="w-8 h-8 rounded-lg flex items-center justify-center text-danger/70 hover:text-danger hover:bg-danger/10 transition-all"
                                title="Remove Member"
                              >
                                <Trash2 size={14} />
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </motion.tr>
                  )
                })}
              </motion.tbody>
            </table>
          </div>
          <TablePagination
            page={safePage}
            pageSize={pageSize}
            total={filtered.length}
            onPageChange={setPage}
            onPageSizeChange={s => { setPageSize(s); setPage(1) }}
            itemLabel="members"
          />
        </div>
      )}

      <TeamModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false)
          setTimeout(() => setSelectedMember(null), 200)
        }}
        userRole={userRole}
        member={selectedMember}
      />

      <ConfirmModal
        open={!!memberToDelete}
        onClose={() => setMemberToDelete(null)}
        onConfirm={() => memberToDelete && removeMemberMutation.mutate(memberToDelete.id)}
        title="Remove Team Member"
        description={`Are you sure you want to completely remove ${memberToDelete?.full_name} from the team? This action will revoke their access and cannot be undone.`}
        confirmText="Remove Member"
        isDestructive={true}
        loading={removeMemberMutation.isPending}
      />
    </div>
  )
}

