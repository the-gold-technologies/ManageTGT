'use client'

import { useState, useMemo, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  FolderOpen, Search, Upload, Grid3X3, List,
  Users, FolderKanban, FileText, Receipt, Wallet, UserCheck,
  ChevronDown, X, RefreshCw, FolderPlus, ArrowLeft,
} from 'lucide-react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { getFiles } from '@/app/actions/files'
import { getFolders, getAllFolders } from '@/app/actions/folder-actions'
import { moveFileToFolder } from '@/app/actions/folder-actions'
import { Button } from '@/components/ui/button'
import FileCard from './file-card'
import FileUploadModal from './file-upload-modal'
import FilePreviewModal from './file-preview-modal'
import FileShareModal from './file-share-modal'
import FileVersionsModal from './file-versions-modal'
import FolderCard from './folder-card'
import FolderBreadcrumb, { BreadcrumbItem } from './folder-breadcrumb'
import CreateFolderModal from './create-folder-modal'

type FileCategory =
  | 'brand_assets' | 'reference' | 'deliverable' | 'contract'
  | 'invoice_docs' | 'content' | 'bill_receipt' | 'general'

type FileContext = 'all' | 'client' | 'project' | 'prospect' | 'task' | 'invoice' | 'expense'

const CATEGORIES: { value: FileCategory | 'all'; label: string }[] = [
  { value: 'all', label: 'All Categories' },
  { value: 'brand_assets', label: 'Brand Assets' },
  { value: 'reference', label: 'Reference' },
  { value: 'deliverable', label: 'Deliverables' },
  { value: 'contract', label: 'Contracts' },
  { value: 'invoice_docs', label: 'Invoice Docs' },
  { value: 'content', label: 'Content' },
  { value: 'bill_receipt', label: 'Bills & Receipts' },
  { value: 'general', label: 'General' },
]

const CONTEXTS: { value: FileContext; label: string; icon: any }[] = [
  { value: 'all', label: 'All Files', icon: FolderOpen },
  { value: 'client', label: 'Clients', icon: Users },
  { value: 'project', label: 'Projects', icon: FolderKanban },
  { value: 'prospect', label: 'Prospects', icon: UserCheck },
  { value: 'task', label: 'Tasks', icon: FileText },
  { value: 'invoice', label: 'Invoices', icon: Receipt },
  { value: 'expense', label: 'Expenses', icon: Wallet },
]

const CATEGORY_COLORS: Record<string, string> = {
  brand_assets: 'bg-purple-500/15 text-purple-400 border-purple-500/20',
  reference: 'bg-blue-500/15 text-blue-400 border-blue-500/20',
  deliverable: 'bg-green-500/15 text-green-400 border-green-500/20',
  contract: 'bg-orange-500/15 text-orange-400 border-orange-500/20',
  invoice_docs: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/20',
  content: 'bg-pink-500/15 text-pink-400 border-pink-500/20',
  bill_receipt: 'bg-red-500/15 text-red-400 border-red-500/20',
  general: 'bg-slate-500/15 text-slate-400 border-slate-500/20',
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  initialFiles: any[]
  clients: any[]
  projects: any[]
  users: { id: string; name: string | null; image: string | null }[]
  currentUserId: string
  allowedModules: string[]
}

// Navigation state:
// level === 'root'         → show entity folders (built-in) + custom root folders
// level === 'entity'       → inside a specific entity folder (e.g., project "Karachi") → show custom sub-folders + files with that entity_id
// level === 'custom_folder' → inside a custom folder → show its files
type NavLevel = 'root' | 'entity' | 'custom_folder'

interface NavState {
  level: NavLevel
  entityId?: string       // id of the selected project/client/etc.
  entityLabel?: string    // name of the selected entity
  customFolderId?: string
  customFolderName?: string
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function FileManagerClient({ initialFiles, clients, projects, users, currentUserId, allowedModules }: Props) {
  const qc = useQueryClient()

  // View & filter state
  const [view, setView] = useState<'grid' | 'list'>('grid')
  const [search, setSearch] = useState('')
  const [activeContext, setActiveContext] = useState<FileContext>('all')
  const [activeCategory, setActiveCategory] = useState<FileCategory | 'all'>('all')

  // Folder navigation
  const [nav, setNav] = useState<NavState>({ level: 'root' })
  const [createFolderOpen, setCreateFolderOpen] = useState(false)

  // Drag-and-drop over folders
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null)
  const [draggingFileId, setDraggingFileId] = useState<string | null>(null)

