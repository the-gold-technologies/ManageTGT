import RevenueClient from '@/components/finance/revenue-client'
import { verifyModuleAccess } from '@/app/actions/access'

export default async function RevenuePage() {
  await verifyModuleAccess('revenue')
  return (
    <RevenueClient 
      initialInvoices={[]} 
      projects={[]} 
      clients={[]} 
    />
  )
}
