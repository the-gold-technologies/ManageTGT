import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const SERVICE_TYPES = [
  'Website Development',
  'SEO',
  'Social Media Marketing',
  'PPC Management',
  'Content Marketing',
  'Email Marketing',
  'Graphic Design',
  'Video Production',
  'Other',
]

async function main() {
  console.log('Seeding services...')
  for (const name of SERVICE_TYPES) {
    const existing = await prisma.serviceType.findUnique({
      where: { name }
    })
    
    if (!existing) {
      await prisma.serviceType.create({
        data: { name }
      })
      console.log(`Created service: ${name}`)
    } else {
      console.log(`Service already exists: ${name}`)
    }
  }
  console.log('Finished seeding services.')
}

main()
  .catch(e => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