  // Modal state
  const [uploadOpen, setUploadOpen] = useState(false)
  const [previewFile, setPreviewFile] = useState<any | null>(null)
  const [shareFile, setShareFile] = useState<any | null>(null)
  const [versionsFile, setVersionsFile] = useState<any | null>(null)
  const [editFile, setEditFile] = useState<any | null>(null)

  // ─── Reset nav when context changes ────────────────────────────────────────
  function switchContext(ctx: FileContext) {
    setActiveContext(ctx)
    setNav({ level: 'root' })
    setSearch('')
  }

  // ─── All files query ────────────────────────────────────────────────────────
  const { data: allFilesForStats = initialFiles, isLoading: isAllFilesLoading, isFetching, refetch } = useQuery({
    queryKey: ['files', 'all', 'all', false],
    queryFn: async () => {
      const result = await getFiles({ context: 'all' })
      return result.files ?? []
    },
    initialData: initialFiles,
    staleTime: 30_000,
  })

  // ─── Instant local filtering for Current-view files ─────────────────────────
  const files = useMemo(() => {
    let filtered = allFilesForStats || []

    if (activeCategory !== 'all') {
      filtered = filtered.filter((f: any) => f.category === activeCategory)
    }

    if (nav.level === 'entity' && nav.entityId) {
      filtered = filtered.filter((f: any) => f[`${activeContext}_id`] === nav.entityId && !f.folder_id)
    } else if (nav.level === 'custom_folder' && nav.customFolderId) {
      filtered = filtered.filter((f: any) => f.folder_id === nav.customFolderId)
    } else if (activeContext !== 'all') {
      filtered = filtered.filter((f: any) => f[`${activeContext}_id`] && !f.folder_id)
    } else {
      filtered = filtered.filter((f: any) => !f.folder_id)
    }

    return filtered
  }, [allFilesForStats, nav, activeContext, activeCategory])

  const isFilesLoading = isAllFilesLoading

  // ─── Custom folders query (All folders) ──────────────────────────────────────
  const { data: allFolders = [], refetch: refetchFolders } = useQuery({
    queryKey: ['folders', 'all'],
    queryFn: async () => {
      const res = await getAllFolders()
      return res.folders ?? []
    },
    staleTime: 30_000,
  })

  // Filter custom folders locally
  const customFolders = useMemo(() => {
    let folders = allFolders

    if (activeContext !== 'all') {
      folders = folders.filter((f: any) => f.context === activeContext)
    }

    if (nav.level === 'entity' && nav.entityId) {
      folders = folders.filter((f: any) => f.context_id === nav.entityId)
    } else {
      folders = folders.filter((f: any) => !f.context_id)
    }

    return folders
  }, [allFolders, nav, activeContext])

