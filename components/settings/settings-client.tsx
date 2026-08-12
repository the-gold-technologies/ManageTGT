'use client'

import { useActionState, useEffect, useRef, useState, useCallback } from 'react'
import { User, Key, Loader2, Eye, EyeOff, Check, X, Shield, Settings2, AppWindow, Bell, Smartphone, Globe, Mail, Monitor, Trash2 } from 'lucide-react'
import { changePasswordAction, verifyCurrentPassword } from '@/app/actions/password'
import { toast } from 'sonner'
import type { Profile } from '@/types'
import { Badge } from '@/components/ui/badge'
import { getInitials } from '@/lib/utils'
import { formatDate } from '@/lib/utils'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getCurrentProfile } from '@/app/actions/team'
import AdminSettings from './admin-settings'
import {
  getNotificationPreferences,
  updateNotificationPreferences,
  getPushSubscriptions,
  removePushSubscription,
  sendTestNotification,
} from '@/app/actions/notifications'
import { requestAndRegisterPush } from '@/components/providers/push-notification-provider'

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
  const [activeTab, setActiveTab] = useState<'profile' | 'roles' | 'services' | 'access' | 'notifications'>('profile')

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
    { id: 'notifications', label: 'Notifications', icon: Bell },
  ]

  return (
    <div className="w-full h-[calc(100vh-112px)] flex flex-col">
      <div className="flex flex-col md:flex-row gap-8 flex-1 min-h-0">
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
        <div className="flex-1 min-w-0 h-full flex flex-col">
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
                {profile.orgName && (
                  <div className="text-text-muted">
                    <span>Organization:</span> <span className="text-primary font-medium ml-1">{profile.orgName}</span>
                  </div>
                )}
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
          {activeTab !== 'profile' && activeTab !== 'notifications' && allowedModules.includes(`settings-${activeTab}`) && (
            <AdminSettings activeTab={activeTab as any} initialData={initialAdminData} />
          )}

          {/* Notifications Tab */}
          {activeTab === 'notifications' && <NotificationsPanel />}
        </div>
      </div>
    </div>
  )
}

// ─── Event Types for per-event preferences ───────────────────────────────────

const EVENT_GROUPS = [
  {
    label: 'Tasks',
    events: [
      { key: 'task_assigned',  label: 'Task Assigned' },
      { key: 'task_status',    label: 'Task Status Updated' },
      { key: 'task_overdue',   label: 'Task Overdue (Scheduled)' },
      { key: 'task_due_soon',  label: 'Task Due Soon (Scheduled)' },
    ],
  },
  {
    label: 'Projects',
    events: [
      { key: 'project_assigned', label: 'Project Assigned' },
      { key: 'project_update',   label: 'Project Update' },
    ],
  },
  {
    label: 'Collaboration',
    events: [
      { key: 'mention',  label: 'Mention' },
      { key: 'comment',  label: 'Comment' },
    ],
  },
  {
    label: 'Finance',
    events: [
      { key: 'invoice_update',   label: 'Invoice Update' },
      { key: 'payment_received', label: 'Payment Received' },
      { key: 'approval_required',label: 'Approval Required' },
      { key: 'approval_granted', label: 'Approval Granted' },
    ],
  },
  {
    label: 'System',
    events: [
      { key: 'system_alert', label: 'System Alert' },
      { key: 'reminder',     label: 'Reminder' },
      { key: 'team_update',  label: 'Team Update' },
      { key: 'file_uploaded',label: 'File Uploaded' },
    ],
  },
]

const DEFAULT_RULES: Record<string, string[]> = {
  task_assigned:     ['in_app', 'push', 'email'],
  task_status:       ['in_app', 'push'],
  task_overdue:      ['in_app', 'push', 'email'],
  task_due_soon:     ['in_app', 'push'],
  project_assigned:  ['in_app', 'push', 'email'],
  project_update:    ['in_app'],
  mention:           ['in_app', 'push'],
  comment:           ['in_app', 'push'],
  invoice_update:    ['in_app', 'push', 'email'],
  payment_received:  ['in_app', 'push'],
  approval_required: ['in_app', 'push', 'email'],
  approval_granted:  ['in_app', 'push'],
  system_alert:      ['in_app', 'push', 'email'],
  reminder:          ['in_app', 'push'],
  team_update:       ['in_app'],
  file_uploaded:     ['in_app'],
}

