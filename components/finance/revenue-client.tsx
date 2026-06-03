'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Plus, Search, Receipt } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getInvoices } from '@/app/actions/finance'
import { toast } from 'sonner'
import type { Invoice, Project, Client } from '@/types'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import StatCard from '@/components/ui/stat-card'
import { formatDate, formatCurrency, INVOICE_STATUS_CONFIG } from '@/lib/utils'
import InvoiceModal from './invoice-modal'
import { DollarSign, Clock, CheckCircle2, AlertCircle } from 'lucide-react'
import { parseISO, startOfDay, isSameDay, isSameWeek, isSameMonth, isSameQuarter, isSameYear } from 'date-fns'
import ExportDropdown from '@/components/ui/export-dropdown'
import DateFilterDropdown, { DateFilterValue } from '@/components/ui/date-filter-dropdown'
import { TablePagination } from '@/components/ui/table-pagination'

interface RevenueClientProps {
  initialInvoices: Invoice[]
  projects: Pick<Project, 'id' | 'name' | 'project_code'>[]
  clients: Pick<Client, 'id' | 'name'>[]
}

const STATUS_BADGE_MAP: Record<string, 'default' | 'info' | 'muted' | 'success' | 'warning' | 'danger'> = {
  paid: 'success',
  partially_paid: 'warning',
  pending: 'muted',
  overdue: 'danger',
}

