'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import { User, Key, Loader2, Eye, EyeOff, Check, X, Shield, Settings2, AppWindow } from 'lucide-react'
import { changePasswordAction, verifyCurrentPassword } from '@/app/actions/password'
import { toast } from 'sonner'
import type { Profile } from '@/types'
import { Badge } from '@/components/ui/badge'
import { getInitials } from '@/lib/utils'
import { formatDate } from '@/lib/utils'
import { useQuery } from '@tanstack/react-query'
import { getCurrentProfile } from '@/app/actions/team'
import AdminSettings from './admin-settings'

const ROLE_BADGE_MAP: Record<string, 'default' | 'success' | 'warning' | 'info' | 'muted'> = {
  admin: 'danger' as any,
  team_lead: 'default',
  team_member: 'info',
  sales_executive: 'success',
}

interface SettingsClientProps {
  currentProfile: Profile | null
  initialAdminData?: any
  allowedModules?: string[]
}

export default function SettingsClient({ currentProfile, initialAdminData, allowedModules = [] }: SettingsClientProps) {
  const [activeTab, setActiveTab] = useState<'profile' | 'roles' | 'services' | 'access'>('profile')

  const [passState, passAction, isPending] = useActionState(changePasswordAction, undefined)
  const formRef = useRef<HTMLFormElement>(null)

  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmNewPassword, setShowConfirmNewPassword] = useState(false)

  // Live password validation states
  const [currentPasswordVal, setCurrentPasswordVal] = useState('')
  const [isVerifying, setIsVerifying] = useState(false)
  const [isCurrentPasswordCorrect, setIsCurrentPasswordCorrect] = useState<boolean | null>(null)

  // New password validation states
  const [newPasswordVal, setNewPasswordVal] = useState('')
  const [confirmNewPasswordVal, setConfirmNewPasswordVal] = useState('')

  const { data: profileData, isLoading } = useQuery({
    queryKey: ['currentProfile'],
    queryFn: async () => {
      const data = await getCurrentProfile()
      return data as Profile
    }
  })

  const profile = profileData ?? currentProfile

  useEffect(() => {
    if (passState?.error) {
      toast.error(passState.error)
    }
    if (passState?.success) {
      toast.success('Password updated successfully')
      formRef.current?.reset()
      setShowCurrentPassword(false)
      setShowNewPassword(false)
      setShowConfirmNewPassword(false)
      setCurrentPasswordVal('')
      setNewPasswordVal('')
      setConfirmNewPasswordVal('')
      setIsCurrentPasswordCorrect(null)
    }
  }, [passState])

  // Live validation logic with debounce
  useEffect(() => {
    if (!currentPasswordVal) {
      setIsCurrentPasswordCorrect(null)
      setIsVerifying(false)
      return
    }

    setIsVerifying(true)
    const timer = setTimeout(async () => {
      const isValid = await verifyCurrentPassword(currentPasswordVal)
      setIsCurrentPasswordCorrect(isValid)
      setIsVerifying(false)
    }, 600) // 600ms debounce delay

    return () => clearTimeout(timer)
  }, [currentPasswordVal])

  const confirmPasswordMatches = confirmNewPasswordVal ? newPasswordVal === confirmNewPasswordVal : null

  const tabs = [
    ...(allowedModules.includes('settings-profile') ? [{ id: 'profile', label: 'My Profile', icon: User }] : []),
    ...(allowedModules.includes('settings-roles') ? [{ id: 'roles', label: 'Roles Management', icon: Shield }] : []),
    ...(allowedModules.includes('settings-services') ? [{ id: 'services', label: 'Services List', icon: Settings2 }] : []),
    ...(allowedModules.includes('settings-access') ? [{ id: 'access', label: 'Module Access', icon: AppWindow }] : []),
  ]

  return (
    <div className="w-full h-full pb-10">
      <div className="flex flex-col md:flex-row gap-8">
        {/* Sidebar Nav */}
        <div className="w-full md:w-64 shrink-0 space-y-1">
          {tabs.map(tab => (
            <button 
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)} 
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all ${activeTab === tab.id ? 'bg-primary text-white shadow-glow-sm' : 'text-text-secondary hover:text-text hover:bg-bg-secondary'}`}
            >
              <tab.icon size={16} />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Main Content Area */}
        <div className="flex-1 min-w-0">
          {activeTab === 'profile' && (
            <div className="space-y-6">
              {/* Profile Card */}
              <div className="bg-bg-secondary border border-border rounded-xl p-6 shadow-sm">
                <div className="flex items-center gap-2 mb-6">
                  <User size={16} className="text-text-muted" />
                  <h3 className="text-sm font-semibold text-text">Profile Information</h3>
                </div>
        {isLoading ? (
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6 animate-pulse">
            <div className="w-20 h-20 rounded-full bg-bg shrink-0 border border-border shadow-glow-sm"></div>
            <div className="space-y-3 flex-1 w-full">
              <div className="h-6 bg-bg rounded w-1/3"></div>
              <div className="h-4 bg-bg rounded w-1/4 mt-1"></div>
              <div className="h-5 bg-bg rounded w-1/2 mt-3"></div>
            </div>
          </div>
        ) : profile && (
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
            <div className="w-20 h-20 rounded-full bg-primary flex items-center justify-center text-xl font-bold text-white overflow-hidden shrink-0 border border-border shadow-glow-sm relative">
               {profile.avatar_url && (
                <img 
                  src={profile.avatar_url} 
                  alt={profile.full_name} 
                  className="w-full h-full object-cover absolute inset-0 z-10" 
                  referrerPolicy="no-referrer"
                  onError={(e) => { e.currentTarget.style.display = 'none' }}
                />
              )}
              <span className="relative z-0">{getInitials(profile.full_name)}</span>
            </div>
            <div className="space-y-2.5 flex-1 w-full">
              <div>
                <p className="text-lg font-bold text-text">{profile.full_name}</p>
                <p className="text-xs text-text-muted mt-0.5">{profile.email}</p>
              </div>
              <div className="flex flex-wrap items-center gap-4 text-xs pt-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-text-muted">Role:</span>
                  <Badge variant={ROLE_BADGE_MAP[profile.role] ?? 'muted'}>
                    {profile.role.replace('_', ' ')}
                  </Badge>
                </div>
                <div className="text-text-muted">
                  <span>Joined:</span> <span className="text-text-secondary font-medium ml-1">{formatDate(profile.createdAt)}</span>
                </div>
                <div className="text-text-muted truncate max-w-xs" title={profile.id}>
                  <span>ID:</span> <span className="text-text-secondary font-mono text-[10px] ml-1">{profile.id}</span>
                </div>
              </div>
            </div>
          </div>
        )}
              </div>

              {/* Change Password Card */}
              <div className="bg-bg-secondary border border-border rounded-xl p-6 shadow-sm">
                <div className="flex items-center gap-2 mb-5">
                  <Key size={16} className="text-text-muted" />
                  <h3 className="text-sm font-semibold text-text">Change Password</h3>
                </div>
                <form ref={formRef} action={passAction} className="space-y-5 max-w-md">
          <div className="space-y-1.5">
            <label htmlFor="currentPassword" className="text-xs font-medium text-text-secondary">
              Current Password
            </label>
            <div className="relative">
              <input
                id="currentPassword"
                name="currentPassword"
                type={showCurrentPassword ? "text" : "password"}
                required
                value={currentPasswordVal}
                onChange={(e) => setCurrentPasswordVal(e.target.value)}
                className="w-full pl-3.5 pr-16 py-2 bg-bg border border-border rounded-lg text-xs text-text placeholder:text-text-muted focus:outline-none focus:border-primary/50 transition-all"
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                {isVerifying && <Loader2 className="w-3.5 h-3.5 animate-spin text-text-muted" />}
                {!isVerifying && isCurrentPasswordCorrect === true && (
                  <Check className="w-3.5 h-3.5 text-success" />
                )}
                {!isVerifying && isCurrentPasswordCorrect === false && (
                  <X className="w-3.5 h-3.5 text-danger" />
                )}
                <button
                  type="button"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  className="text-text-muted hover:text-text transition-colors"
                >
                  {showCurrentPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>
            {!isVerifying && isCurrentPasswordCorrect === false && (
              <p className="text-[10px] text-danger mt-1">Incorrect current password</p>
            )}
            {!isVerifying && isCurrentPasswordCorrect === true && (
              <p className="text-[10px] text-success mt-1">Correct current password</p>
            )}
          </div>
          <div className="space-y-1.5">
            <label htmlFor="newPassword" className="text-xs font-medium text-text-secondary">
              New Password
            </label>
            <div className="relative">
              <input
                id="newPassword"
                name="newPassword"
                type={showNewPassword ? "text" : "password"}
                required
                value={newPasswordVal}
                onChange={(e) => setNewPasswordVal(e.target.value)}
                className="w-full pl-3.5 pr-10 py-2 bg-bg border border-border rounded-lg text-xs text-text placeholder:text-text-muted focus:outline-none focus:border-primary/50 transition-all"
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text transition-colors"
              >
                {showNewPassword ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="confirmNewPassword" className="text-xs font-medium text-text-secondary">
              Confirm New Password
            </label>
            <div className="relative">
              <input
                id="confirmNewPassword"
                name="confirmNewPassword"
                type={showConfirmNewPassword ? "text" : "password"}
                required
                value={confirmNewPasswordVal}
                onChange={(e) => setConfirmNewPasswordVal(e.target.value)}
                className="w-full pl-3.5 pr-16 py-2 bg-bg border border-border rounded-lg text-xs text-text placeholder:text-text-muted focus:outline-none focus:border-primary/50 transition-all"
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                {confirmPasswordMatches === true && (
                  <Check className="w-3.5 h-3.5 text-success" />
                )}
                {confirmPasswordMatches === false && (
                  <X className="w-3.5 h-3.5 text-danger" />
                )}
                <button
                  type="button"
                  onClick={() => setShowConfirmNewPassword(!showConfirmNewPassword)}
                  className="text-text-muted hover:text-text transition-colors"
                >
                  {showConfirmNewPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>
            {confirmPasswordMatches === false && (
              <p className="text-[10px] text-danger mt-1">Passwords do not match</p>
            )}
            {confirmPasswordMatches === true && (
              <p className="text-[10px] text-success mt-1">Passwords match</p>
            )}
          </div>
          <button
            type="submit"
            disabled={isPending || isCurrentPasswordCorrect === false || confirmPasswordMatches === false}
            className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary-hover disabled:opacity-60 disabled:cursor-not-allowed text-white rounded-lg text-xs font-semibold active:scale-95 transition-all shadow-glow-sm"
          >
            {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {isPending ? 'Updating...' : 'Update Password'}
          </button>
                </form>
              </div>
            </div>
          )}

          {/* Admin Settings Tabs */}
          {activeTab !== 'profile' && allowedModules.includes(`settings-${activeTab}`) && (
            <AdminSettings activeTab={activeTab as any} initialData={initialAdminData} />
          )}
        </div>
      </div>
    </div>
  )
}