  // ─── Derived entity list for root-level display ───────────────────────────
  // Build built-in entity folders from existing data
  const entityFolders = useMemo(() => {
    if (activeContext === 'all') {
      // Show context-level summary folders
      return CONTEXTS.slice(1).map(ctx => {
        const count = allFilesForStats.filter((f: any) => f[`${ctx.value}_id`]).length
        return { id: `ctx:${ctx.value}`, name: ctx.label, files: new Array(count).fill({ id: '' }), _ctxValue: ctx.value }
      }).filter(ef => ef.files.length > 0)
    }
    if (activeContext === 'project') {
      const grouped = new Map<string, { id: string; name: string; code: string; count: number }>()
      allFilesForStats.forEach((f: any) => {
        if (f.project_id && f.project) {
          const cur = grouped.get(f.project_id)
          grouped.set(f.project_id, { id: f.project_id, name: f.project.name, code: f.project.project_code || '', count: (cur?.count ?? 0) + 1 })
        }
      })
      return Array.from(grouped.values()).map(p => ({ id: `project:${p.id}`, name: p.name, files: new Array(p.count).fill({ id: '' }), _entityId: p.id }))
    }
    if (activeContext === 'client') {
      const grouped = new Map<string, { id: string; name: string; count: number }>()
      allFilesForStats.forEach((f: any) => {
        if (f.client_id && f.client) {
          const cur = grouped.get(f.client_id)
          grouped.set(f.client_id, { id: f.client_id, name: f.client.name, count: (cur?.count ?? 0) + 1 })
        }
      })
      return Array.from(grouped.values()).map(c => ({ id: `client:${c.id}`, name: c.name, files: new Array(c.count).fill({ id: '' }), _entityId: c.id }))
    }
    if (activeContext === 'prospect') {
      const grouped = new Map<string, { id: string; name: string; count: number }>()
      allFilesForStats.forEach((f: any) => {
        if (f.prospect_id && f.prospect) {
          const cur = grouped.get(f.prospect_id)
          grouped.set(f.prospect_id, { id: f.prospect_id, name: f.prospect.name, count: (cur?.count ?? 0) + 1 })
        }
      })
      return Array.from(grouped.values()).map(p => ({ id: `prospect:${p.id}`, name: p.name, files: new Array(p.count).fill({ id: '' }), _entityId: p.id }))
    }
    if (activeContext === 'task') {
      const grouped = new Map<string, { id: string; name: string; count: number }>()
      allFilesForStats.forEach((f: any) => {
        if (f.task_id && f.task) {
          const cur = grouped.get(f.task_id)
          grouped.set(f.task_id, { id: f.task_id, name: f.task.title, count: (cur?.count ?? 0) + 1 })
        }
      })
      return Array.from(grouped.values()).map(t => ({ id: `task:${t.id}`, name: t.name, files: new Array(t.count).fill({ id: '' }), _entityId: t.id }))
    }
    if (activeContext === 'invoice') {
      const grouped = new Map<string, { id: string; name: string; count: number }>()
      allFilesForStats.forEach((f: any) => {
        if (f.invoice_id && f.invoice) {
          const cur = grouped.get(f.invoice_id)
          grouped.set(f.invoice_id, { id: f.invoice_id, name: f.invoice.invoice_number, count: (cur?.count ?? 0) + 1 })
        }
      })
      return Array.from(grouped.values()).map(i => ({ id: `invoice:${i.id}`, name: i.name, files: new Array(i.count).fill({ id: '' }), _entityId: i.id }))
    }
    if (activeContext === 'expense') {
      const grouped = new Map<string, { id: string; name: string; count: number }>()
      allFilesForStats.forEach((f: any) => {
        if (f.expense_id && f.expense) {
          const cur = grouped.get(f.expense_id)
          grouped.set(f.expense_id, { id: f.expense_id, name: f.expense.description || f.expense.expense_type, count: (cur?.count ?? 0) + 1 })
        }
      })
      return Array.from(grouped.values()).map(e => ({ id: `expense:${e.id}`, name: e.name, files: new Array(e.count).fill({ id: '' }), _entityId: e.id }))
    }
    return []
  }, [activeContext, allFilesForStats])

  // ─── Filtered files in current view ────────────────────────────────────────
  const filtered = useMemo(() => {
    if (!search.trim()) return files
    const q = search.toLowerCase()
    return files.filter((f: any) =>
      f.name?.toLowerCase().includes(q) ||
      f.source_note?.toLowerCase().includes(q) ||
      f.client?.name?.toLowerCase().includes(q) ||
      f.project?.name?.toLowerCase().includes(q) ||
      f.uploader_name?.toLowerCase().includes(q)
    )
  }, [files, search])

  // ─── Stats ─────────────────────────────────────────────────────────────────
  const stats = useMemo(() => ({
    total: allFilesForStats.length,
    byContext: CONTEXTS.slice(1).reduce((acc, c) => {
      acc[c.value] = allFilesForStats.filter((f: any) => f[`${c.value}_id`]).length
      return acc
    }, {} as Record<string, number>),
  }), [allFilesForStats])

