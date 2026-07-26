'use server';

import { basePrisma } from '@/lib/prisma';
import { auth } from '@/auth';
import { revalidatePath } from 'next/cache';
import bcrypt from 'bcryptjs';

// Reusable authorization check
async function requireSuperAdmin() {
  const session = await auth();
  if (!session?.user?.isSuperAdmin) {
    throw new Error('Unauthorized: Superadmin access required');
  }
}

export async function getOrganizations() {
  await requireSuperAdmin();
  
  // basePrisma bypasses the orgId filter, giving us full access to all DB tables
  return await basePrisma.organization.findMany({
    orderBy: { createdAt: 'desc' },
  });
}

export async function createOrganization(data: { 
  name: string, 
  status?: 'ACTIVE' | 'SUSPENDED' | 'PENDING',
  adminName: string,
  adminEmail: string,
  adminPassword: string
}) {
  await requireSuperAdmin();

  // Check if user email already exists globally
  const existingUser = await basePrisma.user.findUnique({
    where: { email: data.adminEmail }
  });
  if (existingUser) {
    throw new Error('A user with this email already exists.');
  }
  
  // Create organization
  const org = await basePrisma.organization.create({
    data: {
      name: data.name,
      status: data.status || 'ACTIVE',
    },
  });

  // Create system admin role for this org
  const adminRole = await basePrisma.role.create({
    data: {
      name: 'admin',
      description: 'System Administrator',
      isSystem: true,
      orgId: org.id
    }
  });

  // Hash password and create admin user
  const hashedPassword = await bcrypt.hash(data.adminPassword, 10);
  await basePrisma.user.create({
    data: {
      name: data.adminName,
      email: data.adminEmail,
      password: hashedPassword,
      roleId: adminRole.id,
      orgId: org.id
    }
  });
  
  revalidatePath('/superadmin');
  return org;
}

export async function updateOrganization(id: string, data: { name: string, status?: 'ACTIVE' | 'SUSPENDED' | 'PENDING' }) {
  await requireSuperAdmin();
  
  const org = await basePrisma.organization.update({
    where: { id },
    data: {
      name: data.name,
      status: data.status,
    },
  });
  
  revalidatePath('/superadmin');
  return org;
}

export async function deleteOrganization(id: string) {
  await requireSuperAdmin();
  
  // Deleting an organization cascades and deletes all related models (Users, Projects, etc)
  await basePrisma.organization.delete({
    where: { id },
  });
  
  revalidatePath('/superadmin');
}
