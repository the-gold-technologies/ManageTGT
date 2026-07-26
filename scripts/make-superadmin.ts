import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const email = 'superadmin@tgt.com';
  const name = 'Platform Superadmin';
  const hashedPassword = '$2b$10$XQYld/EIIzcIYrhjbsrZhucdyVQ3XqFG6w8aowLuZTu3g7wa0iMcG';

  const user = await prisma.user.upsert({
    where: { email },
    update: { 
      isSuperAdmin: true,
      password: hashedPassword 
    },
    create: {
      email,
      name,
      password: hashedPassword,
      isSuperAdmin: true
    }
  });

  console.log(`Success! Super admin ${user.email} is ready on the server with identical local credentials.`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
