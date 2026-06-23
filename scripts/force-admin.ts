import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const adminRole = await prisma.role.findUnique({ where: { name: 'admin' } });
  if (!adminRole) {
    console.log('Admin role not found!');
    return;
  }
  
  const ids = ['cmqfcx8p300076a2srbm0a10p', 'cmqpk7aaq001a2395tk9canpn'];
  for (const id of ids) {
    const updated = await prisma.user.update({
      where: { id },
      data: { roleId: adminRole.id }
    });
    console.log('Updated user:', updated.name, 'with roleId:', updated.roleId);
  }

  // ALso let's seed RoleModuleAccess just in case
  const modules = ['dashboard', 'clients', 'projects', 'tasks', 'revenue', 'expenses', 'profitability', 'prospects', 'targets', 'analytics', 'team', 'activity', 'settings'];
  for (const mod of modules) {
    await prisma.roleModuleAccess.upsert({
      where: { roleId_moduleKey: { roleId: adminRole.id, moduleKey: mod } },
      update: { hasAccess: true },
      create: { roleId: adminRole.id, moduleKey: mod, hasAccess: true }
    });
  }
  console.log('Seeded RoleModuleAccess for admin role');
}

main().catch(console.error).finally(() => prisma.$disconnect());