  // ─── Breadcrumbs ───────────────────────────────────────────────────────────
  const breadcrumbs = useMemo((): BreadcrumbItem[] => {
    const ctx = CONTEXTS.find(c => c.value === activeContext)
    const crumbs: BreadcrumbItem[] = [
      { label: ctx?.label ?? 'All Files', onClick: () => setNav({ level: 'root' }) },
    ]
    if (nav.level === 'entity' && nav.entityLabel) {
      crumbs.push({ label: nav.entityLabel, onClick: () => setNav({ level: 'root' }) })
    }
    if (nav.level === 'custom_folder' && nav.customFolderName) {
      crumbs.push({ label: nav.customFolderName, onClick: () => {} })
    }
    return crumbs
  }, [activeContext, nav])

  // ─── Callbacks ─────────────────────────────────────────────────────────────
  const onUploaded = useCallback(() => { qc.invalidateQueries({ queryKey: ['files'] }); refetch() }, [qc, refetch])
  const onDeleted = useCallback(() => { qc.invalidateQueries({ queryKey: ['files'] }); refetch() }, [qc, refetch])
  const onEdited = useCallback(() => { qc.invalidateQueries({ queryKey: ['files'] }); refetch() }, [qc, refetch])
  const onFolderUpdated = useCallback(() => { qc.invalidateQueries({ queryKey: ['folders'] }); refetchFolders() }, [qc, refetchFolders])

  // ─── Drag-and-drop onto folder cards ───────────────────────────────────────
  async function handleDropOnCustomFolder(folderId: string) {
    if (!draggingFileId) return
    const res = await moveFileToFolder(draggingFileId, folderId)
    if (res.success) {
      toast.success('File moved to folder')
      onUploaded()
    } else {
      toast.error('Failed to move file')
    }
    setDragOverFolderId(null)
    setDraggingFileId(null)
  }

  // ─── Module access ──────────────────────────────────────────────────────────
  const contextToModuleKey: Record<string, string> = {
    client: 'clients', project: 'projects', prospect: 'prospects',
    task: 'tasks', invoice: 'revenue', expense: 'expenses',
  }

  const visibleContexts = useMemo(() => {
    if (allowedModules.includes('admin')) return CONTEXTS
    return CONTEXTS.filter(c => {
      if (c.value === 'all') return true
      const modKey = contextToModuleKey[c.value]
      return allowedModules.includes(modKey)
    })
  }, [allowedModules])

  // ─── What to show in main area ─────────────────────────────────────────────
  const showFolders = nav.level === 'root' || nav.level === 'entity'
  const isLoading = isFilesLoading

  // At root level, show entity folders; at entity level, show custom folders + files
  const builtInFoldersToShow = nav.level === 'root' ? entityFolders : []
  const customFoldersToShow = nav.level !== 'custom_folder' ? customFolders : []
  const showFiles = nav.level === 'entity' || nav.level === 'custom_folder' || (nav.level === 'root' && activeContext === 'all' && !entityFolders.length)

  const hasFolders = builtInFoldersToShow.length > 0 || customFoldersToShow.length > 0
  const hasContent = hasFolders || (showFiles && filtered.length > 0)


  const canCreateFolder = nav.level === 'root' || nav.level === 'entity'

