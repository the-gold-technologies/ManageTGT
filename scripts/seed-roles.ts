import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const roles = ['admin', 'team_lead', 'team_member', 'sales_executive'];
  
  for (const role of roles) {
    await prisma.role.upsert({
      where: { name: role },
      update: {},
      create: { name: role, isSystem: role === 'admin' }
    });
  }
  console.log('Roles seeded.');

  const adminRole = await prisma.role.findUnique({ where: { name: 'admin' } });
  
  if (!adminRole) return;

  const users = await prisma.user.findMany();
  console.log('Current users:');
  console.table(users.map(u => ({ id: u.id, name: u.name, email: u.email, roleId: u.roleId })));

  // Update the two admins. I'll just assign it to users whose emails indicate they are admins, 
  // or I'll just make the first two users admins if they were admins before.
  // We can just print them for now and let the user tell me, or I can update them right here if I know them.
  // I will just print them and let the agent fix them in the next step.
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
