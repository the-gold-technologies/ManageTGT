import TargetsClient from '@/components/targets/targets-client'
import { getSalesTargets, getSalesClosures } from '@/app/actions/targets'
import prisma from '@/lib/prisma'

export default function TargetsPage() {
  return (
    <TargetsClient 
      initialTargets={[]} 
      initialClosures={[]} 
      profiles={[]} 
    />
  )
}
