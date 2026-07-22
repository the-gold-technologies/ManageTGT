'use client'

import { useState, useMemo, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  FolderOpen, Search, Upload, Grid3X3, List, Filter,
  Users, FolderKanban, FileText, Receipt, Wallet, UserCheck,
  ChevronDown, X, RefreshCw,
} from 'lucide-react'
import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { getFiles } from '@/app/actions/files'
import { Button } from '@/components/ui/button'
import FileCard from './file-card'
import FileUploadModal from './file-upload-modal'
import FilePreviewModal from './file-preview-modal'
import FileShareModal from './file-share-modal'
import FileVersionsModal from './file-versions-modal'

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

interface Props {
  initialFiles: any[]
  clients: any[]
  projects: any[]
  users: { id: string; name: string | null; image: string | null }[]
  currentUserId: string
  allowedModules: string[]
}

export default function FileManagerClient({ initialFiles, clients, projects, users, currentUserId, allowedModules }: Props) {
  const qc = useQueryClient()

  // View & filter state
  const [view, setView] = useState<'grid' | 'list'>('grid')
  const [search, setSearch] = useState('')
  const [activeContext, setActiveContext] = useState<FileContext>('all')
  const [activeCategory, setActiveCategory] = useState<FileCategory | 'all'>('all')


  // Modal state
  const [uploadOpen, setUploadOpen] = useState(false)
  const [previewFile, setPreviewFile] = useState<any | null>(null)
  const [shareFile, setShareFile] = useState<any | null>(null)
  const [versionsFile, setVersionsFile] = useState<any | null>(null)

  const { data: files = initialFiles, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['files', activeContext, activeCategory],
    queryFn: async () => {
      const result = await getFiles({
        context: activeContext,
        category: activeCategory !== 'all' ? activeCategory as FileCategory : undefined
      })
      return result.files ?? []
    },
    initialData: (activeContext === 'all' && activeCategory === 'all') ? initialFiles : undefined,
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  })

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

  // Fetch all files specifically for stats so counters don't reset when switching tabs
  const { data: allFiles = initialFiles } = useQuery({
    queryKey: ['files', 'all', 'all', false],
    queryFn: async () => {
      const result = await getFiles({ context: 'all' })
      return result.files ?? []
    },
    initialData: initialFiles,
    staleTime: 30_000,
  })

  // Group stats
  const stats = useMemo(() => ({
    total: allFiles.length,
    byContext: CONTEXTS.slice(1).reduce((acc, c) => {
      acc[c.value] = allFiles.filter((f: any) => f[`${c.value}_id`]).length
      return acc
    }, {} as Record<string, number>),
  }), [allFiles])

  const onUploaded = useCallback(() => {
    qc.invalidateQueries({ queryKey: ['files'] })
    refetch()
  }, [qc, refetch])

  const onDeleted = useCallback(() => {
    qc.invalidateQueries({ queryKey: ['files'] })
    refetch()
  }, [qc, refetch])

  // Map context value to module key
  const contextToModuleKey: Record<string, string> = {
    client: 'clients',
    project: 'projects',
    prospect: 'prospects',
    task: 'tasks',
    invoice: 'revenue',
    expense: 'expenses',
  }

  const visibleContexts = useMemo(() => {
    if (allowedModules.includes('admin')) return CONTEXTS
    return CONTEXTS.filter(c => {
      if (c.value === 'all') return true
      const modKey = contextToModuleKey[c.value]
      return allowedModules.includes(modKey)
    })
  }, [allowedModules])

  return (
    <div className="flex h-[calc(100vh-64px)] gap-0 -m-6">
      {/* ── Left Sidebar ── */}
      <aside className="w-52 shrink-0 border border-border bg-bg-secondary flex flex-col gap-1 py-5 px-3 overflow-y-auto rounded-xl ml-4 mt-4 mb-3">
        <div className="px-2 mb-3">
          <h2 className="text-xs font-semibold text-text-muted uppercase tracking-widest">Browse</h2>
        </div>

        {visibleContexts.map(ctx => (
          <button
            key={ctx.value}
            onClick={() => setActiveContext(ctx.value)}
            className={cn(
              'flex items-center gap-2.5 h-9 px-3 rounded-lg text-sm font-medium transition-all w-full text-left',
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
      <div className="flex-1 flex flex-col overflow-hidden mb-3">

        {/* Top bar */}
        <div className="flex items-center justify-between gap-3 px-6 py-4 border-b border-border shrink-0 bg-bg">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-text-secondary">Category:</span>
            <div className="relative">
              <select
                value={activeCategory}
                onChange={(e) => setActiveCategory(e.target.value as any)}
                className="appearance-none pl-3 pr-8 py-2 bg-bg-secondary border border-border rounded-lg text-sm text-text focus:outline-none focus:border-primary/50 transition-all cursor-pointer"
              >
                {CATEGORIES.map(cat => (
                  <option key={cat.value} value={cat.value}>{cat.label}</option>
                ))}
              </select>
              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative w-64">
              <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search files..."
                className="w-full pl-9 pr-8 py-2 bg-bg-secondary border border-border rounded-lg text-sm text-text placeholder:text-text-muted focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all"
              />
              {search && (
                <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text">
                  <X size={13} />
                </button>
              )}
            </div>


            {/* Grid / List toggle */}
            <div className="flex items-center border border-border rounded-lg overflow-hidden shrink-0">
              {(['grid', 'list'] as const).map(v => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className={cn(
                    'p-2 transition-all',
                    view === v ? 'bg-primary text-primary-foreground' : 'text-text-secondary hover:text-text hover:bg-bg-secondary'
                  )}
                >
                  {v === 'grid' ? <Grid3X3 size={15} /> : <List size={15} />}
                </button>
              ))}
            </div>

            <button
              onClick={() => refetch()}
              className="p-2 rounded-lg border border-border text-text-secondary hover:text-text hover:bg-bg-secondary transition-all shrink-0"
              title="Refresh"
            >
              <RefreshCw size={15} className={cn(isFetching && "animate-spin")} />
            </button>

            <Button onClick={() => setUploadOpen(true)} className="gap-2 shrink-0">
              <Upload size={14} />
              Upload File
            </Button>
          </div>
        </div>

        {/* File Grid / List */}
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
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-4 py-20">
              <div className="w-16 h-16 rounded-2xl bg-bg-secondary border border-border flex items-center justify-center">
                <FolderOpen size={28} className="text-text-muted" />
              </div>
              <div className="text-center">
                <p className="text-base font-semibold text-text">No files found</p>
                <p className="text-sm text-text-muted mt-1">
                  {search ? `No results for "${search}"` : 'Upload your first file to get started'}
                </p>
              </div>
              {!search && (
                <Button onClick={() => setUploadOpen(true)} className="gap-2">
                  <Upload size={14} />
                  Upload File
                </Button>
              )}
            </div>
          ) : (
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
                  />
                ))}
              </AnimatePresence>
            </motion.div>
          )}
        </div>
      </div>

      {/* ── Modals ── */}
      <FileUploadModal
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        clients={clients}
        projects={projects}
        onSuccess={onUploaded}
        currentUserId={currentUserId}
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
          onShared={() => {
            qc.invalidateQueries({ queryKey: ['files'] })
            refetch()
          }}
        />
      )}

      {versionsFile && (
        <FileVersionsModal
          file={versionsFile}
          onClose={() => setVersionsFile(null)}
        />
      )}
    </div>
  )
}
