import ProspectsClient from '@/components/finance/prospects-client'
import { verifyModuleAccess } from '@/app/actions/access'
import { auth } from '@/auth'
import prisma from '@/lib/prisma'

export default async function ProspectsPage() {
  await verifyModuleAccess('prospects')
  
  const session = await auth()
  let isAdmin = false
  if (session?.user?.id) {
    const dbUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { role: true }
    })
    isAdmin = dbUser?.role?.name === 'admin' || dbUser?.isSuperAdmin || false
  }

  return (
    <ProspectsClient
      initialProspects={[]}
      isAdmin={isAdmin}
    />
  )
}
