import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const TARGET_ORG_NAME = "The Gold Technologies";

  console.log(`Starting migration to organization: "${TARGET_ORG_NAME}"...`);

  // 1. Ensure the organization exists
  let org = await prisma.organization.findFirst({
    where: { name: TARGET_ORG_NAME }
  });

  if (!org) {
    console.log(`Organization "${TARGET_ORG_NAME}" not found. Creating it...`);
    org = await prisma.organization.create({
      data: {
        name: TARGET_ORG_NAME,
        slug: TARGET_ORG_NAME.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, ''),
        status: 'ACTIVE',
        planTier: 'ENTERPRISE', // Giving maximum capability to the default production org
        maxUsers: 999,
        maxProjects: 999,
      }
    });
    console.log(`Created organization with ID: ${org.id}`);
  } else {
    console.log(`Found existing organization with ID: ${org.id}`);
  }

  const newOrgId = org.id;

  // 2. Define the models to update
  // Using Prisma's dynamic model access, or we can just list them explicitly
  const models = [
    'user',
    'serviceType',
    'role',
    'roleModuleAccess',
    'client',
    'project',
    'task',
    'subtask',
    'taskFile',
    'activityLog',
    'invoice',
    'invoicePayment',
    'expense',
    'salesTarget',
    'salesClosure',
    'notification',
    'calendarEvent',
    'prospect',
    'fileRecord'
  ];

  console.log(`\nMigrating records from "default_org_id" to "${newOrgId}"...`);

  let totalUpdated = 0;

  for (const modelName of models) {
    try {
      // @ts-ignore - Dynamic access to prisma models
      const result = await prisma[modelName].updateMany({
        where: { orgId: 'default_org_id' },
        data: { orgId: newOrgId }
      });

      if (result.count > 0) {
        console.log(`- Updated ${result.count} records in ${modelName}`);
        totalUpdated += result.count;
      }
    } catch (error: any) {
      // If a model doesn't have orgId or has a unique constraint violation
      console.error(`Error updating ${modelName}:`, error.message);
    }
  }

  console.log(`\nMigration completed! Successfully migrated ${totalUpdated} total records to "${TARGET_ORG_NAME}".`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
