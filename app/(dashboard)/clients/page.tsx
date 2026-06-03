import ClientsClient from '@/components/clients/clients-client'
import { getClients } from '@/app/actions/clients'
import type { Client } from '@/types'

export default async function ClientsPage() {
  const clients = await getClients()

  return <ClientsClient initialClients={(clients as unknown as Client[]) ?? []} />
}
