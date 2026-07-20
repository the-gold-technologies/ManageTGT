'use client'

import { useState, Fragment, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Search, FolderKanban, IndianRupee, X } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { parseISO, startOfDay, isSameDay, isSameWeek, isSameMonth, isSameQuarter, isSameYear } from 'date-fns'
import type { Project, Client, Profile, ProjectInvoice } from '@/types'
import { getProjects, deleteProject as deleteProjectAction } from '@/app/actions/projects'
import { generateNextInvoice } from '@/app/actions/finance'
import { getClients } from '@/app/actions/clients'
import { getTeamMembers } from '@/app/actions/team'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { formatDate, formatCurrency, PROJECT_STATUS_CONFIG, isOverdue } from '@/lib/utils'
import ProjectModal from './project-modal'
import { Glow } from '@/components/ui/glow'
import { cn } from '@/lib/utils'
import ExportDropdown from '@/components/ui/export-dropdown'
import DateFilterDropdown, { DateFilterValue } from '@/components/ui/date-filter-dropdown'
import { ConfirmModal } from '@/components/ui/confirm-modal'
import { TablePagination } from '@/components/ui/table-pagination'

interface ProjectsClientProps {
  initialProjects: Project[]
  clients: Pick<Client, 'id' | 'name' | 'company_name'>[]
  profiles: Pick<Profile, 'id' | 'full_name' | 'role'>[]
  userRole?: string
}

const STATUS_BADGE_MAP: Record<string, 'default' | 'info' | 'muted' | 'success' | 'warning'> = {
  pending: 'warning',
  in_progress: 'info',
  on_hold: 'muted',
  delivered: 'default',
  completed: 'success',
}

