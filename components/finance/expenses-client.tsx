'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Plus, Search, Wallet, Trash2, Loader2 } from 'lucide-react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getExpenses, addExpense, updateExpense, deleteExpense } from '@/app/actions/finance'
import { useSession } from 'next-auth/react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { X } from 'lucide-react'
import { AnimatePresence } from 'framer-motion'
import { useEffect } from 'react'
import { toast } from 'sonner'
import type { Expense, Project } from '@/types'
import { Button } from '@/components/ui/button'
import StatCard from '@/components/ui/stat-card'
import { formatDate, formatCurrency } from '@/lib/utils'
import { Wallet as WalletIcon, UploadCloud, FileText, ExternalLink } from 'lucide-react'
import { parseISO, startOfDay, isSameDay, isSameWeek, isSameMonth, isSameQuarter, isSameYear } from 'date-fns'
import ExportDropdown from '@/components/ui/export-dropdown'
import DateFilterDropdown, { DateFilterValue } from '@/components/ui/date-filter-dropdown'
import { TablePagination } from '@/components/ui/table-pagination'

const EXPENSE_TYPES = ['freelancer', 'designer', 'developer', 'advertising', 'travel', 'software', 'hosting', 'miscellaneous']
const EXPENSE_LABELS: Record<string, string> = {
  freelancer: 'Freelancer', designer: 'Designer', developer: 'Developer',
  advertising: 'Advertising', travel: 'Travel', software: 'Software',
  hosting: 'Hosting', miscellaneous: 'Miscellaneous',
}

const schema = z.object({
  project_id: z.string().optional(),
  expense_type: z.enum(['freelancer', 'designer', 'developer', 'advertising', 'travel', 'software', 'hosting', 'miscellaneous']),
  description: z.string().optional(),
  amount: z.coerce.number().min(0.01, 'Required'),
  date: z.string().min(1, 'Required'),
})

type FormInput = z.input<typeof schema>
type FormData = z.output<typeof schema>

interface ExpensesClientProps {
  initialExpenses: Expense[]
  projects: Pick<Project, 'id' | 'name' | 'project_code'>[]
}