// ─── Notifications Panel ──────────────────────────────────────────────────────

function NotificationsPanel() {
  const queryClient = useQueryClient()

  const { data: prefs, isLoading: prefsLoading } = useQuery({
    queryKey: ['notificationPreferences'],
    queryFn:  getNotificationPreferences,
  })

  const { data: devices = [], isLoading: devicesLoading } = useQuery({
    queryKey: ['pushSubscriptions'],
    queryFn:  getPushSubscriptions,
  })

  const [overrides, setOverrides] = useState<Record<string, string[]>>({})
  const [inApp, setInApp]   = useState(true)
  const [push, setPush]     = useState(true)
  const [email, setEmail]   = useState(true)
  const [quietEnabled, setQuietEnabled] = useState(false)
  const [quietStart, setQuietStart]     = useState(22)
  const [quietEnd, setQuietEnd]         = useState(8)
  const [requestingPush, setRequestingPush] = useState(false)

  // Sync state from DB
  useEffect(() => {
    if (!prefs) return
    setInApp(prefs.inAppEnabled)
    setPush(prefs.pushEnabled)
    setEmail(prefs.emailEnabled)
    setQuietEnabled(prefs.quietHoursEnabled)
    setQuietStart(prefs.quietHoursStart ?? 22)
    setQuietEnd(prefs.quietHoursEnd ?? 8)
    setOverrides((prefs.channelOverrides as Record<string, string[]>) ?? {})
  }, [prefs])

  const saveMutation = useMutation({
    mutationFn: (data: Parameters<typeof updateNotificationPreferences>[0]) =>
      updateNotificationPreferences(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notificationPreferences'] })
      toast.success('Preferences saved')
    },
    onError: () => toast.error('Failed to save preferences'),
  })

  const removeDeviceMutation = useMutation({
    mutationFn: (id: string) => removePushSubscription(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pushSubscriptions'] })
      toast.success('Device removed')
    },
  })

  const handleSave = () => {
    saveMutation.mutate({
      inAppEnabled: inApp,
      pushEnabled:  push,
      emailEnabled: email,
      channelOverrides: overrides,
      quietHoursEnabled: quietEnabled,
      quietHoursStart: quietEnabled ? quietStart : null,
      quietHoursEnd:   quietEnabled ? quietEnd   : null,
    })
  }

  const toggleOverride = (eventKey: string, channel: string) => {
    const current = overrides[eventKey] ?? DEFAULT_RULES[eventKey] ?? []
    const updated = current.includes(channel)
      ? current.filter(c => c !== channel)
      : [...current, channel]
    setOverrides(prev => ({ ...prev, [eventKey]: updated }))
  }

  const getChannels = (eventKey: string): string[] => {
    return overrides[eventKey] ?? DEFAULT_RULES[eventKey] ?? []
  }

  const handleEnablePush = async () => {
    setRequestingPush(true)
    const result = await requestAndRegisterPush()
    setRequestingPush(false)

    if (result.reason) {
      // Unsupported context — e.g. iOS Safari before Add to Home Screen.
      toast.error(result.reason, { duration: 8000 })
      return
    }
    if (result.permission === 'denied') {
      toast.error('Notifications blocked. Please allow them in your browser settings.')
      return
    }
    if (!result.success) {
      toast.error('Permission granted, but registering this device failed. Check the console.')
      return
    }
    toast.success('Push notifications enabled on this device!')
    queryClient.invalidateQueries({ queryKey: ['pushSubscriptions'] })
  }

  const pushPermission = typeof window !== 'undefined' && 'Notification' in window
    ? Notification.permission
    : 'default'

  const deviceIcon = (type: string) => {
    if (type.includes('android') || type.includes('ios') || type.includes('pwa'))
      return <Smartphone size={13} className="text-primary" />
    return <Monitor size={13} className="text-blue-400" />
  }

  if (prefsLoading) {
    return (
      <div className="space-y-4">
        {[1,2,3].map(i => <div key={i} className="h-20 rounded-xl bg-bg-secondary border border-border animate-pulse" />)}
      </div>
    )
  }

  return (
    <div className="space-y-5 pb-8">

      {/* Global Toggles */}
      <div className="bg-bg-secondary border border-border rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Bell size={14} className="text-text-muted" />
          <h3 className="text-sm font-semibold text-text">Delivery Channels</h3>
        </div>
        <div className="space-y-3">
          {[
            { key: 'inApp', label: 'In-App Notifications', desc: 'Bell icon + notification center', icon: <Globe size={14} />, val: inApp, set: setInApp },
            { key: 'push',  label: 'Browser / Desktop Push', desc: 'OS native notifications even when tab is closed', icon: <Monitor size={14} />, val: push, set: setPush },
            { key: 'email', label: 'Email Notifications', desc: 'Sent to your account email for important events', icon: <Mail size={14} />, val: email, set: setEmail },
          ].map(item => (
            <div key={item.key} className="flex items-center justify-between gap-4 py-2">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 text-text-muted">{item.icon}</div>
                <div>
                  <p className="text-xs font-semibold text-text">{item.label}</p>
                  <p className="text-[11px] text-text-muted mt-0.5">{item.desc}</p>
                </div>
              </div>
              <button
                onClick={() => item.set(!item.val)}
                className={`relative w-10 h-5 rounded-full transition-colors shrink-0 ${item.val ? 'bg-primary' : 'bg-bg-tertiary border border-border'}`}
              >
                <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${item.val ? 'left-5.5 left-[22px]' : 'left-0.5'}`} />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Enable Push CTA */}
      {pushPermission !== 'granted' && (
        <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold text-text">Enable Desktop Notifications</p>
            <p className="text-[11px] text-text-muted mt-0.5">Get push notifications in your browser, even when AgencyOS is not open.</p>
          </div>
          <button
            onClick={handleEnablePush}
            disabled={requestingPush || pushPermission === 'denied'}
            className="shrink-0 px-3 py-1.5 bg-primary hover:bg-primary-hover text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-50"
          >
            {requestingPush ? <Loader2 size={12} className="animate-spin" /> : 'Enable'}
          </button>
        </div>
      )}
      {pushPermission === 'denied' && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4">
          <p className="text-xs font-semibold text-red-400">Notifications blocked by browser</p>
          <p className="text-[11px] text-text-muted mt-1">Go to your browser settings → Site settings → Notifications → Allow for this site.</p>
        </div>
      )}

      {/* Test Notification Button */}
      <div className="flex justify-end pt-2">
        <button
          onClick={async () => {
            const toastId = toast.loading('Sending test notification...')
            const res = await sendTestNotification()
            if (!res.success) {
              toast.error(res.error || 'Failed to send', { id: toastId })
              return
            }
            if (!res.push?.configured) {
              toast.warning('Sent, but push is not configured on the server (VAPID keys missing)', { id: toastId })
            } else if (!res.push.activeDevices) {
              toast.warning('Sent, but no push-enabled devices registered — click Enable above', { id: toastId })
            } else {
              toast.success(`Test notification sent to ${res.push.activeDevices} device(s)!`, { id: toastId })
            }
          }}
          className="px-4 py-2 bg-bg-tertiary hover:bg-bg-tertiary/80 border border-border text-text-secondary hover:text-text text-xs font-semibold rounded-lg transition-colors flex items-center gap-2"
        >
          <Bell size={14} />
          Send Test Notification
        </button>
      </div>

      {/* Per-event Matrix */}
      <div className="bg-bg-secondary border border-border rounded-xl overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-border">
          <Settings2 size={14} className="text-text-muted" />
          <h3 className="text-sm font-semibold text-text">Per-Event Preferences</h3>
          <span className="text-[11px] text-text-muted ml-1">— override delivery channels for each event type</span>
        </div>

        {/* Header row */}
        <div className="grid grid-cols-[1fr_52px_52px_52px] px-5 py-2 border-b border-border bg-bg-tertiary/40">
          <span className="text-[10px] font-semibold text-text-muted uppercase tracking-wider">Event</span>
          <span className="text-[10px] font-semibold text-text-muted uppercase tracking-wider text-center">App</span>
          <span className="text-[10px] font-semibold text-text-muted uppercase tracking-wider text-center">Push</span>
          <span className="text-[10px] font-semibold text-text-muted uppercase tracking-wider text-center">Email</span>
        </div>

        <div className="divide-y divide-border">
          {EVENT_GROUPS.map(group => (
            <div key={group.label}>
              <div className="px-5 py-2 bg-bg-tertiary/20">
                <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider">{group.label}</span>
              </div>
              {group.events.map(ev => {
                const channels = getChannels(ev.key)
                return (
                  <div key={ev.key} className="grid grid-cols-[1fr_52px_52px_52px] px-5 py-2.5 hover:bg-bg-tertiary/20 transition-colors">
                    <span className="text-xs text-text-secondary self-center">{ev.label}</span>
                    {(['in_app', 'push', 'email'] as const).map(ch => (
                      <div key={ch} className="flex items-center justify-center">
                        <button
                          onClick={() => toggleOverride(ev.key, ch)}
                          className={`w-5 h-5 rounded flex items-center justify-center transition-all ${
                            channels.includes(ch)
                              ? 'bg-primary text-white'
                              : 'bg-bg-tertiary border border-border text-transparent hover:border-primary/50'
                          }`}
                        >
                          <Check size={10} />
                        </button>
                      </div>
                    ))}
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Quiet Hours */}
      <div className="bg-bg-secondary border border-border rounded-xl p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-sm font-semibold text-text">Quiet Hours</p>
            <p className="text-[11px] text-text-muted mt-0.5">No push or email notifications during this window</p>
          </div>
          <button
            onClick={() => setQuietEnabled(!quietEnabled)}
            className={`relative w-10 h-5 rounded-full transition-colors shrink-0 ${quietEnabled ? 'bg-primary' : 'bg-bg-tertiary border border-border'}`}
          >
            <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${quietEnabled ? 'left-[22px]' : 'left-0.5'}`} />
          </button>
        </div>
        {quietEnabled && (
          <div className="flex items-center gap-3 mt-3">
            <div className="flex-1">
              <label className="text-[10px] font-semibold text-text-muted uppercase tracking-wider">From</label>
              <select
                value={quietStart}
                onChange={e => setQuietStart(Number(e.target.value))}
                className="mt-1 w-full bg-bg border border-border rounded-lg px-3 py-2 text-xs text-text focus:outline-none focus:border-primary"
              >
                {Array.from({ length: 24 }, (_, i) => (
                  <option key={i} value={i}>{i.toString().padStart(2,'0')}:00</option>
                ))}
              </select>
            </div>
            <div className="flex-1">
              <label className="text-[10px] font-semibold text-text-muted uppercase tracking-wider">To</label>
              <select
                value={quietEnd}
                onChange={e => setQuietEnd(Number(e.target.value))}
                className="mt-1 w-full bg-bg border border-border rounded-lg px-3 py-2 text-xs text-text focus:outline-none focus:border-primary"
              >
                {Array.from({ length: 24 }, (_, i) => (
                  <option key={i} value={i}>{i.toString().padStart(2,'0')}:00</option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Registered Devices */}
      <div className="bg-bg-secondary border border-border rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Smartphone size={14} className="text-text-muted" />
          <h3 className="text-sm font-semibold text-text">Push-Enabled Devices</h3>
        </div>
        {devicesLoading ? (
          <div className="space-y-2">
            {[1,2].map(i => <div key={i} className="h-10 rounded-lg bg-bg-tertiary animate-pulse" />)}
          </div>
        ) : (devices as any[]).length === 0 ? (
          <p className="text-xs text-text-muted py-2">No devices registered for push notifications yet.</p>
        ) : (
          <div className="space-y-2">
            {(devices as any[]).map((device: any) => (
              <div key={device.id} className="flex items-center justify-between gap-3 p-3 rounded-lg bg-bg-tertiary/50 border border-border">
                <div className="flex items-center gap-2.5">
                  {deviceIcon(device.deviceType)}
                  <div>
                    <p className="text-xs font-medium text-text">{device.deviceName || 'Unknown Device'}</p>
                    <p className="text-[10px] text-text-muted">{device.browserName} · {device.deviceType}</p>
                  </div>
                </div>
                <button
                  onClick={() => removeDeviceMutation.mutate(device.id)}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-text-muted hover:text-red-400 hover:bg-red-400/10 transition-colors"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saveMutation.isPending}
          className="flex items-center gap-2 px-5 py-2 bg-primary hover:bg-primary-hover text-white text-xs font-semibold rounded-lg transition-all disabled:opacity-60 shadow-glow-sm"
        >
          {saveMutation.isPending ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
          {saveMutation.isPending ? 'Saving...' : 'Save Preferences'}
        </button>
      </div>
    </div>
  )
}
