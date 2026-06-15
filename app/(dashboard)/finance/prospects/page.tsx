import ProspectsClient from '@/components/finance/prospects-client'
import { getProspects } from '@/app/actions/prospects'
import type { Prospect } from '@/types'

export default async function ProspectsPage() {
  const prospects = await getProspects()

  return (
    <ProspectsClient
      initialProspects={(prospects as unknown as Prospect[]) ?? []}
    />
  )
}
