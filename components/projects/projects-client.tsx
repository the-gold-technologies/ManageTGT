'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Plus, Search, FolderKanban, Calendar, User, MoreHorizontal, Pencil, Trash2, Eye, FileDown } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { parseISO, startOfDay, isSameDay, isSameWeek, isSameMonth, isSameQuarter, isSameYear } from 'date-fns'
import type { Project, Client, Profile } from '@/types'
import { getProjects, deleteProject as deleteProjectAction } from '@/app/actions/projects'
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
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const qc = useQueryClient()

  const { data: projects } = useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const data = await getProjects()
      return data as unknown as Project[]
    },
    initialData: initialProjects,
  })

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
    onSuccess: () => toast.success('Project deleted'),
    onError: (err, _, context) => {
      // Rollback to previous state if mutation fails
      if (context?.previous) qc.setQueryData(['projects'], context.previous)
      toast.error('Failed to delete project')
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['projects'] }),
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

  const exportHeaders = ['Project Code', 'Name', 'Client', 'Status', 'Quoted Price', 'Start Date', 'Expected Completion', 'Team Lead']
  const mapExportData = (p: Project) => [
    p.project_code || 'N/A',
    p.name,
    p.client?.name || 'N/A',
    p.status,
    p.quoted_price || 0,
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
        <Button onClick={() => { setEditingProject(null); setModalOpen(true) }}>
          <Plus size={15} /> New Project
        </Button>
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
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center flex-1">
          <FolderKanban size={36} className="text-text-muted mb-3" />
          <p className="text-text-secondary font-medium">No projects found</p>
          <p className="text-sm text-text-muted mt-1">Create your first project to get started</p>
        </div>
      ) : (
        <div className="relative flex flex-col flex-1 min-h-0 group bg-bg-secondary border border-border rounded-xl overflow-hidden shadow-sm">
          <Glow />
          <div className="relative z-10 overflow-x-auto overflow-y-auto flex-1">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-bg-tertiary border-b border-border">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-text-secondary uppercase tracking-wider">Project</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-text-secondary uppercase tracking-wider">Client</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-text-secondary uppercase tracking-wider">Service</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-text-secondary uppercase tracking-wider">Value</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-text-secondary uppercase tracking-wider">Deadline</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-text-secondary uppercase tracking-wider">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-text-secondary uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <motion.tbody variants={containerVariants} initial="hidden" animate="show">
                {paginated.map(project => {
                  const overdue = isOverdue(project.expected_completion) && !['completed', 'delivered'].includes(project.status)
                  return (
                    <motion.tr
                      key={project.id}
                      variants={itemVariants}
                      className="border-b border-border bg-bg-secondary hover:bg-bg-tertiary transition-colors group"
                    >
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium text-text">{project.name}</p>
                          <p className="text-xs text-text-muted">{project.project_code}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-text-secondary">{project.client?.name ?? '—'}</td>
                      <td className="px-4 py-3">
                        <span className="text-xs bg-bg-tertiary text-text-secondary px-2 py-1 rounded-md">
                          {project.service_type}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-medium text-text">{formatCurrency(project.quoted_price)}</td>
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
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => { setEditingProject(project); setModalOpen(true) }}
                            className="w-7 h-7 rounded-lg flex items-center justify-center text-text-muted hover:text-text hover:bg-bg-tertiary transition-all"
                          >
                            <Pencil size={12} />
                          </button>
                          <button
                            onClick={() => setProjectToDelete(project)}
                            className="w-7 h-7 rounded-lg flex items-center justify-center text-text-muted hover:text-danger hover:bg-danger-muted transition-all"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </td>
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
        clients={clients}
        profiles={profiles}
        userRole={userRole}
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
    </div>
  )
}

