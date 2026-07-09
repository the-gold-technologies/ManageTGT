import ProspectsClient from '@/components/finance/prospects-client'
import { verifyModuleAccess } from '@/app/actions/access'

export default async function ProspectsPage() {
  await verifyModuleAccess('prospects')
  return (
    <ProspectsClient
      initialProspects={[]}
    />
  )
}
