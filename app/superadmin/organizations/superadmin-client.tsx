'use client'

import { useState } from 'react'
import { Plus, Edit2, Trash2, ShieldAlert, CheckCircle2 } from 'lucide-react'
import { createOrganization, updateOrganization, deleteOrganization } from '@/app/actions/superadmin'

type Organization = {
  id: string
  name: string
  status: 'ACTIVE' | 'SUSPENDED' | 'PENDING'
  createdAt: Date
}

export default function SuperAdminClient({ initialOrganizations }: { initialOrganizations: Organization[] }) {
  const [organizations, setOrganizations] = useState(initialOrganizations)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingOrg, setEditingOrg] = useState<Organization | null>(null)
  const [orgName, setOrgName] = useState('')
  const [orgStatus, setOrgStatus] = useState<'ACTIVE' | 'SUSPENDED' | 'PENDING'>('ACTIVE')
  
  // New Admin details state
  const [adminName, setAdminName] = useState('')
  const [adminEmail, setAdminEmail] = useState('')
  const [adminPassword, setAdminPassword] = useState('')
  
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleOpenModal = (org?: Organization) => {
    if (org) {
      setEditingOrg(org)
      setOrgName(org.name)
      setOrgStatus(org.status)
    } else {
      setEditingOrg(null)
      setOrgName('')
      setOrgStatus('ACTIVE')
      setAdminName('')
      setAdminEmail('')
      setAdminPassword('')
    }
    setIsModalOpen(true)
  }

  const handleCloseModal = () => {
    setIsModalOpen(false)
    setEditingOrg(null)
    setOrgName('')
    setOrgStatus('ACTIVE')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!orgName.trim()) return
    setIsSubmitting(true)

    try {
      if (editingOrg) {
        const updated = await updateOrganization(editingOrg.id, { name: orgName, status: orgStatus })
        setOrganizations(orgs => orgs.map(o => o.id === updated.id ? { ...o, name: updated.name, status: updated.status } : o))
      } else {
        if (!adminName || !adminEmail || !adminPassword) {
            alert('Admin details are required to create an organization.');
            setIsSubmitting(false);
            return;
        }
        const created = await createOrganization({ 
          name: orgName, 
          status: orgStatus,
          adminName,
          adminEmail,
          adminPassword
        })
        setOrganizations(orgs => [created, ...orgs])
      }
      handleCloseModal()
    } catch (error) {
      console.error('Failed to save organization:', error)
      alert('An error occurred while saving the organization.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async (id: string, name: string) => {
    if (confirm(`Are you absolutely sure you want to delete the organization "${name}"? This action cannot be undone and will delete all associated users and data.`)) {
      try {
        await deleteOrganization(id)
        setOrganizations(orgs => orgs.filter(o => o.id !== id))
      } catch (error) {
        console.error('Failed to delete organization:', error)
        alert('An error occurred while deleting the organization.')
      }
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-500/10 text-emerald-500 text-xs font-medium"><CheckCircle2 className="w-3 h-3" /> Active</span>
      case 'SUSPENDED':
        return <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-red-500/10 text-red-500 text-xs font-medium"><ShieldAlert className="w-3 h-3" /> Suspended</span>
      case 'PENDING':
        return <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-amber-500/10 text-amber-500 text-xs font-medium"><div className="w-1.5 h-1.5 rounded-full bg-amber-500" /> Pending</span>
      default:
        return null
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <button
          onClick={() => handleOpenModal()}
          className="bg-primary hover:bg-primary-hover text-white px-4 py-2 rounded-lg flex items-center text-sm font-medium transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Organization
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {organizations.map((org) => (
          <div key={org.id} className="bg-bg-secondary rounded-xl p-6 shadow-card border border-border">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-lg font-semibold text-text line-clamp-1">{org.name}</h3>
                <div className="mt-2">
                  {getStatusBadge(org.status)}
                </div>
              </div>
              <div className="flex space-x-2">
                <button onClick={() => handleOpenModal(org)} className="p-1 text-text-muted hover:text-primary transition-colors">
                  <Edit2 className="w-4 h-4" />
                </button>
                <button onClick={() => handleDelete(org.id, org.name)} className="p-1 text-text-muted hover:text-danger transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
            
            <div className="flex items-center space-x-6 text-sm text-text-secondary">
              {/* Privacy: Analytics and data counts have been removed from Superadmin view to ensure tenant trust and data security. */}
            </div>
            
            <div className="mt-4 pt-4 border-t border-border text-xs text-text-muted">
              Created on {new Date(org.createdAt).toLocaleDateString()}
            </div>
          </div>
        ))}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-bg-secondary rounded-xl w-full max-w-md shadow-2xl border border-border">
            <div className="p-6">
              <h2 className="text-xl font-semibold text-text mb-4">
                {editingOrg ? 'Edit Organization' : 'Create Organization'}
              </h2>
              <form onSubmit={handleSubmit}>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-text-secondary mb-1">
                      Organization Name
                    </label>
                    <input
                      type="text"
                      required
                      value={orgName}
                      onChange={(e) => setOrgName(e.target.value)}
                      className="w-full px-4 py-2 bg-bg border border-border rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none text-text"
                      placeholder="Acme Corp"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-text-secondary mb-1">
                      Status
                    </label>
                    <select
                      value={orgStatus}
                      onChange={(e) => setOrgStatus(e.target.value as any)}
                      className="w-full px-4 py-2 bg-bg border border-border rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none text-text"
                    >
                      <option value="ACTIVE">Active</option>
                      <option value="SUSPENDED">Suspended (Blocks Login)</option>
                      <option value="PENDING">Pending</option>
                    </select>
                  </div>
                  
                  {!editingOrg && (
                    <>
                      <hr className="border-border my-4" />
                      <h3 className="text-md font-semibold text-text mb-2">Primary Admin User</h3>
                      <p className="text-xs text-text-muted mb-4">Provide the credentials for the first admin who will own this organization.</p>
                      
                      <div>
                        <label className="block text-sm font-medium text-text-secondary mb-1">
                          Admin Full Name
                        </label>
                        <input
                          type="text"
                          required
                          value={adminName}
                          onChange={(e) => setAdminName(e.target.value)}
                          className="w-full px-4 py-2 bg-bg border border-border rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none text-text"
                          placeholder="John Doe"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-text-secondary mb-1">
                          Admin Email
                        </label>
                        <input
                          type="email"
                          required
                          value={adminEmail}
                          onChange={(e) => setAdminEmail(e.target.value)}
                          className="w-full px-4 py-2 bg-bg border border-border rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none text-text"
                          placeholder="john@example.com"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-text-secondary mb-1">
                          Admin Password
                        </label>
                        <input
                          type="password"
                          required
                          value={adminPassword}
                          onChange={(e) => setAdminPassword(e.target.value)}
                          className="w-full px-4 py-2 bg-bg border border-border rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none text-text"
                          placeholder="••••••••"
                        />
                      </div>
                    </>
                  )}
                </div>
                <div className="mt-6 flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={handleCloseModal}
                    className="px-4 py-2 text-sm font-medium text-text-secondary hover:bg-bg-tertiary rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary-hover rounded-lg transition-colors disabled:opacity-50 shadow-glow-sm"
                  >
                    {isSubmitting ? 'Saving...' : editingOrg ? 'Save Changes' : 'Create Organization'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
