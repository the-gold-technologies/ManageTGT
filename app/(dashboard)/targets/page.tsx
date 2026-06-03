import TargetsClient from '@/components/targets/targets-client'
import { getSalesTargets } from '@/app/actions/targets'
import prisma from '@/lib/prisma'

export default async function TargetsPage() {
  const now = new Date()
  
  const targets = await getSalesTargets()
  const currentYearTargets = targets.filter(t => t.year === now.getFullYear())
  
  const closures = await prisma.salesClosure.findMany({
    include: {
      closer: { select: { name: true } },
      client: { select: { name: true } }
    },
    orderBy: { closed_at: 'desc' }
  })
  
  const formattedClosures = closures.map(c => ({
    ...c,
    closer: c.closer ? { full_name: c.closer.name } : null
  }))

  const profiles = await prisma.user.findMany({
    where: { role: { in: ['admin', 'sales_executive'] } },
    select: { id: true, name: true, role: true }
  })

  const formattedProfiles = profiles.map(p => ({
    id: p.id,
    full_name: p.name || 'User',
    role: p.role
  }))

  return (
    <TargetsClient 
      initialTargets={(currentYearTargets as any) ?? []} 
      initialClosures={(formattedClosures as any) ?? []} 
      profiles={(formattedProfiles as any) ?? []} 
    />
  )
}