export default function ProjectsClient({ initialProjects, clients, profiles, userRole }: ProjectsClientProps) {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [dateFilter, setDateFilter] = useState<DateFilterValue>('all')
  const [customDateStart, setCustomDateStart] = useState<Date | null>(null)
  const [customDateEnd, setCustomDateEnd] = useState<Date | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingProject, setEditingProject] = useState<Project | null>(null)
  const [viewProject, setViewProject] = useState<Project | null>(null)
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null)
  const [paymentProject, setPaymentProject] = useState<Project | null>(null)
  const [isGeneratingInvoice, setIsGeneratingInvoice] = useState(false)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const qc = useQueryClient()

  const { data: projectsData, isLoading: isProjectsLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const data = await getProjects()
      return data as unknown as Project[]
    }
  })

  const { data: clientsData, isLoading: isClientsLoading } = useQuery({
    queryKey: ['clients'],
    queryFn: async () => {
      const data = await getClients()
      return data as unknown as Pick<Client, 'id' | 'name' | 'company_name'>[]
    }
  })

  const { data: profilesData, isLoading: isProfilesLoading } = useQuery({
    queryKey: ['profiles'],
    queryFn: async () => {
      const data = await getTeamMembers()
      return data as unknown as Pick<Profile, 'id' | 'full_name' | 'role'>[]
    }
  })

  // Use state data or fallback
  const projects = projectsData ?? initialProjects
  const activeClients = clientsData ?? clients
  const activeProfiles = profilesData ?? profiles
  const isLoading = isProjectsLoading || isClientsLoading || isProfilesLoading

  useEffect(() => {
    if (paymentProject && projects) {
      const updatedProject = projects.find(p => p.id === paymentProject.id)
      if (updatedProject && JSON.stringify(updatedProject) !== JSON.stringify(paymentProject)) {
        setPaymentProject(updatedProject)
      }
    }
  }, [projects, paymentProject])

  const deleteProject = useMutation({
    mutationFn: async (id: string) => {
      const result = await deleteProjectAction(id)
      if (!result.success) throw new Error(result.error)
    },
    onMutate: async (deletedId: string) => {
      // Cancel any outgoing refetches so they don't overwrite our optimistic update
      await qc.cancelQueries({ queryKey: ['projects'] })
      // Snapshot the previous value for rollback
      const previous = qc.getQueryData<Project[]>(['projects'])
      // Optimistically remove from cache immediately
      qc.setQueryData<Project[]>(['projects'], old => (old ?? []).filter(p => p.id !== deletedId))
      return { previous }
    },
    onSuccess: () => {
      toast.success('Project deleted')
      setProjectToDelete(null)
    },
    onError: (err, _, context) => {
      // Rollback to previous state if mutation fails
      if (context?.previous) qc.setQueryData(['projects'], context.previous)
      toast.error('Failed to delete project')
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['projects'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
      qc.invalidateQueries({ queryKey: ['profitability'] })
    },
  })

  const STATUSES = ['all', 'pending', 'in_progress', 'on_hold', 'delivered', 'completed']

  const filtered = (projects ?? []).filter(p => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.project_code ?? '').toLowerCase().includes(search.toLowerCase()) ||
      (p.client?.name ?? '').toLowerCase().includes(search.toLowerCase())
    const matchStatus = statusFilter === 'all' || p.status === statusFilter
    
    let matchDate = true
    if (dateFilter !== 'all' && p.createdAt) {
      const expected = startOfDay(new Date(p.createdAt))
      const today = startOfDay(new Date())
      
      if (dateFilter === 'today') matchDate = isSameDay(expected, today)
      else if (dateFilter === 'this_week') matchDate = isSameWeek(expected, today)
      else if (dateFilter === 'this_month') matchDate = isSameMonth(expected, today)
      else if (dateFilter === 'this_quarter') matchDate = isSameQuarter(expected, today)
      else if (dateFilter === 'this_year') matchDate = isSameYear(expected, today)
      else if (dateFilter === 'custom') {
        if (customDateStart && expected < startOfDay(customDateStart)) matchDate = false
        if (customDateEnd && expected > startOfDay(customDateEnd)) matchDate = false
      }
    } else if (dateFilter !== 'all' && !p.createdAt) {
      matchDate = false
    }

    return matchSearch && matchStatus && matchDate
  })

  const isAdmin = userRole === 'admin'

  const exportHeaders = isAdmin 
    ? ['Project Code', 'Name', 'Client', 'Status', 'Quoted Price', 'Start Date', 'Expected Completion', 'Team Lead']
    : ['Project Code', 'Name', 'Status', 'Start Date', 'Expected Completion', 'Team Lead']

  const mapExportData = (p: Project) => isAdmin ? [
    p.project_code || 'N/A',
    p.name,
    p.client?.name || 'N/A',
    p.status,
    p.quoted_price || 0,
    p.start_date ? new Date(p.start_date).toLocaleDateString() : 'N/A',
    p.expected_completion ? new Date(p.expected_completion).toLocaleDateString() : 'N/A',
    p.team_lead?.full_name || 'N/A'
  ] : [
    p.project_code || 'N/A',
    p.name,
    p.status,
    p.start_date ? new Date(p.start_date).toLocaleDateString() : 'N/A',
    p.expected_completion ? new Date(p.expected_completion).toLocaleDateString() : 'N/A',
    p.team_lead?.full_name || 'N/A'
  ]

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const safePage = Math.min(page, totalPages)
  const paginated = filtered.slice((safePage - 1) * pageSize, safePage * pageSize)

  const handleFilter = (fn: () => void) => { fn(); setPage(1) }

  const containerVariants = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.04 } } }
  const itemVariants = { hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0 } }

  return (
    <div className="flex flex-col h-full gap-4">
      {/* Header */}
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h2 className="text-xl font-bold text-text">Projects</h2>
          <p className="text-sm text-text-secondary mt-0.5">{projects?.length ?? 0} total projects</p>
        </div>
        {isAdmin && (
          <Button onClick={() => { setEditingProject(null); setModalOpen(true) }}>
            <Plus size={15} /> New Project
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 shrink-0">
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
            placeholder="Search projects..."
            className="w-full pl-9 pr-4 py-2 bg-bg-secondary border border-border rounded-lg text-sm text-text placeholder:text-text-muted focus:outline-none focus:border-primary/50 transition-all"
          />
        </div>
        <div className="flex items-center gap-2 overflow-x-auto flex-1">
          {STATUSES.map(s => (
            <button
              key={s}
              onClick={() => { setStatusFilter(s); setPage(1) }}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all',
                statusFilter === s
                  ? 'bg-primary text-white'
                  : 'bg-bg-secondary border border-border text-text-secondary hover:text-text hover:border-border-muted'
              )}
            >
              {s === 'all' ? 'All' : PROJECT_STATUS_CONFIG[s as keyof typeof PROJECT_STATUS_CONFIG]?.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <DateFilterDropdown
            value={dateFilter}
            onChange={v => { setDateFilter(v); setPage(1) }}
            onCustomDateChange={(start, end) => {
              setCustomDateStart(start)
              setCustomDateEnd(end)
              setDateFilter('custom')
              setPage(1)
            }}
          />
          <ExportDropdown
            data={filtered}
            headers={exportHeaders}
            filename={`projects_export_${new Date().toISOString().split('T')[0]}`}
            mapData={mapExportData}
          />
        </div>
      </div>



      {/* Content */}
      {isLoading ? (
        <div className="flex flex-col flex-1 min-h-[400px] bg-bg-secondary border border-border rounded-xl shadow-sm overflow-hidden animate-pulse">
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center flex-1">
          <FolderKanban size={36} className="text-text-muted mb-3" />
          <p className="text-text-secondary font-medium">No projects found</p>
          <p className="text-sm text-text-muted mt-1">Create your first project to get started</p>
        </div>
      ) : (
        <div className="relative flex flex-col flex-1 min-h-0 group bg-bg-secondary border border-border rounded-xl overflow-hidden shadow-sm">
          <Glow />
          <div className="relative z-10 overflow-x-auto overflow-y-auto flex-1">
            <table className="min-w-max w-full text-sm">
              <thead>
                <tr className="bg-bg-tertiary border-b border-border">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-text-secondary uppercase tracking-wider whitespace-nowrap">Project</th>
                  {isAdmin && <th className="text-left px-4 py-3 text-xs font-semibold text-text-secondary uppercase tracking-wider whitespace-nowrap">Client</th>}
                  <th className="text-left px-4 py-3 text-xs font-semibold text-text-secondary uppercase tracking-wider whitespace-nowrap">Service</th>
                  {isAdmin && (
                    <>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-text-secondary uppercase tracking-wider whitespace-nowrap">Value</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-text-secondary uppercase tracking-wider whitespace-nowrap">Received</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-text-secondary uppercase tracking-wider whitespace-nowrap">Balance</th>
                    </>
                  )}
                  <th className="text-left px-4 py-3 text-xs font-semibold text-text-secondary uppercase tracking-wider whitespace-nowrap">Start Date</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-text-secondary uppercase tracking-wider whitespace-nowrap">Deadline</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-text-secondary uppercase tracking-wider whitespace-nowrap">Status</th>
                  {isAdmin && <th className="text-center px-4 py-3 text-xs font-semibold text-text-secondary uppercase tracking-wider whitespace-nowrap">Payments</th>}
                </tr>
              </thead>
              <motion.tbody variants={containerVariants} initial="hidden" animate="show">
                {paginated.map(project => {
                  const overdue = isOverdue(project.expected_completion) && !['completed', 'delivered'].includes(project.status)
                  const invoices = project.invoices ?? []
                  const totalReceived = invoices.reduce((s, i) => s + i.amount_received, 0)
                  const totalBilled = invoices.reduce((s, i) => s + i.final_billing, 0)
                  const balance = totalBilled - totalReceived
                  return (
                    <motion.tr
                      key={project.id}
                      variants={itemVariants}
                      onClick={() => { setEditingProject(project); setModalOpen(true) }}
                      className="border-b border-border bg-bg-secondary hover:bg-bg-tertiary transition-colors cursor-pointer"
                    >
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium text-text">{project.name}</p>
                          <p className="text-xs text-text-muted">{project.project_code}</p>
                        </div>
                      </td>
                      {isAdmin && <td className="px-4 py-3 text-text-secondary">{project.client?.name ?? '—'}</td>}
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {project.service_type ? (
                            project.service_type.split(',').map((s, idx) => (
                              <span key={idx} className="text-xs bg-bg-tertiary text-text-secondary px-2 py-1 rounded-md whitespace-nowrap">
                                {s.trim()}
                              </span>
                            ))
                          ) : (
                            <span className="text-text-muted text-xs">—</span>
                          )}
                        </div>
                      </td>
                      {isAdmin && (
                        <>
                          <td className="px-4 py-3 font-medium text-text">{formatCurrency(project.quoted_price)}</td>
                          <td className="px-4 py-3 font-medium text-success">
                            {invoices.length > 0 ? formatCurrency(totalReceived) : <span className="text-text-muted text-xs">—</span>}
                          </td>
                          <td className="px-4 py-3 font-medium">
                            {invoices.length > 0 ? (
                              <span className={cn(balance > 0 ? 'text-warning' : 'text-success')}>{formatCurrency(balance)}</span>
                            ) : <span className="text-text-muted text-xs">—</span>}
                          </td>
                        </>
                      )}
                      <td className="px-4 py-3 text-text-secondary text-xs">
                        {project.start_date ? formatDate(project.start_date) : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn('text-xs', overdue ? 'text-danger font-semibold' : 'text-text-secondary')}>
                          {formatDate(project.expected_completion)}
                          {overdue && ' ⚠'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={STATUS_BADGE_MAP[project.status]}>
                          {PROJECT_STATUS_CONFIG[project.status]?.label}
                        </Badge>
                      </td>
                      {isAdmin && (
                        <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                          <div className="flex justify-center">
                            <button
                              onClick={() => setPaymentProject(project)}
                              title="Click to view"
                              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] font-semibold tracking-wide text-text-secondary bg-bg-tertiary/50 hover:text-primary hover:bg-primary/10 border border-transparent hover:border-primary/20 transition-all uppercase"
                            >
                              <IndianRupee size={12} strokeWidth={2.5} />
                            </button>
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
            itemLabel="projects"
          />
        </div>
      )}

      <ProjectModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        project={editingProject}
        clients={activeClients}
        profiles={activeProfiles}
        userRole={userRole}
        onDelete={p => { setModalOpen(false); setProjectToDelete(p) }}
      />

      <ConfirmModal
        open={!!projectToDelete}
        onClose={() => setProjectToDelete(null)}
        onConfirm={() => projectToDelete && deleteProject.mutate(projectToDelete.id)}
        title="Delete Project"
        description={`Are you sure you want to delete "${projectToDelete?.name}"? All related tasks and files will be permanently removed. This action cannot be undone.`}
        confirmText="Delete Project"
        loading={deleteProject.isPending}
      />

      {/* Payment Detail Drawer */}
      <AnimatePresence>
        {paymentProject && (() => {
          const invoices = paymentProject.invoices ?? []
          const totalBilled = invoices.reduce((s, i) => s + i.final_billing, 0)
          const totalReceived = invoices.reduce((s, i) => s + i.amount_received, 0)
          const balance = totalBilled - totalReceived
          const allInstallments: any[] = []
          invoices.forEach(inv => {
            const hasPayments = inv.payments && inv.payments.length > 0
            const sumOfPayments = hasPayments ? inv.payments!.reduce((sum, p) => sum + p.amount, 0) : 0
            const legacyAmount = inv.amount_received - sumOfPayments
            if (legacyAmount > 0) {
              allInstallments.push({
                id: inv.id + '-legacy',
                date: inv.payment_date || inv.invoice_date,
                amount: legacyAmount,
                mode: inv.payment_mode || 'other',
                notes: 'Initial Record'
              })
            }
            if (hasPayments) {
              inv.payments!.forEach(p => {
                allInstallments.push({
                  id: p.id,
                  date: p.payment_date,
                  amount: p.amount,
                  mode: p.payment_mode,
                  notes: p.notes
                })
              })
            }
          })

          allInstallments.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
          let currentBalance = totalBilled
          const displayInstallments = allInstallments.map(inst => {
            currentBalance -= inst.amount
            return { ...inst, balance: currentBalance }
          })

          const paidCount = allInstallments.length
          const pct = totalBilled > 0 ? Math.round((totalReceived / totalBilled) * 100) : 0

          const STATUS_COLORS: Record<string, string> = {
            paid: 'text-success bg-success/10',
            partially_paid: 'text-warning bg-warning/10',
            pending: 'text-text-secondary bg-bg-tertiary',
            overdue: 'text-danger bg-danger/10',
          }

          return (
            <>
              <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                onClick={() => setPaymentProject(null)}
                className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 !m-0"
              />
              <motion.div
                initial={{ opacity: 0, x: 'calc(100% + 1rem)' }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 'calc(100% + 1rem)' }}
                transition={{ type: 'spring', damping: 28, stiffness: 300 }}
                className="fixed right-4 top-4 bottom-4 w-[calc(100%-2rem)] max-w-2xl bg-bg-secondary border border-border rounded-2xl z-50 flex flex-col shadow-2xl overflow-hidden !m-0"
              >
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
                  <div>
                    <h3 className="font-semibold text-text flex items-center gap-2">
                      {paymentProject.name}
                      {paymentProject.billing_cycle !== 'ONE_TIME' && (
                        <span className="text-[10px] px-2 py-0.5 bg-primary/10 text-primary rounded-full uppercase tracking-wide font-medium">
                          {paymentProject.billing_cycle}
                        </span>
                      )}
                    </h3>
                    <div className="text-xs text-text-muted mt-1 flex items-center gap-3">
                      <span>{paymentProject.project_code} · Payment Details</span>
                      {paymentProject.next_billing_date && (
                        <>
                          <span className="w-1 h-1 rounded-full bg-border" />
                          <span>Next Billing: <span className="font-medium text-text-secondary">{formatDate(paymentProject.next_billing_date)}</span></span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <button onClick={() => setPaymentProject(null)} className="w-8 h-8 rounded-lg flex items-center justify-center text-text-muted hover:text-text hover:bg-bg-tertiary transition-all">
                      <X size={16} />
                    </button>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-5 space-y-4">
                  {/* Summary strip — 4 stats in one row */}
                  <div className="grid grid-cols-4 divide-x divide-border border border-border rounded-xl overflow-hidden">
                    {[
                      { label: 'Quoted Value', value: formatCurrency(paymentProject.quoted_price), color: 'text-text' },
                      { label: 'Total Invoiced', value: formatCurrency(totalBilled), color: 'text-text' },
                      { label: 'Total Received', value: formatCurrency(totalReceived), color: 'text-success' },
                      { label: 'Balance Due', value: formatCurrency(balance), color: balance > 0 ? 'text-warning' : 'text-success' },
                    ].map(stat => (
                      <div key={stat.label} className="bg-bg px-4 py-4 text-center">
                        <p className="text-[11px] text-text-muted uppercase tracking-wider mb-1">{stat.label}</p>
                        <p className={cn('text-base font-bold tabular-nums', stat.color)}>{stat.value}</p>
                      </div>
                    ))}
                  </div>

                  {/* Counters + progress bar — single row */}
                  <div className="flex items-center gap-5 px-5 py-3.5 bg-bg border border-border rounded-xl">
                    {[
                      { label: 'Total Invoices', value: invoices.length, color: 'text-text' },
                      { label: 'Payments Made', value: paidCount, color: 'text-success' },
                      { label: 'Pending (Overall)', value: invoices.length > 0 && balance > 0 ? 1 : 0, color: 'text-warning' },
                    ].map((c, i) => (
                      <div key={c.label} className="flex items-center gap-4">
                        {i > 0 && <div className="w-px h-8 bg-border" />}
                        <div className="flex items-baseline gap-1.5">
                          <span className={cn('text-xl font-bold tabular-nums', c.color)}>{c.value}</span>
                          <span className="text-xs text-text-muted">{c.label}</span>
                        </div>
                      </div>
                    ))}
                    {totalBilled > 0 && (
                      <>
                        <div className="w-px h-8 bg-border" />
                        <div className="flex-1 flex items-center gap-3">
                          <div className="flex-1 bg-bg-tertiary rounded-full h-2">
                            <div className="bg-success h-2 rounded-full transition-all" style={{ width: `${Math.min(100, pct)}%` }} />
                          </div>
                          <span className="text-xs text-text-muted tabular-nums shrink-0 font-medium">{pct}% collected</span>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Installments Table */}
                  <div>
                    <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-3">Installment History</p>
                    {displayInstallments.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-12 text-center bg-bg border border-border rounded-xl">
                        <IndianRupee size={28} className="text-text-muted mb-2" />
                        <p className="text-sm text-text-secondary">No payments yet</p>
                        <p className="text-xs text-text-muted mt-1">Add payments from the invoice modal</p>
                      </div>
                    ) : (
                      <div className="rounded-xl border border-border overflow-hidden">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-bg-tertiary border-b border-border">
                              {['Date', 'Received', 'Balance', 'Mode / Notes'].map(h => (
                                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-text-secondary uppercase tracking-wider whitespace-nowrap">{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {displayInstallments.map((inst, idx) => {
                              const rowBg = idx % 2 === 0 ? 'bg-bg-secondary' : 'bg-bg'
                              return (
                                <tr key={inst.id} className={cn('border-b border-border last:border-0', rowBg)}>
                                  <td className="px-4 py-2.5 text-text-secondary whitespace-nowrap text-xs">{formatDate(inst.date)}</td>
                                  <td className="px-4 py-2.5 font-medium text-success whitespace-nowrap tabular-nums text-xs">{formatCurrency(inst.amount)}</td>
                                  <td className="px-4 py-2.5 font-medium whitespace-nowrap tabular-nums text-xs">
                                    <span className={inst.balance > 0 ? 'text-warning' : 'text-success'}>{formatCurrency(inst.balance)}</span>
                                  </td>
                                  <td className="px-4 py-2.5 whitespace-nowrap flex items-center gap-2">
                                    <span className={cn('text-[10px] px-2 py-1 rounded-md font-medium whitespace-nowrap uppercase text-text-secondary bg-bg-tertiary')}>
                                      {inst.mode.replace('_', ' ')}
                                    </span>
                                    {inst.notes && <span className="text-xs text-text-muted truncate max-w-[150px]" title={inst.notes}>{inst.notes}</span>}
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  </div>

                {/* Footer */}
                {paymentProject.billing_cycle !== 'ONE_TIME' && paymentProject.next_billing_date && isAdmin && (
                  <div className="px-6 py-4 border-t border-border bg-bg-secondary flex justify-end gap-3 shrink-0">
                    <Button variant="secondary" onClick={() => setPaymentProject(null)} className="text-xs h-8 px-3">Close</Button>
                    <Button
                      size="md"
                      variant="primary"
                      className="text-xs h-8 px-3"
                      disabled={isGeneratingInvoice}
                      onClick={async () => {
                        setIsGeneratingInvoice(true)
                        try {
                          const res = await generateNextInvoice(paymentProject.id)
                          if (res.success) {
                            toast.success('Next recurring invoice generated')
                            qc.invalidateQueries({ queryKey: ['projects'] })
                            qc.invalidateQueries({ queryKey: ['dashboard'] })
                            qc.invalidateQueries({ queryKey: ['invoices'] })
                            qc.invalidateQueries({ queryKey: ['profitability'] })
                            setPaymentProject(null)
                          } else {
                            toast.error(res.error || 'Failed to generate invoice')
                          }
                        } catch (err: any) {
                          toast.error('An error occurred')
                        } finally {
                          setIsGeneratingInvoice(false)
                        }
                      }}
                    >
                      {isGeneratingInvoice ? 'Generating...' : 'Generate Next Invoice'}
                    </Button>
                  </div>
                )}
              </motion.div>
            </>
          )
        })()}
      </AnimatePresence>
    </div>
  )
}

