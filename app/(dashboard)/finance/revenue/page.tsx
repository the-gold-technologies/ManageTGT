import RevenueClient from '@/components/finance/revenue-client'
import { getInvoices } from '@/app/actions/finance'
import { getProjects } from '@/app/actions/projects'
import { getClients } from '@/app/actions/clients'
import type { Invoice, Project, Client } from '@/types'

export default async function RevenuePage() {
  const invoices = await getInvoices()
  const projects = await getProjects()
  const clients = await getClients()

  return (
    <RevenueClient 
      initialInvoices={(invoices as unknown as Invoice[]) ?? []} 
      projects={(projects as unknown as Project[]) ?? []} 
      clients={(clients as unknown as Client[]) ?? []} 
    />
  )
}
