'use client'

import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getRoles, createRole, updateRole, deleteRole } from '@/app/actions/roles'
import { getServices, createService, updateService, deleteService } from '@/app/actions/services'
import { getRoleModuleAccess, updateRoleModuleAccess } from '@/app/actions/access'
import { 
  Loader2, Plus, Edit2, Trash2,
  LayoutDashboard, Users, FolderKanban, CheckSquare, 
  Receipt, Wallet, TrendingUp, Target, BarChart3, 
  UserCog, Clock, Settings, User, Shield, Settings2, AppWindow,
  FolderOpen
} from 'lucide-react'
import { toast } from 'sonner'

const MODULE_GROUPS = [
  {
    group: '',
    items: [
      { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { key: 'clients', label: 'Clients', icon: Users },
      { key: 'projects', label: 'Projects', icon: FolderKanban },
      { key: 'tasks', label: 'Tasks', icon: CheckSquare },
      { key: 'files', label: 'Files', icon: FolderOpen },
    ]
  },
  {
    group: 'Finance',
    items: [
      { key: 'revenue', label: 'Revenue', icon: Receipt },
      { key: 'expenses', label: 'Expenses', icon: Wallet },
      { key: 'profitability', label: 'Profitability', icon: TrendingUp },
    ]
  },
  {
    group: 'Growth',
    items: [
      { key: 'prospects', label: 'Prospects', icon: Users },
      { key: 'targets', label: 'Sales Targets', icon: Target },
      { key: 'analytics', label: 'Analytics', icon: BarChart3 },
    ]
  },
  {
    group: 'System',
    items: [
      { key: 'team', label: 'Team', icon: UserCog },
      { key: 'activity', label: 'Activity Logs', icon: Clock },
      { key: 'settings', label: 'Settings', icon: Settings },
      { key: 'settings-profile', label: 'My Profile', icon: User, isSubItem: true },
      { key: 'settings-roles', label: 'Roles Management', icon: Shield, isSubItem: true },
      { key: 'settings-services', label: 'Services List', icon: Settings2, isSubItem: true },
      { key: 'settings-access', label: 'Module Access', icon: AppWindow, isSubItem: true },
    ]
  }
]

interface AdminSettingsProps {
  activeTab: 'roles' | 'services' | 'access'
  initialData?: { roles: any[], services: any[], access: any[] }
}

export default function AdminSettings({ activeTab, initialData }: AdminSettingsProps) {
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['adminSettingsData'],
    queryFn: async () => {
      const [r, s, a] = await Promise.all([getRoles(), getServices(), getRoleModuleAccess()])
      return { roles: r, services: s, access: a }
    },
    initialData: initialData
  })

  // Form states
  const [newRoleName, setNewRoleName] = useState('')
  const [newServiceName, setNewServiceName] = useState('')

  const roles = data?.roles || []
  const services = data?.services || []
  const access = data?.access || []

  const handleCreateRole = async () => {
    if (!newRoleName) return
    const res = await createRole({ name: newRoleName })
    if (res.error) toast.error(res.error)
    else { 
      toast.success('Role created')
      setNewRoleName('')
      queryClient.invalidateQueries({ queryKey: ['adminSettingsData'] })
    }
  }

  const handleDeleteRole = async (id: string) => {
    const res = await deleteRole(id)
    if (res.error) toast.error(res.error)
    else { 
      toast.success('Role deleted')
      queryClient.invalidateQueries({ queryKey: ['adminSettingsData'] })
    }
  }

  const handleCreateService = async () => {
    if (!newServiceName) return
    const res = await createService({ name: newServiceName })
    if (res.error) toast.error(res.error)
    else { 
      toast.success('Service created')
      setNewServiceName('')
      queryClient.invalidateQueries({ queryKey: ['adminSettingsData'] })
    }
  }

  const handleDeleteService = async (id: string) => {
    const res = await deleteService(id)
    if (res.error) toast.error(res.error)
    else { 
      toast.success('Service deleted')
      queryClient.invalidateQueries({ queryKey: ['adminSettingsData'] })
    }
  }

  const toggleAccessMutation = useMutation({
    mutationFn: async ({ roleId, moduleKey, currentStatus }: { roleId: string, moduleKey: string, currentStatus: boolean }) => {
      const res = await updateRoleModuleAccess(roleId, moduleKey, !currentStatus)
      if (res.error) throw new Error(res.error)
      return res
    },
    onMutate: async ({ roleId, moduleKey, currentStatus }) => {
      await queryClient.cancelQueries({ queryKey: ['adminSettingsData'] })
      const previousData = queryClient.getQueryData(['adminSettingsData'])
      
      queryClient.setQueryData(['adminSettingsData'], (old: any) => {
        if (!old) return old
        const newAccess = [...old.access]
        const existingIndex = newAccess.findIndex(a => a.roleId === roleId && a.moduleKey === moduleKey)
        if (existingIndex >= 0) {
          newAccess[existingIndex] = { ...newAccess[existingIndex], hasAccess: !currentStatus }
        } else {
          newAccess.push({ roleId, moduleKey, hasAccess: !currentStatus })
        }
        return { ...old, access: newAccess }
      })
      
      return { previousData }
    },
    onError: (err, newTodo, context) => {
      toast.error(err.message)
      if (context?.previousData) {
        queryClient.setQueryData(['adminSettingsData'], context.previousData)
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['adminSettingsData'] })
    }
  })

  const toggleAccess = (roleId: string, moduleKey: string, currentStatus: boolean) => {
    toggleAccessMutation.mutate({ roleId, moduleKey, currentStatus })
  }

  if (isLoading) return <div className="p-10 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" /></div>

  return (
    <div className="bg-bg-secondary border border-border rounded-xl mt-0 overflow-hidden shadow-sm">
      <div className="p-6">
        {activeTab === 'roles' && (
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-text">Manage Roles</h3>
            <div className="flex gap-2 mb-4">
              <input value={newRoleName} onChange={(e) => setNewRoleName(e.target.value)} placeholder="New role name (e.g. hr_manager)" className="flex-1 px-3 py-2 bg-bg border border-border rounded-lg text-xs" />
              <button onClick={handleCreateRole} className="px-4 py-2 bg-primary text-white rounded-lg text-xs font-semibold flex items-center gap-1"><Plus size={14} /> Add</button>
            </div>
            <div className="space-y-2">
              {roles.map(r => (
                <div key={r.id} className="flex items-center justify-between p-3 border border-border rounded-lg bg-bg">
                  <span className="text-sm text-text font-medium">{r.name} {r.isSystem && <span className="text-[10px] text-text-muted ml-2">(System)</span>}</span>
                  {!r.isSystem && (
                    <button onClick={() => handleDeleteRole(r.id)} className="text-danger p-1 hover:bg-danger/10 rounded"><Trash2 size={14}/></button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'services' && (
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-text">Manage Services</h3>
            <div className="flex gap-2 mb-4">
              <input value={newServiceName} onChange={(e) => setNewServiceName(e.target.value)} placeholder="New service name (e.g. SEO)" className="flex-1 px-3 py-2 bg-bg border border-border rounded-lg text-xs" />
              <button onClick={handleCreateService} className="px-4 py-2 bg-primary text-white rounded-lg text-xs font-semibold flex items-center gap-1"><Plus size={14} /> Add</button>
            </div>
            <div className="space-y-2">
              {services.map(s => (
                <div key={s.id} className="flex items-center justify-between p-3 border border-border rounded-lg bg-bg">
                  <span className="text-sm text-text font-medium">{s.name}</span>
                  <button onClick={() => handleDeleteService(s.id)} className="text-danger p-1 hover:bg-danger/10 rounded"><Trash2 size={14}/></button>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'access' && (
          <div className="space-y-4 overflow-x-auto">
            <h3 className="text-sm font-semibold text-text mb-4">Module Access Matrix</h3>
            <div className="overflow-x-auto rounded-xl border dark:border-white/10 border-black/10 bg-bg/20">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr>
                    <th className="p-4 border-b dark:border-white/5 border-black/5 text-text-secondary font-medium tracking-wide">Module</th>
                    {roles.map(r => (
                      <th key={r.id} className="p-4 border-b dark:border-white/5 border-black/5 text-text-secondary font-medium text-center tracking-wide">{r.name}</th>
                    ))}
                  </tr>
                </thead>
              <tbody>
                {MODULE_GROUPS.map((group, index) => (
                  <React.Fragment key={group.group || index}>
                    {group.group && (
                      <tr>
                        <td colSpan={roles.length + 1} className="pt-6 pb-2 px-4 text-xs font-bold text-text-secondary uppercase tracking-wider">
                          {group.group}
                        </td>
                      </tr>
                    )}
                    {group.items.map((m, mIdx) => (
                      <tr key={m.key} className="border-b dark:border-white/5 border-black/5 last:border-0 hover:bg-bg/40 transition-colors">
                        <td className={`p-4 text-text font-medium ${group.group ? 'pl-6' : ''} ${(m as any).isSubItem ? 'pl-12 text-text-secondary font-normal' : ''}`}>
                          <div className="flex items-center gap-2.5">
                            {m.icon && <m.icon className={`text-text-muted ${(m as any).isSubItem ? 'w-3.5 h-3.5 opacity-80' : 'w-4 h-4'}`} />}
                            <span>{m.label}</span>
                          </div>
                        </td>
                        {roles.map(r => {
                          const isDefaultModule = ['dashboard', 'settings', 'settings-profile', 'files'].includes(m.key);
                          const hasAccess = r.name === 'admin' || isDefaultModule || access.find(a => a.roleId === r.id && a.moduleKey === m.key)?.hasAccess || false;
                          return (
                            <td key={r.id} className="p-3 text-center">
                              <input 
                                type="checkbox" 
                                checked={hasAccess} 
                                onChange={() => toggleAccess(r.id, m.key, hasAccess)}
                                disabled={r.name === 'admin' || isDefaultModule} // Admin always has access; default modules are checked and read-only
                                className="accent-primary w-4 h-4 cursor-pointer disabled:cursor-not-allowed"
                              />
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
