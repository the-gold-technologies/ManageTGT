import TargetsClient from '@/components/targets/targets-client'
import { getSalesTargets, getSalesClosures } from '@/app/actions/targets'
import prisma from '@/lib/prisma'
import { verifyModuleAccess } from '@/app/actions/access'

export default async function TargetsPage() {
  await verifyModuleAccess('targets')
  return (
    <TargetsClient 
      initialTargets={[]} 
      initialClosures={[]} 
      profiles={[]} 
    />
  )
}
