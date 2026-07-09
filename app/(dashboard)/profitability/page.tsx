import ProfitabilityClient from '@/components/profitability/profitability-client'
import { verifyModuleAccess } from '@/app/actions/access'

export const metadata = {
  title: 'Profitability | TGT',
}

export default async function ProfitabilityPage() {
  await verifyModuleAccess('profitability')
  return <ProfitabilityClient />
}
