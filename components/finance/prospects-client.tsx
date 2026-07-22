'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Search, Trash2, Loader2, Users, FileText, CheckCircle2, TrendingUp, X, ChevronDown, Check, UploadCloud, Paperclip } from 'lucide-react'
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
import ContextFilePanel from '@/components/files/context-file-panel'
import { getProspects, createProspect, updateProspect, deleteProspect } from '@/app/actions/prospects'
import { createClient, checkClientExists } from '@/app/actions/clients'
import { getServices } from '@/app/actions/services'
import { uploadMultipleFilesAction } from '@/app/actions/upload'
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
  quote_submitted: z.coerce.number().optional(),
  client_converted: z.boolean().default(false),
  comments: z.string().optional(),
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

  const [files, setFiles] = useState<File[]>([])
  const [existingUrls, setExistingUrls] = useState<string[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [selectedServices, setSelectedServices] = useState<string[]>([])
  const [serviceDropdownOpen, setServiceDropdownOpen] = useState(false)

  const { data: services = [] } = useQuery({
    queryKey: ['services'],
    queryFn: getServices
  })

  const { data: prospectsData, isLoading } = useQuery({
    queryKey: ['prospects'],
    queryFn: async () => {
      const data = await getProspects()
      return data as unknown as Prospect[]
    }
  })

  const list = prospectsData ?? initialProspects
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
      setFiles([])
      setExistingUrls(editingProspect?.document_urls || [])
      setSelectedServices(editingProspect?.services || [])
      reset(editingProspect ? {
        name: editingProspect.name,
        email: editingProspect.email,
        mobile: editingProspect.mobile ?? '',
        company_name: editingProspect.company_name ?? '',
        proposal_submitted: editingProspect.proposal_submitted,
        proposal_submission_date: editingProspect.proposal_submission_date ? new Date(editingProspect.proposal_submission_date).toISOString().split('T')[0] : '',
        quote_submitted: (editingProspect as any).quote_submitted ?? undefined,
        client_converted: editingProspect.client_converted,
        comments: editingProspect.comments ?? '',
      } : { name: '', email: '', mobile: '', company_name: '', proposal_submitted: false, proposal_submission_date: '', client_converted: false, quote_submitted: undefined, comments: '' })
      setConfirmDelete(false)
    }
  }, [modalOpen, editingProspect, reset])

  const onSubmit = async (data: FormData) => {
    setIsUploading(true)
    try {
      let uploadedUrls: string[] = []

      if (files.length > 0) {
        const formData = new window.FormData()
        files.forEach(f => formData.append('files', f))
        formData.append('folder', 'prospects')

        const uploadResult = await uploadMultipleFilesAction(formData)
        if (!uploadResult.success) {
          toast.error('Failed to upload prospect documents')
          console.error(uploadResult.error)
        } else {
          uploadedUrls = uploadResult.urls || []
        }
      }

      const payload = {
        ...data,
        mobile: data.mobile || null,
        company_name: data.company_name || null,
        proposal_submission_date: data.proposal_submitted && data.proposal_submission_date ? new Date(data.proposal_submission_date).toISOString() : null,
        quote_submitted: data.proposal_submitted && data.quote_submitted ? Number(data.quote_submitted) : null,
        services: selectedServices,
        comments: data.comments || null,
        document_urls: [...existingUrls, ...uploadedUrls]
      }

      // Detect if conversion just happened (was false, now true)
      const wasConverted = editingProspect?.client_converted ?? false
      const isNowConverted = data.client_converted
      const justConverted = !wasConverted && isNowConverted

      if (editingProspect) {
        await updateProspect(editingProspect.id, payload)
        toast.success('Prospect updated')
      } else {
        await createProspect(payload)
        toast.success('Prospect added')
      }

      // Auto-create client on first conversion
      if (justConverted) {
        // Check if a client with this email already exists
        const emailToCheck = data.email
        const { exists, client: existingClient } = emailToCheck
          ? await checkClientExists(emailToCheck)
          : { exists: false, client: null }

        if (exists) {
          toast.info(`${existingClient?.name || data.name} already exists in Clients`)
        } else {
          const clientResult = await createClient({
            name: data.name,
            email: data.email || null,
            mobile: data.mobile || null,
            company_name: data.company_name || null,
            contact_person: data.name,
          })
          if (clientResult.success) {
            qc.invalidateQueries({ queryKey: ['clients'] })
            toast.success(`${data.name} converted to Client`)
          } else {
            toast.error('Prospect converted but failed to create client: ' + clientResult.error)
          }
        }
      }

      qc.invalidateQueries({ queryKey: ['prospects'] })
      setModalOpen(false)
      reset()
    } catch (err: any) {
      toast.error('An error occurred. Please try again.')
      console.error(err)
    } finally {
      setIsUploading(false)
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
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 shrink-0 animate-pulse">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-24 bg-bg-secondary rounded-xl"></div>)}
        </div>
      ) : (
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 shrink-0">
          <StatCard title="Total Prospects" value={String(totalProspects)} icon={Users} iconColor="bg-primary/10 text-primary" />
          <StatCard title="Proposals Submitted" value={String(proposalsSubmitted)} icon={FileText} iconColor="bg-info/10 text-info" />
          <StatCard title="Converted Clients" value={String(clientsConverted)} icon={CheckCircle2} iconColor="bg-success/10 text-success" />
          <StatCard title="Conversion Rate" value={`${conversionRate}%`} icon={TrendingUp} iconColor="bg-accent-cyan/10 text-accent-cyan" />
        </div>
      )}

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
      {isLoading ? (
        <div className="flex flex-col flex-1 min-h-[400px] bg-bg-secondary border border-border rounded-xl shadow-sm overflow-hidden animate-pulse">
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center flex-1">
          <Users size={36} className="text-text-muted mb-3" />
          <p className="text-text-secondary font-medium">No prospects found</p>
        </div>
      ) : (
        <div className="flex flex-col flex-1 min-h-0 rounded-xl border border-border overflow-hidden">
          <div className="overflow-x-auto overflow-y-auto flex-1">
            <table className="min-w-max w-full text-sm">
              <thead>
                <tr className="bg-bg-tertiary border-b border-border">
                  {['Name', 'Email / Phone', 'Company Name', 'Services', 'Proposal Status', 'Proposal Date', 'Comments', 'Conversion Status'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-text-secondary uppercase tracking-wider whitespace-nowrap">{h}</th>
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
                    <td className="px-4 py-3 text-text-secondary">
                      <div className="flex flex-wrap gap-1 max-w-[180px]">
                        {p.services && p.services.length > 0 ? (
                          p.services.map((s, idx) => (
                            <Badge key={idx} variant="muted" className="text-[10px] px-1 py-0.5 whitespace-nowrap">
                              {s}
                            </Badge>
                          ))
                        ) : (
                          <span className="text-text-muted">—</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={p.proposal_submitted ? 'info' : 'muted'}>
                        {p.proposal_submitted ? 'Submitted' : 'Pending'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-text-secondary">
                      {p.proposal_submission_date ? formatDate(p.proposal_submission_date) : '—'}
                    </td>
                    <td className="px-4 py-3 text-text-secondary max-w-[200px] truncate" title={p.comments || ''}>
                      {p.comments || <span className="text-text-muted">—</span>}
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

                {/* Services Dropdown (Multi Select) */}
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1.5">Services</label>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setServiceDropdownOpen(!serviceDropdownOpen)}
                      className="w-full flex items-center justify-between px-3 py-2 bg-bg border border-border rounded-lg text-sm text-text focus:outline-none focus:border-primary/50 transition-all text-left"
                    >
                      <span className="truncate">
                        {selectedServices.length === 0 ? (
                          <span className="text-text-muted">Select services...</span>
                        ) : (
                          selectedServices.join(', ')
                        )}
                      </span>
                      <ChevronDown size={14} className={`text-text-muted transition-transform shrink-0 ${serviceDropdownOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {serviceDropdownOpen && (
                      <>
                        <div className="fixed inset-0 z-10" onClick={() => setServiceDropdownOpen(false)} />
                        <div className="absolute left-0 right-0 mt-1 bg-bg-secondary border border-border rounded-lg shadow-xl max-h-48 overflow-y-auto z-20 p-1.5 space-y-0.5">
                          {services.length > 0 ? (
                            services.map(s => {
                              const isChecked = selectedServices.includes(s.name)
                              return (
                                <div
                                  key={s.id}
                                  onClick={() => {
                                    if (isChecked) {
                                      setSelectedServices(selectedServices.filter(item => item !== s.name))
                                    } else {
                                      setSelectedServices([...selectedServices, s.name])
                                    }
                                  }}
                                  className="flex items-center gap-2 px-2.5 py-1.5 rounded-md hover:bg-bg-tertiary cursor-pointer transition-colors text-xs text-text-secondary"
                                >
                                  <div className={`w-3.5 h-3.5 border rounded flex items-center justify-center transition-colors ${isChecked ? 'bg-primary border-primary text-white' : 'border-border'} shrink-0`}>
                                    {isChecked && <Check size={10} className="stroke-[3]" />}
                                  </div>
                                  <span className="truncate">{s.name}</span>
                                </div>
                              )
                            })
                          ) : (
                            <p className="text-xs text-text-muted p-2 text-center">No services found</p>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Comments / Remarks */}
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1.5">Comments / Remarks</label>
                  <textarea
                    {...register('comments')}
                    placeholder="Enter any comments or remarks..."
                    rows={3}
                    className="w-full px-3 py-2 bg-bg border border-border rounded-lg text-sm text-text placeholder:text-text-muted focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all resize-none"
                  />
                </div>

                <div className="flex items-center justify-between p-3 bg-bg border border-border rounded-lg">
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-text">Proposal Submitted</span>
                    <span className="text-xs text-text-muted">Has a proposal been sent to this prospect?</span>
                  </div>
                  <input {...register('proposal_submitted')} type="checkbox" className="w-4 h-4 rounded border-border text-primary focus:ring-primary/20" />
                </div>

                {proposalSubmittedVal && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-text-secondary mb-1.5">Proposal Date</label>
                      <input {...register('proposal_submission_date')} type="date" className={inputClass} />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-text-secondary mb-1.5">Quote Submitted (₹)</label>
                      <input {...register('quote_submitted')} type="number" step="0.01" placeholder="e.g. 50000" className={inputClass} />
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between p-3 bg-bg border border-border rounded-lg">
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-text">Client Converted</span>
                    <span className="text-xs text-text-muted">Has this prospect converted into a client?</span>
                  </div>
                  <input {...register('client_converted')} type="checkbox" className="w-4 h-4 rounded border-border text-primary focus:ring-primary/20" />
                </div>

                {/* Document Upload Area */}
                <div className="pt-2 border-t border-border mt-2">
                  <label className="block text-xs font-medium text-text-secondary mb-1.5">
                    Documents (Optional)
                  </label>

                  {existingUrls.length > 0 && (
                    <div className="space-y-2 mb-3">
                      {existingUrls.map((url, idx) => {
                        const urlParts = url.split('/')
                        const lastPart = urlParts[urlParts.length - 1]
                        const nameParts = lastPart.split('_')
                        const displayName = nameParts.length >= 3 ? nameParts.slice(2).join('_') : lastPart
                        return (
                          <div key={idx} className="p-3 bg-bg border border-border rounded-lg flex items-center justify-between">
                            <div className="flex items-center gap-2 overflow-hidden">
                              <FileText size={16} className="text-primary shrink-0" />
                              <span className="text-sm text-text truncate" title={displayName}>{displayName}</span>
                            </div>
                            <div className="flex items-center gap-3 shrink-0">
                              <a href={url} target="_blank" rel="noreferrer" className="text-xs font-medium text-primary hover:underline">View</a>
                              <button
                                type="button"
                                onClick={() => setExistingUrls(existingUrls.filter(u => u !== url))}
                                className="text-text-muted hover:text-danger"
                              >
                                <X size={14} />
                              </button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {files.length > 0 && (
                    <div className="space-y-2 mb-3">
                      {files.map((f, idx) => (
                        <div key={idx} className="p-3 bg-bg border border-border rounded-lg flex items-center justify-between">
                          <div className="flex items-center gap-2 overflow-hidden">
                            <FileText size={16} className="text-text-secondary shrink-0" />
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

                  {(existingUrls.length > 0 || files.length > 0) ? (
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
                      <p className="text-sm font-medium text-text">Click or drag files to upload</p>
                      <p className="text-[11px] text-text-muted mt-0.5">Upload pitch decks, proposal documents, etc.</p>
                    </div>
                  )}
                </div>

                {/* File Manager Panel — shown when editing an existing prospect */}
                {editingProspect && (
                  <div className="pt-4 border-t border-border mt-4">
                    <ContextFilePanel
                      contextId={editingProspect.id}
                      contextType="prospect"
                      defaultCategory="reference"
                    />
                  </div>
                )}
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
                  <Button variant="secondary" onClick={handleClose} disabled={isSubmitting || isDeleting || isUploading} className="text-xs h-8 px-3">Cancel</Button>
                  <Button onClick={handleSubmit(onSubmit)} loading={isSubmitting || isUploading} disabled={isDeleting} className="text-xs h-8 px-3">
                    {isSubmitting || isUploading ? 'Saving...' : (editingProspect ? 'Save Changes' : 'Add Prospect')}
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