export default function ExpensesClient({ initialExpenses, projects }: ExpensesClientProps) {
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [dateFilter, setDateFilter] = useState<DateFilterValue>('all')
  const [customDateStart, setCustomDateStart] = useState<Date | null>(null)
  const [customDateEnd, setCustomDateEnd] = useState<Date | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [files, setFiles] = useState<File[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const qc = useQueryClient()

  const { data: expenses } = useQuery({
    queryKey: ['expenses'],
    queryFn: async () => {
      const data = await getExpenses()
      return data as unknown as Expense[]
    },
    initialData: initialExpenses,
  })

  const exp = expenses ?? []
  const total = exp.reduce((s, e) => s + e.amount, 0)
  const thisMonth = exp.filter(e => {
    const d = new Date(e.date)
    const now = new Date()
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
  }).reduce((s, e) => s + e.amount, 0)

  const filtered = exp.filter(e => {
    const matchSearch = (e.description ?? '').toLowerCase().includes(search.toLowerCase()) ||
      (e.project?.name ?? '').toLowerCase().includes(search.toLowerCase())
    const matchType = typeFilter === 'all' || e.expense_type === typeFilter

    let matchDate = true
    if (dateFilter !== 'all' && e.date) {
      const expected = startOfDay(new Date(e.date))
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
    } else if (dateFilter !== 'all' && !e.date) {
      matchDate = false
    }

    return matchSearch && matchType && matchDate
  })

  const exportHeaders = ['Date', 'Type', 'Description', 'Project', 'Amount']
  const mapExportData = (e: Expense) => [
    formatDate(e.date),
    EXPENSE_LABELS[e.expense_type] || e.expense_type,
    e.description || '—',
    e.project?.name || '—',
    e.amount
  ]

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const safePage = Math.min(page, totalPages)
  const paginated = filtered.slice((safePage - 1) * pageSize, safePage * pageSize)

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FormInput, undefined, FormData>({
    resolver: zodResolver(schema),
    defaultValues: { expense_type: 'miscellaneous', date: new Date().toISOString().split('T')[0], amount: 0 },
  })

  useEffect(() => {
    if (modalOpen) {
      reset(editingExpense ? {
        project_id: editingExpense.project_id ?? '',
        expense_type: editingExpense.expense_type,
        description: editingExpense.description ?? '',
        amount: editingExpense.amount,
        date: editingExpense.date ? new Date(editingExpense.date).toISOString().split('T')[0] : '',
      } : { expense_type: 'miscellaneous', date: new Date().toISOString().split('T')[0], amount: 0, project_id: '', description: '' })
      setConfirmDelete(false)
    }
  }, [modalOpen, editingExpense, reset])

  const handleDelete = async () => {
    if (!editingExpense) return
    if (!confirmDelete) {
      setConfirmDelete(true)
      return
    }

    setIsDeleting(true)
    try {
      const result = await deleteExpense(editingExpense.id)
      if (!result.success) {
        toast.error(result.error || 'Failed to delete expense')
        return
      }
      toast.success('Expense deleted successfully')
      qc.invalidateQueries({ queryKey: ['expenses'] })
      setModalOpen(false)
    } catch (err: any) {
      toast.error(err.message || 'An unexpected error occurred.')
    } finally {
      setIsDeleting(false)
      setConfirmDelete(false)
    }
  }

  const handleClose = () => {
    setConfirmDelete(false)
    setModalOpen(false)
    setFiles([])
  }

  const { data: session } = useSession()

  const onSubmit = async (data: FormData) => {
    setIsUploading(true)

    try {
      const formData = new window.FormData()
      formData.append('expense_type', data.expense_type)
      formData.append('amount', data.amount.toString())
      formData.append('date', data.date)
      if (data.project_id) formData.append('project_id', data.project_id)
      if (data.description) formData.append('description', data.description)
      if (session?.user?.id) formData.append('created_by', session.user.id)
      files.forEach(f => formData.append('files', f))

      if (editingExpense) {
        await updateExpense(editingExpense.id, formData)
        toast.success('Expense updated')
      } else {
        await addExpense(formData)
        toast.success('Expense added')
      }

      qc.invalidateQueries({ queryKey: ['expenses'] })
      setModalOpen(false)
      reset()
      setFiles([])
    } catch (err: any) {
      toast.error(editingExpense ? 'Failed to update expense' : 'Failed to add expense')
      console.error(err)
    } finally {
      setIsUploading(false)
    }
  }

  const inputClass = "w-full px-3 py-2 bg-bg border border-border rounded-lg text-sm text-text placeholder:text-text-muted focus:outline-none focus:border-primary/50 transition-all"

  return (
    <div className="flex flex-col h-full gap-4">
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h2 className="text-xl font-bold text-text">Expenses</h2>
          <p className="text-sm text-text-secondary mt-0.5">{exp.length} total records</p>
        </div>
        <Button onClick={() => { setEditingExpense(null); setModalOpen(true) }}><Plus size={15} /> Add Expense</Button>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 shrink-0">
        <StatCard title="Total Expenses" value={formatCurrency(total)} icon={WalletIcon} iconColor="bg-danger/10 text-danger" />
        <StatCard title="This Month" value={formatCurrency(thisMonth)} icon={WalletIcon} iconColor="bg-warning/10 text-warning" />
      </div>

      <div className="flex flex-wrap gap-3 items-center justify-between shrink-0">
        <div className="flex gap-3 flex-wrap">
          {['all', ...EXPENSE_TYPES].map(t => (
            <button key={t} onClick={() => { setTypeFilter(t); setPage(1) }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${typeFilter === t ? 'bg-primary text-white' : 'bg-bg-secondary border border-border text-text-secondary hover:text-text'}`}>
              {t === 'all' ? 'All' : EXPENSE_LABELS[t]}
            </button>
          ))}
        </div>
        
        <div className="flex gap-3 items-center">
          <DateFilterDropdown
            value={dateFilter}
            onChange={v => { setDateFilter(v); setPage(1) }}
            onCustomDateChange={(start, end) => {
              setCustomDateStart(start); setCustomDateEnd(end); setDateFilter('custom'); setPage(1)
            }} 
          />
          <ExportDropdown 
            data={filtered} 
            headers={exportHeaders} 
            filename={`expenses_export_${new Date().toISOString().split('T')[0]}`} 
            mapData={mapExportData} 
          />
        </div>
      </div>

      <div className="flex flex-col flex-1 min-h-0 rounded-xl border border-border overflow-hidden">
        <div className="overflow-x-auto overflow-y-auto flex-1">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-bg-tertiary border-b border-border">
                {['Date', 'Type', 'Description', 'Project', 'Amount', 'Receipt'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-text-secondary uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paginated.map(e => (
                <tr key={e.id} onClick={() => { setEditingExpense(e); setModalOpen(true) }}
                  className="border-b border-border bg-bg-secondary hover:bg-bg-tertiary transition-colors cursor-pointer">
                  <td className="px-4 py-3 text-text-secondary">{formatDate(e.date)}</td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 rounded-md text-xs bg-bg-tertiary text-text-secondary">
                      {EXPENSE_LABELS[e.expense_type]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-text">{e.description || '—'}</td>
                  <td className="px-4 py-3 text-text-secondary">{e.project?.name || '—'}</td>
                  <td className="px-4 py-3 font-medium text-danger">{formatCurrency(e.amount)}</td>
                  <td className="px-4 py-3">
                    {e.bill_urls && e.bill_urls.length > 0 ? (
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {e.bill_urls.map((url, i) => (
                          <a key={i} href={url} target="_blank" className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline bg-primary/10 px-2 py-1 rounded-md transition-colors">
                            <ExternalLink size={12} /> View {e.bill_urls!.length > 1 ? i + 1 : ''}
                          </a>
                        ))}
                      </div>
                    ) : (
                      <span className="text-xs text-text-muted">—</span>
                    )}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-12 text-center text-text-muted text-sm">No expenses found</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <TablePagination
          page={safePage}
          pageSize={pageSize}
          total={filtered.length}
          onPageChange={setPage}
          onPageSizeChange={s => { setPageSize(s); setPage(1) }}
          itemLabel="expenses"
        />
      </div>

      <AnimatePresence>
        {modalOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={handleClose} className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 !m-0" />
            <motion.div
              initial={{ opacity: 0, x: 'calc(100% + 1rem)' }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 'calc(100% + 1rem)' }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              className="fixed right-4 top-4 bottom-4 w-[calc(100%-2rem)] max-w-md bg-bg-secondary border border-border rounded-2xl z-50 flex flex-col shadow-2xl overflow-hidden !m-0"
            >
              <div className="flex items-center justify-between px-6 py-4 border-b border-border">
                <h3 className="font-semibold text-text">{editingExpense ? 'Edit Expense' : 'Add Expense'}</h3>
                <button onClick={handleClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-text-muted hover:text-text hover:bg-bg-tertiary transition-all"><X size={16} /></button>
              </div>
              <form onSubmit={handleSubmit(onSubmit)} className="flex-1 p-6 space-y-4 overflow-y-auto">
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1.5">Expense Type</label>
                  <select {...register('expense_type')} className={inputClass}>
                    {EXPENSE_TYPES.map(t => <option key={t} value={t}>{EXPENSE_LABELS[t]}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1.5">Amount (₹) *</label>
                  <input {...register('amount')} type="number" min="0" step="0.01" placeholder="5000" className={inputClass} />
                  {errors.amount && <p className="text-xs text-danger mt-1">{errors.amount.message}</p>}
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1.5">Date *</label>
                  <input {...register('date')} type="date" className={inputClass} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1.5">Project (optional)</label>
                  <select {...register('project_id')} className={inputClass}>
                    <option value="">No project</option>
                    {projects.map(p => <option key={p.id} value={p.id}>{p.project_code} — {p.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1.5">Description</label>
                  <textarea {...register('description')} placeholder="e.g. Freelancer payment for landing page" rows={3}
                    className="w-full px-3 py-2 bg-bg border border-border rounded-lg text-sm text-text placeholder:text-text-muted focus:outline-none focus:border-primary/50 transition-all resize-none" />
                </div>
                <div className="pt-2">
                  <label className="block text-xs font-medium text-text-secondary mb-1.5">Receipts / Attachments (Optional)</label>
                  
                  {files.length > 0 && (
                    <div className="space-y-2 mb-3">
                      {files.map((f, idx) => (
                        <div key={idx} className="p-3 bg-bg border border-border rounded-lg flex items-center justify-between">
                          <div className="flex items-center gap-2 overflow-hidden">
                            <FileText size={16} className="text-primary shrink-0" />
                            <span className="text-sm text-text truncate">{f.name}</span>
                          </div>
                          <button 
                            type="button" 
                            onClick={() => setFiles(files.filter((_, i) => i !== idx))}
                            className="text-text-muted hover:text-danger"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {files.length > 0 ? (
                    <div className="relative group cursor-pointer inline-flex items-center justify-center gap-2 px-4 py-2 mt-1 bg-bg-secondary border border-border rounded-lg hover:bg-bg-tertiary transition-colors text-sm font-medium text-text">
                      <input 
                        type="file" 
                        multiple
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                          if (e.target.files && e.target.files.length > 0) {
                            setFiles(prev => [...prev, ...Array.from(e.target.files || [])])
                          }
                        }}
                      />
                      <Plus size={16} className="text-text-muted" /> Add more files
                    </div>
                  ) : (
                    <div className="relative border border-dashed border-[#A3A3A3] dark:border-[#333333] rounded-xl p-4 flex flex-col items-center justify-center text-center hover:border-primary/50 transition-colors bg-bg/50">
                      <input 
                        type="file" 
                        multiple
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                          if (e.target.files && e.target.files.length > 0) {
                            setFiles(prev => [...prev, ...Array.from(e.target.files || [])])
                          }
                        }}
                      />
                      <div className="w-10 h-10 rounded-full bg-bg border border-border flex items-center justify-center mb-2 shadow-sm group-hover:scale-105 transition-transform text-text-muted">
                        <UploadCloud size={18} />
                      </div>
                      <p className="text-sm font-medium text-text">
                        Click or drag files to upload
                      </p>
                    </div>
                  )}
                </div>
              </form>
              <div className="flex items-center justify-between px-6 py-4 border-t border-border">
                <div>
                  {editingExpense && (
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={handleDelete}
                      loading={isDeleting}
                      className="text-danger hover:text-danger hover:bg-danger/10 flex items-center gap-1.5 px-3 py-1.5 h-auto text-xs font-semibold"
                    >
                      {!isDeleting && <Trash2 size={14} />}
                      <span>{confirmDelete ? 'Confirm Delete?' : 'Delete Expense'}</span>
                    </Button>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <Button variant="secondary" onClick={handleClose} disabled={isSubmitting || isUploading || isDeleting} className="text-xs h-8 px-3">Cancel</Button>
                  <Button onClick={handleSubmit(onSubmit)} loading={isSubmitting || isUploading} disabled={isDeleting} className="text-xs h-8 px-3">
                    {isSubmitting || isUploading ? 'Saving...' : (editingExpense ? 'Save Changes' : 'Add Expense')}
                  </Button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
