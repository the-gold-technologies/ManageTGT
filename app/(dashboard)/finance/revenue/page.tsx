import RevenueClient from '@/components/finance/revenue-client'

export default function RevenuePage() {
  return (
    <RevenueClient 
      initialInvoices={[]} 
      projects={[]} 
      clients={[]} 
    />
  )
}
