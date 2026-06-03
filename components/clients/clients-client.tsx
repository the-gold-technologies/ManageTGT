'use client'

import { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import {
  Plus, Search, Building2, Mail, Phone, Pencil, Trash2,
  FileText, ChevronLeft, ChevronRight
} from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { isSameDay, isSameWeek, isSameMonth, isSameQuarter, isSameYear, startOfDay } from 'date-fns'
import type { Client } from '@/types'
import { getClients, deleteClient as deleteClientAction } from '@/app/actions/clients'
import { Button } from '@/components/ui/button'
import { formatDate } from '@/lib/utils'
import { cn } from '@/lib/utils'
import ClientModal from './client-modal'
import { ConfirmModal } from '@/components/ui/confirm-modal'
import DateFilterDropdown, { DateFilterValue } from '@/components/ui/date-filter-dropdown'
import ExportDropdown from '@/components/ui/export-dropdown'

interface ClientsClientProps {
  initialClients: Client[]
}

const GST_FILTERS = [
  { label: 'All', value: 'all' },
  { label: 'Has GST', value: 'has_gst' },
  { label: 'No GST', value: 'no_gst' },
] as const
type GstFilter = typeof GST_FILTERS[number]['value']

const PAGE_SIZES = [10, 20, 50]

export default function ClientsClient({ initialClients }: ClientsClientProps) {
  const [search, setSearch] = useState('')
  const [gstFilter, setGstFilter] = useState<GstFilter>('all')
  const [dateFilter, setDateFilter] = useState<DateFilterValue>('all')
  const [customDateStart, setCustomDateStart] = useState<Date | null>(null)
  const [customDateEnd, setCustomDateEnd] = useState<Date | null>(null)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  const [modalOpen, setModalOpen] = useState(false)
  const [editingClient, setEditingClient] = useState<Client | null>(null)
  const [clientToDelete, setClientToDelete] = useState<Client | null>(null)
  const qc = useQueryClient()

  const { data: clients } = useQuery({
    queryKey: ['clients'],
    queryFn: async () => {
      const data = await getClients()
      return data as unknown as Client[]
    },
    initialData: initialClients,
  })

  const deleteClient = useMutation({
    mutationFn: async (id: string) => {
      const result = await deleteClientAction(id)
      if (!result.success) throw new Error(result.error)
    },
    onMutate: async (deletedId: string) => {
      await qc.cancelQueries({ queryKey: ['clients'] })
      const previous = qc.getQueryData<Client[]>(['clients'])
      qc.setQueryData<Client[]>(['clients'], old => (old ?? []).filter(c => c.id !== deletedId))
      return { previous }
    },
    onSuccess: () => toast.success('Client deleted'),
    onError: (err, _, context) => {
      if (context?.previous) qc.setQueryData(['clients'], context.previous)
      toast.error('Failed to delete client')
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['clients'] }),
  })

  // --- Filtering ---
  const filtered = useMemo(() => {
    const today = startOfDay(new Date())
    return (clients ?? []).filter(c => {
      const matchSearch =
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        (c.company_name ?? '').toLowerCase().includes(search.toLowerCase()) ||
        (c.email ?? '').toLowerCase().includes(search.toLowerCase()) ||
        (c.mobile ?? '').toLowerCase().includes(search.toLowerCase()) ||
        (c.contact_person ?? '').toLowerCase().includes(search.toLowerCase())

      const matchGst =
        gstFilter === 'all' ? true :
        gstFilter === 'has_gst' ? !!c.gst_number :
        !c.gst_number

      let matchDate = true
      if (dateFilter !== 'all' && c.createdAt) {
        const created = startOfDay(new Date(c.createdAt))
        if (dateFilter === 'today') matchDate = isSameDay(created, today)
        else if (dateFilter === 'this_week') matchDate = isSameWeek(created, today, { weekStartsOn: 1 })
        else if (dateFilter === 'this_month') matchDate = isSameMonth(created, today)
        else if (dateFilter === 'this_quarter') matchDate = isSameQuarter(created, today)
        else if (dateFilter === 'this_year') matchDate = isSameYear(created, today)
        else if (dateFilter === 'custom') {
          if (customDateStart && created < startOfDay(customDateStart)) matchDate = false
          if (customDateEnd && created > startOfDay(customDateEnd)) matchDate = false
        }
      }

      return matchSearch && matchGst && matchDate
    })
  }, [clients, search, gstFilter, dateFilter, customDateStart, customDateEnd])

  // reset page on filter/search change
  const handleSearch = (v: string) => { setSearch(v); setPage(1) }
  const handleGst = (v: GstFilter) => { setGstFilter(v); setPage(1) }
  const handleDate = (v: DateFilterValue) => { setDateFilter(v); setPage(1) }

  // --- Pagination ---
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const safePage = Math.min(page, totalPages)
  const paginated = filtered.slice((safePage - 1) * pageSize, safePage * pageSize)

  // Export helpers
  const exportHeaders = ['Name', 'Company', 'Contact Person', 'Email', 'Phone', 'GST', 'PAN', 'Added']
  const mapExportData = (c: Client) => [
    c.name, c.company_name || '', c.contact_person || '',
    c.email || '', c.mobile || '', c.gst_number || '', c.pan_number || '',
    new Date(c.createdAt).toLocaleDateString()
  ]

  const rowVariants = { hidden: { opacity: 0, y: 6 }, show: { opacity: 1, y: 0 } }

  return (
    <div className="flex flex-col h-full gap-4">
      {/* ── Page Header ──────────────────────────────────── */}
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h2 className="text-xl font-bold text-text">Clients</h2>
          <p className="text-sm text-text-secondary mt-0.5">{clients?.length ?? 0} total clients</p>
        </div>
        <Button onClick={() => { setEditingClient(null); setModalOpen(true) }}>
          <Plus size={15} /> Add Client
        </Button>
      </div>

      {/* ── Filter Bar (same pattern as Projects page) ─── */}
      <div className="flex flex-col sm:flex-row gap-3 shrink-0">
        {/* Search */}
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
          <input
            value={search}
            onChange={e => handleSearch(e.target.value)}
            placeholder="Search clients..."
            className="w-full pl-9 pr-4 py-2 bg-bg-secondary border border-border rounded-lg text-sm text-text placeholder:text-text-muted focus:outline-none focus:border-primary/50 transition-all"
          />
        </div>

        {/* GST filter pills */}
        <div className="flex items-center gap-2 overflow-x-auto flex-1">
          {GST_FILTERS.map(f => (
            <button
              key={f.value}
              onClick={() => handleGst(f.value)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all',
                gstFilter === f.value
                  ? 'bg-primary text-white'
                  : 'bg-bg-secondary border border-border text-text-secondary hover:text-text hover:border-border-muted'
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Date + Export */}
        <div className="flex items-center gap-2">
          <DateFilterDropdown
            value={dateFilter}
            onChange={handleDate}
            onCustomDateChange={(start, end) => {
              setCustomDateStart(start)
              setCustomDateEnd(end)
              setDateFilter('custom')
            }}
          />
          <ExportDropdown
            data={filtered}
            headers={exportHeaders}
            filename={`clients_export_${new Date().toISOString().split('T')[0]}`}
            mapData={mapExportData}
          />
        </div>
      </div>

      {/* ── Table Card ───────────────────────────────────── */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center flex-1">
          <Building2 size={36} className="text-text-muted mb-3" />
          <p className="text-text-secondary font-medium">No clients found</p>
          <p className="text-sm text-text-muted mt-1">
            {search || gstFilter !== 'all' || dateFilter !== 'all'
              ? 'Try different search or filter criteria'
              : 'Add your first client to get started'}
          </p>
        </div>
      ) : (
        <div className="flex flex-col flex-1 min-h-0 bg-bg-secondary border border-border rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto overflow-y-auto flex-1">
            <table className="w-full text-sm">
              <thead>
                {/* ← matches projects page exactly: bg-bg-tertiary, text-text-secondary */}
                <tr className="bg-bg-tertiary border-b border-border">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-text-secondary uppercase tracking-wider">#</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-text-secondary uppercase tracking-wider">Client</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-text-secondary uppercase tracking-wider">Contact Person</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-text-secondary uppercase tracking-wider">Email</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-text-secondary uppercase tracking-wider hidden md:table-cell">Phone</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-text-secondary uppercase tracking-wider hidden lg:table-cell">GST / PAN</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-text-secondary uppercase tracking-wider hidden xl:table-cell">Added</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-text-secondary uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <motion.tbody
                initial="hidden"
                animate="show"
                variants={{ show: { transition: { staggerChildren: 0.03 } } }}
                className="divide-y divide-border"
              >
                {paginated.map((client, idx) => (
                  <motion.tr
                    key={client.id}
                    variants={rowVariants}
                    transition={{ duration: 0.18 }}
                    className="group hover:bg-bg-tertiary/40 transition-colors"
                  >
                    {/* # */}
                    <td className="px-4 py-3">
                      <span className="text-xs text-text-muted">{(safePage - 1) * pageSize + idx + 1}</span>
                    </td>

                    {/* Client name + company */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0">
                          {client.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-text text-sm truncate">{client.name}</p>
                          {client.company_name && (
                            <p className="text-xs text-text-muted truncate flex items-center gap-1 mt-0.5">
                              <Building2 size={9} />{client.company_name}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Contact person */}
                    <td className="px-4 py-3">
                      <span className="text-xs text-text-secondary">{client.contact_person || <span className="text-text-muted">—</span>}</span>
                    </td>

                    {/* Email */}
                    <td className="px-4 py-3">
                      {client.email ? (
                        <a href={`mailto:${client.email}`} className="flex items-center gap-1.5 text-xs text-text-secondary hover:text-primary transition-colors">
                          <Mail size={10} className="text-text-muted shrink-0" />
                          <span className="truncate max-w-[160px]">{client.email}</span>
                        </a>
                      ) : <span className="text-xs text-text-muted">—</span>}
                    </td>

                    {/* Phone */}
                    <td className="px-4 py-3 hidden md:table-cell">
                      {client.mobile ? (
                        <a href={`tel:${client.mobile}`} className="flex items-center gap-1.5 text-xs text-text-secondary hover:text-primary transition-colors">
                          <Phone size={10} className="text-text-muted shrink-0" />{client.mobile}
                        </a>
                      ) : <span className="text-xs text-text-muted">—</span>}
                    </td>

                    {/* GST / PAN */}
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <div className="space-y-0.5">
                        {client.gst_number && (
                          <p className="text-xs text-text-secondary">GST: <span className="font-mono">{client.gst_number}</span></p>
                        )}
                        {client.pan_number && (
                          <p className="text-xs text-text-secondary">PAN: <span className="font-mono">{client.pan_number}</span></p>
                        )}
                        {!client.gst_number && !client.pan_number && <span className="text-xs text-text-muted">—</span>}
                      </div>
                    </td>

                    {/* Added */}
                    <td className="px-4 py-3 hidden xl:table-cell">
                      <span className="text-xs text-text-muted">{formatDate(client.createdAt)}</span>
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => { setEditingClient(client); setModalOpen(true) }}
                          className="w-7 h-7 rounded-lg flex items-center justify-center text-text-muted hover:text-text hover:bg-bg-tertiary transition-all"
                          title="Edit"
                        >
                          <Pencil size={12} />
                        </button>
                        <button
                          onClick={() => setClientToDelete(client)}
                          className="w-7 h-7 rounded-lg flex items-center justify-center text-text-muted hover:text-danger hover:bg-danger/10 transition-all"
                          title="Delete"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </motion.tbody>
            </table>
          </div>

          {/* ── Pagination Footer ───────────────────────── */}
          <div className="px-4 py-3 border-t border-border bg-bg-tertiary/30 flex items-center justify-between gap-4 flex-wrap">
            {/* Left: range + page size */}
            <div className="flex items-center gap-3">
              <p className="text-xs text-text-muted">
                {filtered.length === 0 ? '0 results' : (
                  <>
                    <span className="font-medium text-text">
                      {(safePage - 1) * pageSize + 1}–{Math.min(safePage * pageSize, filtered.length)}
                    </span>
                    {' '}of {filtered.length} clients
                  </>
                )}
              </p>
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-text-muted">Rows:</span>
                <select
                  value={pageSize}
                  onChange={e => { setPageSize(Number(e.target.value)); setPage(1) }}
                  className="text-xs bg-bg border border-border rounded-md px-1.5 py-0.5 text-text focus:outline-none focus:border-primary/50 cursor-pointer"
                >
                  {PAGE_SIZES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>

            {/* Right: page navigation */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage(1)}
                disabled={safePage === 1}
                className="px-2 py-1 rounded-lg text-xs text-text-muted hover:text-text hover:bg-bg-tertiary disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              >«</button>
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={safePage === 1}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-text-muted hover:text-text hover:bg-bg-tertiary disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              ><ChevronLeft size={14} /></button>

              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter(p => p === 1 || p === totalPages || Math.abs(p - safePage) <= 1)
                .reduce<(number | 'ellipsis')[]>((acc, p, i, arr) => {
                  if (i > 0 && p - (arr[i - 1] as number) > 1) acc.push('ellipsis')
                  acc.push(p)
                  return acc
                }, [])
                .map((item, i) =>
                  item === 'ellipsis' ? (
                    <span key={`e-${i}`} className="px-1 text-xs text-text-muted">…</span>
                  ) : (
                    <button
                      key={item}
                      onClick={() => setPage(item as number)}
                      className={cn(
                        'w-7 h-7 rounded-lg text-xs font-medium transition-all',
                        safePage === item ? 'bg-primary text-white' : 'text-text-muted hover:text-text hover:bg-bg-tertiary'
                      )}
                    >{item}</button>
                  )
                )}

              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={safePage === totalPages}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-text-muted hover:text-text hover:bg-bg-tertiary disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              ><ChevronRight size={14} /></button>
              <button
                onClick={() => setPage(totalPages)}
                disabled={safePage === totalPages}
                className="px-2 py-1 rounded-lg text-xs text-text-muted hover:text-text hover:bg-bg-tertiary disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              >»</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modals ──────────────────────────────────────── */}
      <ClientModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        client={editingClient}
      />

      <ConfirmModal
        open={!!clientToDelete}
        onClose={() => setClientToDelete(null)}
        onConfirm={() => clientToDelete && deleteClient.mutate(clientToDelete.id)}
        title="Delete Client"
        description={`Are you sure you want to delete "${clientToDelete?.name}"? This will also remove all associated projects and invoices. This action cannot be undone.`}
        confirmText="Delete Client"
        loading={deleteClient.isPending}
      />
    </div>
  )
}
