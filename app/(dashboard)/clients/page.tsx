import ClientsClient from '@/components/clients/clients-client'
import type { Client } from '@/types'
import { verifyModuleAccess } from '@/app/actions/access'

export default async function ClientsPage() {
  await verifyModuleAccess('clients')
  return <ClientsClient initialClients={[]} />
}