  return (
    <div className="absolute inset-x-4 top-4 bottom-24 md:inset-6 flex flex-col lg:flex-row">
      {/* ── Left Sidebar ── */}
      <aside className="w-full lg:w-52 shrink-0 border border-border bg-bg-secondary flex flex-row lg:flex-col gap-2 lg:gap-1 py-3 lg:py-5 px-3 overflow-x-auto lg:overflow-y-auto rounded-xl lg:mr-4 mb-3 lg:mb-0 snap-x lg:snap-none [scrollbar-width:none] [&::-webkit-scrollbar]:hidden shadow-sm">
        <div className="hidden lg:block px-2 mb-3">
          <h2 className="text-xs font-semibold text-text-muted uppercase tracking-widest">Browse</h2>
        </div>

        {visibleContexts.map(ctx => (
          <button
            key={ctx.value}
            onClick={() => switchContext(ctx.value)}
            className={cn(
              'flex items-center gap-2.5 px-3 py-2 lg:h-9 lg:py-0 rounded-lg text-sm font-medium transition-all text-left whitespace-nowrap shrink-0 lg:w-full',
              activeContext === ctx.value
                ? 'bg-primary text-primary-foreground shadow-glow-sm'
                : 'text-text-secondary hover:text-text hover:bg-bg-tertiary'
            )}
          >
            <ctx.icon size={15} className="shrink-0" />
            <span className="flex-1">{ctx.label}</span>
            {ctx.value !== 'all' && stats.byContext[ctx.value] > 0 && (
              <span className={cn(
                'text-xs px-1.5 py-0.5 rounded-full',
                activeContext === ctx.value ? 'bg-white/20 text-white' : 'bg-bg-tertiary text-text-muted'
              )}>
                {stats.byContext[ctx.value]}
              </span>
            )}
            {ctx.value === 'all' && (
              <span className={cn(
                'text-xs px-1.5 py-0.5 rounded-full',
                activeContext === 'all' ? 'bg-white/20 text-white' : 'bg-bg-tertiary text-text-muted'
              )}>
                {stats.total}
              </span>
            )}
          </button>
        ))}
      </aside>

      {/* ── Main Content ── */}
      <div className="flex-1 flex flex-col overflow-hidden bg-bg-secondary border border-border rounded-xl shadow-sm">

        {/* Top bar */}
        <div className="flex items-center justify-between gap-3 px-4 lg:px-5 py-2.5 border-b border-border shrink-0 bg-bg/50 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="flex items-center gap-2 lg:gap-3 min-w-0 shrink-0">
            {/* Back button when inside entity or custom folder */}
            {nav.level !== 'root' && (
              <button
                onClick={() => {
                  if (nav.level === 'custom_folder') {
                    setNav({ level: nav.entityId ? 'entity' : 'root', entityId: nav.entityId, entityLabel: nav.entityLabel })
                  } else {
                    setNav({ level: 'root' })
                  }
                }}
                className="p-1.5 rounded-lg border border-border text-text-secondary hover:text-text hover:bg-bg-secondary transition-all shrink-0"
                title="Back"
              >
                <ArrowLeft size={14} />
              </button>
            )}

            {/* Breadcrumb */}
            <FolderBreadcrumb items={breadcrumbs} className="hidden sm:flex" />

            {/* Category dropdown */}
            {(nav.level === 'entity' || nav.level === 'custom_folder') && (
              <div className="relative shrink-0">
                <select
                  value={activeCategory}
                  onChange={(e) => setActiveCategory(e.target.value as any)}
                  className="appearance-none pl-2.5 pr-7 py-1.5 bg-bg-secondary border border-border rounded-lg text-[11px] text-text focus:outline-none focus:border-primary/50 transition-all cursor-pointer h-8"
                >
                  {CATEGORIES.map(cat => (
                    <option key={cat.value} value={cat.value}>{cat.label}</option>
                  ))}
                </select>
                <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
              </div>
            )}
          </div>

          <div className="flex items-center gap-1.5 lg:gap-2 shrink-0">
            <div className="relative w-32 sm:w-48 lg:w-56 shrink-0">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search..."
                className="w-full pl-7 pr-7 py-1.5 bg-bg border border-border rounded-lg text-xs text-text placeholder:text-text-muted focus:outline-none focus:border-primary/50 transition-all h-8"
              />
              {search && (
                <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted hover:text-text">
                  <X size={12} />
                </button>
              )}
            </div>

            {/* Grid / List toggle */}
            <div className="flex items-center border border-border rounded-lg overflow-hidden shrink-0 h-8">
              {(['grid', 'list'] as const).map(v => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className={cn(
                    'p-1.5 px-2 transition-all h-full flex items-center justify-center',
                    view === v ? 'bg-primary text-primary-foreground' : 'text-text-secondary hover:text-text hover:bg-bg-secondary'
                  )}
                >
                  {v === 'grid' ? <Grid3X3 size={14} /> : <List size={14} />}
                </button>
              ))}
            </div>

