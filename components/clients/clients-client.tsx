'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Plus, Search, Building2, Mail, Phone, MoreHorizontal, Pencil, Trash2 } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import type { Client } from '@/types'
import { Button } from '@/components/ui/button'
import { Glow } from '@/components/ui/glow'
import { formatDate } from '@/lib/utils'
import ClientModal from './client-modal'

interface ClientsClientProps {
  initialClients: Client[]
}

export default function ClientsClient({ initialClients }: ClientsClientProps) {
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editingClient, setEditingClient] = useState<Client | null>(null)
  const qc = useQueryClient()
  const supabase = createClient()

  const { data: clients } = useQuery({
    queryKey: ['clients'],
    queryFn: async () => {
      const { data } = await supabase.from('clients').select('*').order('created_at', { ascending: false })
      return data as Client[]
    },
    initialData: initialClients,
  })

  const deleteClient = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('clients').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['clients'] })
      toast.success('Client deleted')
    },
    onError: () => toast.error('Failed to delete client'),
  })

  const filtered = (clients ?? []).filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.company_name ?? '').toLowerCase().includes(search.toLowerCase()) ||
    (c.email ?? '').toLowerCase().includes(search.toLowerCase())
  )

  const containerVariants = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.05 } } }
  const itemVariants = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-text">Clients</h2>
          <p className="text-sm text-text-secondary mt-0.5">{clients?.length ?? 0} total clients</p>
        </div>
        <Button onClick={() => { setEditingClient(null); setModalOpen(true) }}>
          <Plus size={15} /> Add Client
        </Button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search clients, companies, emails..."
          className="w-full max-w-sm pl-9 pr-4 py-2 bg-bg-secondary border border-border rounded-lg text-sm text-text placeholder:text-text-muted focus:outline-none focus:border-primary/50 transition-all"
        />
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Building2 size={36} className="text-text-muted mb-3" />
          <p className="text-text-secondary font-medium">No clients found</p>
          <p className="text-sm text-text-muted mt-1">Add your first client to get started</p>
        </div>
      ) : (
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4"
        >
          {filtered.map(client => (
            <motion.div
              key={client.id}
              variants={itemVariants}
              className="relative overflow-hidden bg-bg-secondary border border-border rounded-xl p-5 hover:border-border-muted transition-all group"
            >
              <Glow />
              <div className="relative z-10">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center text-sm font-bold">
                      {client.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-semibold text-text text-sm">{client.name}</p>
                      {client.company_name && (
                        <p className="text-xs text-text-muted">{client.company_name}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => { setEditingClient(client); setModalOpen(true) }}
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-text-muted hover:text-text hover:bg-bg-tertiary transition-all"
                    >
                      <Pencil size={12} />
                    </button>
                    <button
                      onClick={() => {
                        if (confirm('Delete this client?')) deleteClient.mutate(client.id)
                      }}
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-text-muted hover:text-danger hover:bg-danger-muted transition-all"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  {client.email && (
                    <div className="flex items-center gap-2 text-xs text-text-secondary">
                      <Mail size={11} className="text-text-muted shrink-0" />
                      <span className="truncate">{client.email}</span>
                    </div>
                  )}
                  {client.mobile && (
                    <div className="flex items-center gap-2 text-xs text-text-secondary">
                      <Phone size={11} className="text-text-muted shrink-0" />
                      <span>{client.mobile}</span>
                    </div>
                  )}
                  {client.gst_number && (
                    <div className="text-xs text-text-muted">GST: {client.gst_number}</div>
                  )}
                </div>

                <div className="mt-4 pt-3 border-t border-border flex items-center justify-between">
                  <span className="text-xs text-text-muted">Added {formatDate(client.created_at)}</span>
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>
      )}

      {/* Modal */}
      <ClientModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        client={editingClient}
      />
    </div>
  )
}