export default function RevenueClient({ initialInvoices, projects, clients }: RevenueClientProps) {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [dateFilter, setDateFilter] = useState<DateFilterValue>('all')
  const [customDateStart, setCustomDateStart] = useState<Date | null>(null)
  const [customDateEnd, setCustomDateEnd] = useState<Date | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const qc = useQueryClient()

  const { data: invoices } = useQuery({
    queryKey: ['invoices'],
    queryFn: async () => {
      const data = await getInvoices()
      return data as unknown as Invoice[]
    },
    initialData: initialInvoices,
  })

  const inv = invoices ?? []
  const totalBilled = inv.reduce((s, i) => s + (i.final_billing || 0), 0)
  const totalReceived = inv.reduce((s, i) => s + (i.amount_received || 0), 0)
  const totalPending = totalBilled - totalReceived
  const overdueCount = inv.filter(i => i.status === 'overdue').length

  const STATUSES = ['all', 'paid', 'partially_paid', 'pending', 'overdue']
  const filtered = inv.filter(i => {
    const matchSearch = (i.invoice_number ?? '').toLowerCase().includes(search.toLowerCase()) ||
      (i.project?.name ?? '').toLowerCase().includes(search.toLowerCase()) ||
      (i.client?.name ?? '').toLowerCase().includes(search.toLowerCase())
    const matchStatus = statusFilter === 'all' || i.status === statusFilter

    let matchDate = true
    if (dateFilter !== 'all' && i.invoice_date) {
      const expected = startOfDay(new Date(i.invoice_date))
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
    } else if (dateFilter !== 'all' && !i.invoice_date) {
      matchDate = false
    }

    return matchSearch && matchStatus && matchDate
  })

  const exportHeaders = ['Invoice No', 'Project', 'Client', 'Status', 'Billed', 'Received', 'Date', 'Due Date']
  const mapExportData = (i: Invoice) => [
    i.invoice_number || 'N/A',
    i.project?.name || '—',
    i.client?.name || '—',
    i.status,
    i.final_billing || 0,
    i.amount_received || 0,
    i.invoice_date ? formatDate(i.invoice_date) : 'N/A',
    i.due_date ? formatDate(i.due_date) : 'N/A'
  ]

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const safePage = Math.min(page, totalPages)
  const paginated = filtered.slice((safePage - 1) * pageSize, safePage * pageSize)

  return (
    <div className="flex flex-col h-full gap-4">
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h2 className="text-xl font-bold text-text">Revenue & Invoices</h2>
          <p className="text-sm text-text-secondary mt-0.5">{inv.length} total invoices</p>
        </div>
        <Button onClick={() => { setEditingInvoice(null); setModalOpen(true) }}>
          <Plus size={15} /> New Invoice
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 shrink-0">
        <StatCard title="Total Billed" value={formatCurrency(totalBilled)} icon={DollarSign} iconColor="bg-primary/10 text-primary" />
        <StatCard title="Amount Received" value={formatCurrency(totalReceived)} icon={CheckCircle2} iconColor="bg-success/10 text-success" />
        <StatCard title="Pending Amount" value={formatCurrency(totalPending)} icon={Clock} iconColor="bg-warning/10 text-warning" />
        <StatCard title="Overdue" value={String(overdueCount)} icon={AlertCircle} iconColor="bg-danger/10 text-danger" />
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 justify-between items-center shrink-0">
        <div className="flex gap-3 w-full sm:w-auto flex-1">
          <div className="relative flex-1 max-w-sm">
            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
            <input value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} placeholder="Search invoices..."
              className="w-full pl-9 pr-4 py-2 bg-bg-secondary border border-border rounded-lg text-sm text-text placeholder:text-text-muted focus:outline-none focus:border-primary/50 transition-all" />
          </div>
          <div className="flex items-center gap-2 overflow-x-auto">
            {STATUSES.map(s => (
              <button key={s} onClick={() => { setStatusFilter(s); setPage(1) }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${statusFilter === s ? 'bg-primary text-white' : 'bg-bg-secondary border border-border text-text-secondary hover:text-text'}`}>
                {s === 'all' ? 'All' : INVOICE_STATUS_CONFIG[s as keyof typeof INVOICE_STATUS_CONFIG]?.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex gap-3 items-center w-full sm:w-auto">
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
            filename={`revenue_export_${new Date().toISOString().split('T')[0]}`} 
            mapData={mapExportData} 
          />
        </div>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center flex-1">
          <Receipt size={36} className="text-text-muted mb-3" />
          <p className="text-text-secondary font-medium">No invoices found</p>
        </div>
      ) : (
        <div className="flex flex-col flex-1 min-h-0 rounded-xl border border-border overflow-hidden">
          <div className="overflow-x-auto overflow-y-auto flex-1">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-bg-tertiary border-b border-border">
                  {['Invoice #', 'Project', 'Client', 'Billed', 'Received', 'Pending', 'Due Date', 'Status'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-text-secondary uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paginated.map((inv, idx) => (
                  <tr key={inv.id} onClick={() => { setEditingInvoice(inv); setModalOpen(true) }}
                    className="border-b border-border bg-bg-secondary hover:bg-bg-tertiary transition-colors cursor-pointer">
                    <td className="px-4 py-3 font-medium text-text">{inv.invoice_number}</td>
                    <td className="px-4 py-3 text-text-secondary">{inv.project?.name ?? '—'}</td>
                    <td className="px-4 py-3 text-text-secondary">{inv.client?.name ?? '—'}</td>
                    <td className="px-4 py-3 font-medium text-text">{formatCurrency(inv.final_billing)}</td>
                    <td className="px-4 py-3 text-success">{formatCurrency(inv.amount_received)}</td>
                    <td className="px-4 py-3 text-warning">{formatCurrency(inv.final_billing - inv.amount_received)}</td>
                    <td className="px-4 py-3 text-text-secondary">{formatDate(inv.due_date)}</td>
                    <td className="px-4 py-3">
                      <Badge variant={STATUS_BADGE_MAP[inv.status]}>
                        {INVOICE_STATUS_CONFIG[inv.status]?.label}
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
            itemLabel="invoices"
          />
        </div>
      )}

      <InvoiceModal open={modalOpen} onClose={() => setModalOpen(false)} invoice={editingInvoice} projects={projects} clients={clients} />
    </div>
  )
}
