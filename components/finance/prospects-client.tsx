'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Search, Trash2, Loader2, Users, FileText, CheckCircle2, TrendingUp, X } from 'lucide-react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import StatCard from '@/components/ui/stat-card'
import { formatDate } from '@/lib/utils'
import { TablePagination } from '@/components/ui/table-pagination'
import { getProspects, createProspect, updateProspect, deleteProspect } from '@/app/actions/prospects'
import type { Prospect } from '@/types'

interface ProspectsClientProps {
  initialProspects: Prospect[]
}


const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email address'),
  mobile: z.string().optional(),
  company_name: z.string().optional(),
  proposal_submitted: z.boolean().default(false),
  proposal_submission_date: z.string().optional(),
  client_converted: z.boolean().default(false),
})

type FormInput = z.input<typeof schema>
type FormData = z.output<typeof schema>

export default function ProspectsClient({ initialProspects }: ProspectsClientProps) {
  const [search, setSearch] = useState('')
  const [proposalFilter, setProposalFilter] = useState('all') // all, yes, no
  const [convertedFilter, setConvertedFilter] = useState('all') // all, yes, no
  const [modalOpen, setModalOpen] = useState(false)
  const [editingProspect, setEditingProspect] = useState<Prospect | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const qc = useQueryClient()

  const { data: prospects } = useQuery({
    queryKey: ['prospects'],
    queryFn: async () => {
      const data = await getProspects()
      return data as unknown as Prospect[]
    },
    initialData: initialProspects,
  })

  const list = prospects ?? []
  const totalProspects = list.length
  const proposalsSubmitted = list.filter(p => p.proposal_submitted).length
  const clientsConverted = list.filter(p => p.client_converted).length
  const conversionRate = totalProspects > 0 ? Math.round((clientsConverted / totalProspects) * 100) : 0

  const filtered = list.filter(p => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.email.toLowerCase().includes(search.toLowerCase()) ||
      (p.company_name ?? '').toLowerCase().includes(search.toLowerCase())
    
    let matchProposal = true
    if (proposalFilter === 'yes') matchProposal = p.proposal_submitted
    if (proposalFilter === 'no') matchProposal = !p.proposal_submitted

    let matchConverted = true
    if (convertedFilter === 'yes') matchConverted = p.client_converted
    if (convertedFilter === 'no') matchConverted = !p.client_converted

    return matchSearch && matchProposal && matchConverted
  })

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const safePage = Math.min(page, totalPages)
  const paginated = filtered.slice((safePage - 1) * pageSize, safePage * pageSize)

  const { register, handleSubmit, reset, watch, setValue, formState: { errors, isSubmitting } } = useForm<FormInput, undefined, FormData>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', email: '', mobile: '', company_name: '', proposal_submitted: false, client_converted: false },
  })

  const proposalSubmittedVal = watch('proposal_submitted')

  // Auto-set date if proposal_submitted is turned on and date is empty
  useEffect(() => {
    if (proposalSubmittedVal && !watch('proposal_submission_date')) {
      setValue('proposal_submission_date', new Date().toISOString().split('T')[0])
    }
  }, [proposalSubmittedVal, setValue, watch])

  useEffect(() => {
    if (modalOpen) {
      reset(editingProspect ? {
        name: editingProspect.name,
        email: editingProspect.email,
        mobile: editingProspect.mobile ?? '',
        company_name: editingProspect.company_name ?? '',
        proposal_submitted: editingProspect.proposal_submitted,
        proposal_submission_date: editingProspect.proposal_submission_date ? new Date(editingProspect.proposal_submission_date).toISOString().split('T')[0] : '',
        client_converted: editingProspect.client_converted,
      } : { name: '', email: '', mobile: '', company_name: '', proposal_submitted: false, proposal_submission_date: '', client_converted: false })
      setConfirmDelete(false)
    }
  }, [modalOpen, editingProspect, reset])

  const onSubmit = async (data: FormData) => {
    const payload = {
      ...data,
      mobile: data.mobile || null,
      company_name: data.company_name || null,
      proposal_submission_date: data.proposal_submitted && data.proposal_submission_date ? new Date(data.proposal_submission_date).toISOString() : null,
    }

    try {
      if (editingProspect) {
        await updateProspect(editingProspect.id, payload)
        toast.success('Prospect updated')
      } else {
        await createProspect(payload)
        toast.success('Prospect added')
      }
      qc.invalidateQueries({ queryKey: ['prospects'] })
      setModalOpen(false)
      reset()
    } catch (err: any) {
      toast.error('An error occurred. Please try again.')
      console.error(err)
    }
  }

  const handleDelete = async () => {
    if (!editingProspect) return
    if (!confirmDelete) {
      setConfirmDelete(true)
      return
    }

    setIsDeleting(true)
    try {
      const result = await deleteProspect(editingProspect.id)
      if (!result.success) {
        toast.error(result.error || 'Failed to delete prospect')
        return
      }
      toast.success('Prospect deleted successfully')
      qc.invalidateQueries({ queryKey: ['prospects'] })
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
  }

  const inputClass = "w-full px-3 py-2 bg-bg border border-border rounded-lg text-sm text-text placeholder:text-text-muted focus:outline-none focus:border-primary/50 transition-all"

  return (
    <div className="flex flex-col h-full gap-4">
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h2 className="text-xl font-bold text-text">Prospects</h2>
          <p className="text-sm text-text-secondary mt-0.5">{totalProspects} total prospects</p>
        </div>
        <Button onClick={() => { setEditingProspect(null); setModalOpen(true) }}><Plus size={15} /> Add Prospect</Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 shrink-0">
        <StatCard title="Total Prospects" value={String(totalProspects)} icon={Users} iconColor="bg-primary/10 text-primary" />
        <StatCard title="Proposals Submitted" value={String(proposalsSubmitted)} icon={FileText} iconColor="bg-info/10 text-info" />
        <StatCard title="Converted Clients" value={String(clientsConverted)} icon={CheckCircle2} iconColor="bg-success/10 text-success" />
        <StatCard title="Conversion Rate" value={`${conversionRate}%`} icon={TrendingUp} iconColor="bg-accent-cyan/10 text-accent-cyan" />
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 justify-between items-center shrink-0">
        <div className="flex gap-3 w-full sm:w-auto flex-1">
          <div className="relative flex-1 max-w-sm">
            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
            <input value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} placeholder="Search prospects..."
              className="w-full pl-9 pr-4 py-2 bg-bg-secondary border border-border rounded-lg text-sm text-text placeholder:text-text-muted focus:outline-none focus:border-primary/50 transition-all" />
          </div>
          <div className="flex items-center gap-2 overflow-x-auto">
            <select value={proposalFilter} onChange={e => { setProposalFilter(e.target.value); setPage(1) }}
              className="px-3 py-1.5 bg-bg-secondary border border-border rounded-lg text-xs font-medium text-text-secondary focus:outline-none">
              <option value="all">All Proposals</option>
              <option value="yes">Proposal Submitted</option>
              <option value="no">Proposal Not Submitted</option>
            </select>
            <select value={convertedFilter} onChange={e => { setConvertedFilter(e.target.value); setPage(1) }}
              className="px-3 py-1.5 bg-bg-secondary border border-border rounded-lg text-xs font-medium text-text-secondary focus:outline-none">
              <option value="all">All Status</option>
              <option value="yes">Converted</option>
              <option value="no">Not Converted</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center flex-1">
          <Users size={36} className="text-text-muted mb-3" />
          <p className="text-text-secondary font-medium">No prospects found</p>
        </div>
      ) : (
        <div className="flex flex-col flex-1 min-h-0 rounded-xl border border-border overflow-hidden">
          <div className="overflow-x-auto overflow-y-auto flex-1">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-bg-tertiary border-b border-border">
                  {['Name', 'Email / Phone', 'Company Name', 'Proposal Status', 'Proposal Date', 'Conversion Status'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-text-secondary uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paginated.map(p => (
                  <tr key={p.id} onClick={() => { setEditingProspect(p); setModalOpen(true) }}
                    className="border-b border-border bg-bg-secondary hover:bg-bg-tertiary transition-colors cursor-pointer">
                    <td className="px-4 py-3">
                      <p className="font-medium text-text">{p.name}</p>
                    </td>
                    <td className="px-4 py-3 text-text-secondary">
                      <div>
                        <p>{p.email}</p>
                        {p.mobile && <p className="text-xs text-text-muted">{p.mobile}</p>}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-text-secondary">{p.company_name || '—'}</td>
                    <td className="px-4 py-3">
                      <Badge variant={p.proposal_submitted ? 'info' : 'muted'}>
                        {p.proposal_submitted ? 'Submitted' : 'Pending'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-text-secondary">
                      {p.proposal_submission_date ? formatDate(p.proposal_submission_date) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={p.client_converted ? 'success' : 'danger'}>
                        {p.client_converted ? 'Converted' : 'Not Converted'}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <TablePagination
            page={safePage}
            pageSize={pageSize}
            total={filtered.length}
            onPageChange={setPage}
            onPageSizeChange={s => { setPageSize(s); setPage(1) }}
            itemLabel="prospects"
          />
        </div>
      )}

      {/* Modal */}
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
                <h3 className="font-semibold text-text">{editingProspect ? 'Edit Prospect' : 'Add Prospect'}</h3>
                <button onClick={handleClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-text-muted hover:text-text hover:bg-bg-tertiary transition-all"><X size={16} /></button>
              </div>
              <form onSubmit={handleSubmit(onSubmit)} className="flex-1 p-6 space-y-4 overflow-y-auto">
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1.5">Name *</label>
                  <input {...register('name')} placeholder="John Doe" className={inputClass} />
                  {errors.name && <p className="text-xs text-danger mt-1">{errors.name.message}</p>}
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1.5">Email *</label>
                  <input {...register('email')} type="email" placeholder="john@example.com" className={inputClass} />
                  {errors.email && <p className="text-xs text-danger mt-1">{errors.email.message}</p>}
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1.5">Mobile Number</label>
                  <input {...register('mobile')} placeholder="+91 9876543210" className={inputClass} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1.5">Company Name</label>
                  <input {...register('company_name')} placeholder="Acme Corp" className={inputClass} />
                </div>
                <div className="flex items-center justify-between p-3 bg-bg border border-border rounded-lg">
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-text">Proposal Submitted</span>
                    <span className="text-xs text-text-muted">Has a proposal been sent to this prospect?</span>
                  </div>
                  <input {...register('proposal_submitted')} type="checkbox" className="w-4 h-4 rounded border-border text-primary focus:ring-primary/20" />
                </div>

                {proposalSubmittedVal && (
                  <div>
                    <label className="block text-xs font-medium text-text-secondary mb-1.5">Proposal Submission Date</label>
                    <input {...register('proposal_submission_date')} type="date" className={inputClass} />
                  </div>
                )}

                <div className="flex items-center justify-between p-3 bg-bg border border-border rounded-lg">
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-text">Client Converted</span>
                    <span className="text-xs text-text-muted">Has this prospect converted into a client?</span>
                  </div>
                  <input {...register('client_converted')} type="checkbox" className="w-4 h-4 rounded border-border text-primary focus:ring-primary/20" />
                </div>
              </form>
              <div className="flex items-center justify-between px-6 py-4 border-t border-border">
                <div>
                  {editingProspect && (
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={handleDelete}
                      loading={isDeleting}
                      className="text-danger hover:text-danger hover:bg-danger/10 flex items-center gap-1.5 px-3 py-1.5 h-auto text-xs font-semibold"
                    >
                      {!isDeleting && <Trash2 size={14} />}
                      <span>{confirmDelete ? 'Confirm Delete?' : 'Delete Prospect'}</span>
                    </Button>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <Button variant="secondary" onClick={handleClose} disabled={isSubmitting || isDeleting} className="text-xs h-8 px-3">Cancel</Button>
                  <Button onClick={handleSubmit(onSubmit)} loading={isSubmitting} disabled={isDeleting} className="text-xs h-8 px-3">
                    {isSubmitting ? 'Saving...' : (editingProspect ? 'Save Changes' : 'Add Prospect')}
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