            <button
              onClick={() => refetch()}
              className="p-1.5 px-2 rounded-lg border border-border text-text-secondary hover:text-text hover:bg-bg-secondary transition-all shrink-0 h-8 flex items-center justify-center"
              title="Refresh"
            >
              <RefreshCw size={14} className={cn(isFetching && 'animate-spin')} />
            </button>

            {/* New Folder button */}
            {canCreateFolder && (
              <Button
                variant="secondary"
                onClick={() => setCreateFolderOpen(true)}
                className="gap-1.5 shrink-0 hidden sm:flex h-8 px-2.5 text-[11px]"
              >
                <FolderPlus size={13} /> New Folder
              </Button>
            )}

            <Button onClick={() => setUploadOpen(true)} className="gap-1.5 shrink-0 hidden sm:flex h-8 px-2.5 text-[11px]">
              <Upload size={13} /> Upload
            </Button>
            <Button onClick={() => setUploadOpen(true)} className="shrink-0 sm:hidden h-8 px-2.5" title="Upload">
              <Upload size={13} />
            </Button>
          </div>
        </div>

        {/* File / Folder Grid */}
        <div className="flex-1 overflow-y-auto p-6">
          {isLoading ? (
            <div className={cn(
              view === 'grid'
                ? 'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4'
                : 'grid grid-cols-1 lg:grid-cols-2 gap-3'
            )}>
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className={cn(
                  'bg-bg-secondary border border-border rounded-xl animate-pulse',
                  view === 'grid' ? 'h-40' : 'h-16'
                )} />
              ))}
            </div>
          ) : !hasContent ? (
            <div className="flex flex-col items-center justify-center h-full gap-4 py-20">
              <div className="w-16 h-16 rounded-2xl bg-bg-secondary border border-border flex items-center justify-center">
                <FolderOpen size={28} className="text-text-muted" />
              </div>
              <div className="text-center">
                <p className="text-base font-semibold text-text">Nothing here yet</p>
                <p className="text-sm text-text-muted mt-1">
                  {search ? `No results for "${search}"` : 'Upload a file or create a folder to get started'}
                </p>
              </div>
              {!search && (
                <div className="flex gap-2">
                  {canCreateFolder && (
                    <Button variant="secondary" onClick={() => setCreateFolderOpen(true)} className="gap-2">
                      <FolderPlus size={14} /> New Folder
                    </Button>
                  )}
                  <Button onClick={() => setUploadOpen(true)} className="gap-2">
                    <Upload size={14} /> Upload File
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-6">
              {/* ── Built-in entity folders ────────────────────────────────── */}
              {builtInFoldersToShow.length > 0 && (
                <section>
                  <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">
                    {activeContext === 'all' ? 'Categories' : 'Folders'}
                  </p>
                  <div className={cn(
                    view === 'grid'
                      ? 'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4'
                      : 'grid grid-cols-1 lg:grid-cols-2 gap-3'
                  )}>
                    <AnimatePresence initial={false}>
                      {builtInFoldersToShow.map((ef: any) => (
                        <FolderCard
                          key={ef.id}
                          folder={{ id: ef.id, name: ef.name, context: activeContext }}
                          view={view}
                          isBuiltIn
                          fileCount={ef.files?.length ?? 0}
                          onClick={() => {
                            if (activeContext === 'all' && ef._ctxValue) {
                              // Drill into context
                              setActiveContext(ef._ctxValue)
                              setNav({ level: 'root' })
                            } else if (ef._entityId) {
                              setNav({ level: 'entity', entityId: ef._entityId, entityLabel: ef.name })
                            }
                          }}
                          onUpdated={onFolderUpdated}
                          isDragOver={dragOverFolderId === ef.id}
                          onDragOver={e => { e.preventDefault(); setDragOverFolderId(ef.id) }}
                          onDragLeave={() => setDragOverFolderId(null)}
                          onDrop={async e => {
                            e.preventDefault()
                            setDragOverFolderId(null)
                          }}
                        />
                      ))}
                    </AnimatePresence>
                  </div>
                </section>
              )}

              {/* ── Custom folders ────────────────────────────────────────── */}
              {customFoldersToShow.length > 0 && (
                <section>
                  <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">Custom Folders</p>
                  <div className={cn(
                    view === 'grid'
                      ? 'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4'
                      : 'grid grid-cols-1 lg:grid-cols-2 gap-3'
                  )}>
                    <AnimatePresence initial={false}>
                      {customFoldersToShow.map((f: any) => (
                        <FolderCard
                          key={f.id}
                          folder={f}
                          view={view}
                          onClick={() => setNav({
                            level: 'custom_folder',
                            customFolderId: f.id,
                            customFolderName: f.name,
                            entityId: nav.entityId,
                            entityLabel: nav.entityLabel,
                          })}
                          onUpdated={onFolderUpdated}
                          isDragOver={dragOverFolderId === f.id}
                          onDragOver={e => { e.preventDefault(); setDragOverFolderId(f.id) }}
                          onDragLeave={() => setDragOverFolderId(null)}
                          onDrop={async e => {
                            e.preventDefault()
                            await handleDropOnCustomFolder(f.id)
                          }}
                        />
                      ))}
                    </AnimatePresence>
                  </div>
                </section>
              )}

              {/* ── Files ─────────────────────────────────────────────────── */}
              {showFiles && filtered.length > 0 && (
                <section>
                  {hasFolders && (
                    <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">Files</p>
                  )}
                  <motion.div
                    layout
                    className={cn(
                      view === 'grid'
                        ? 'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4'
                        : 'grid grid-cols-1 lg:grid-cols-2 gap-3'
                    )}
                  >
                    <AnimatePresence initial={false}>
                      {filtered.map((file: any) => (
                        <FileCard
                          key={file.id}
                          file={file}
                          view={view}
                          categoryColors={CATEGORY_COLORS}
                          onPreview={() => setPreviewFile(file)}
                          onShare={() => setShareFile(file)}
                          onVersions={() => setVersionsFile(file)}
                          onDeleted={onDeleted}
                          onEdit={() => setEditFile(file)}
                          draggable
                          onDragStart={() => setDraggingFileId(file.id)}
                          onDragEnd={() => setDraggingFileId(null)}
                        />
                      ))}
                    </AnimatePresence>
                  </motion.div>
                </section>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Modals ── */}
      <FileUploadModal
        open={uploadOpen || !!editFile}
        onClose={() => { setUploadOpen(false); setEditFile(null) }}
        clients={clients}
        projects={projects}
        onSuccess={editFile ? onEdited : onUploaded}
        currentUserId={currentUserId}
        allowedModules={allowedModules}
        editingFile={editFile}
        defaultContext={activeContext !== 'all' ? activeContext : undefined}
        defaultContextId={nav.entityId}
        defaultFolderId={nav.customFolderId}
      />

      {previewFile && (
        <FilePreviewModal
          file={previewFile}
          onClose={() => setPreviewFile(null)}
          categoryColors={CATEGORY_COLORS}
        />
      )}

      {shareFile && (
        <FileShareModal
          file={shareFile}
          users={users}
          onClose={() => setShareFile(null)}
          onShared={() => { qc.invalidateQueries({ queryKey: ['files'] }); refetch() }}
        />
      )}

      {versionsFile && (
        <FileVersionsModal
          file={versionsFile}
          onClose={() => setVersionsFile(null)}
        />
      )}

      <CreateFolderModal
        open={createFolderOpen}
        onClose={() => setCreateFolderOpen(false)}
        context={activeContext}
        contextId={nav.level === 'entity' ? nav.entityId : undefined}
        onCreated={() => { onFolderUpdated(); setCreateFolderOpen(false) }}
      />
    </div>
  )
}
