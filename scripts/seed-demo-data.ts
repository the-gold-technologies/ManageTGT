import { PrismaClient, ProjectStatus, TaskStatus, InvoiceStatus, PaymentMode, ExpenseType, Priority } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const adminEmail = process.argv[2] || 'demo@gmail.com';
  console.log(`Starting to seed demo data for admin: ${adminEmail}`);

  const adminUser = await prisma.user.findUnique({
    where: { email: adminEmail }
  });

  if (!adminUser) {
    throw new Error(`User with email ${adminEmail} not found. Please ensure the demo organization is created first.`);
  }

  const orgId = adminUser.orgId;
  console.log(`Seeding data for Organization ID: ${orgId}`);

  // 1. Service Types
  console.log('Seeding Service Types...');
  const services = await Promise.all([
    prisma.serviceType.upsert({
      where: { name_orgId: { name: 'Web Development', orgId } },
      update: {},
      create: { name: 'Web Development', description: 'Full-stack web development', orgId }
    }),
    prisma.serviceType.upsert({
      where: { name_orgId: { name: 'SEO Optimization', orgId } },
      update: {},
      create: { name: 'SEO Optimization', description: 'Search engine optimization services', orgId }
    }),
    prisma.serviceType.upsert({
      where: { name_orgId: { name: 'Social Media Management', orgId } },
      update: {},
      create: { name: 'Social Media Management', description: 'Social media growth and posting', orgId }
    })
  ]);

  // 2. Roles
  console.log('Seeding Roles...');
  const roles = await Promise.all([
    prisma.role.upsert({
      where: { name_orgId: { name: 'Project Manager', orgId } },
      update: {},
      create: { name: 'Project Manager', orgId }
    }),
    prisma.role.upsert({
      where: { name_orgId: { name: 'Senior Developer', orgId } },
      update: {},
      create: { name: 'Senior Developer', orgId }
    }),
    prisma.role.upsert({
      where: { name_orgId: { name: 'UI/UX Designer', orgId } },
      update: {},
      create: { name: 'UI/UX Designer', orgId }
    })
  ]);

  // 3. Team Members
  console.log('Seeding Team Members...');
  const teamMembers = await Promise.all([
    prisma.user.upsert({
      where: { email: 'alice.manager@demo.com' },
      update: {},
      create: { name: 'Alice Manager', email: 'alice.manager@demo.com', roleId: roles[0].id, orgId }
    }),
    prisma.user.upsert({
      where: { email: 'bob.dev@demo.com' },
      update: {},
      create: { name: 'Bob Developer', email: 'bob.dev@demo.com', roleId: roles[1].id, orgId }
    }),
    prisma.user.upsert({
      where: { email: 'charlie.design@demo.com' },
      update: {},
      create: { name: 'Charlie Designer', email: 'charlie.design@demo.com', roleId: roles[2].id, orgId }
    })
  ]);

  // 4. Clients
  console.log('Seeding Clients...');
  const clients = await Promise.all([
    prisma.client.create({
      data: {
        name: 'TechNova Solutions',
        company_name: 'TechNova',
        contact_person: 'John Smith',
        email: 'john@technova.com',
        mobile: '+1-555-0100',
        orgId
      }
    }),
    prisma.client.create({
      data: {
        name: 'Global Industries',
        company_name: 'Global Ind.',
        contact_person: 'Sarah Johnson',
        email: 'sarah@globalind.com',
        mobile: '+1-555-0200',
        orgId
      }
    }),
    prisma.client.create({
      data: {
        name: 'Apex Marketing',
        company_name: 'Apex Marketing Group',
        contact_person: 'Mike Davis',
        email: 'mike@apexmarketing.com',
        mobile: '+1-555-0300',
        orgId
      }
    })
  ]);

  // 5. Projects
  console.log('Seeding Projects...');
  const now = new Date();
  const nextMonth = new Date(now);
  nextMonth.setMonth(now.getMonth() + 1);

  const projects = await Promise.all([
    prisma.project.create({
      data: {
        project_code: 'PRJ-TECH-01',
        name: 'Corporate Website Redesign',
        client_id: clients[0].id,
        service_type: services[0].name,
        quoted_price: 15000,
        team_lead_id: teamMembers[0].id,
        status: ProjectStatus.in_progress,
        start_date: now,
        expected_completion: nextMonth,
        assigned_member_ids: [teamMembers[1].id, teamMembers[2].id],
        orgId
      }
    }),
    prisma.project.create({
      data: {
        project_code: 'PRJ-GLB-01',
        name: 'Enterprise SEO Campaign',
        client_id: clients[1].id,
        service_type: services[1].name,
        quoted_price: 5000,
        team_lead_id: adminUser.id,
        status: ProjectStatus.pending,
        start_date: nextMonth,
        orgId
      }
    }),
    prisma.project.create({
      data: {
        project_code: 'PRJ-APX-01',
        name: 'Social Media Q3 Strategy',
        client_id: clients[2].id,
        service_type: services[2].name,
        quoted_price: 8000,
        team_lead_id: teamMembers[0].id,
        status: ProjectStatus.completed,
        start_date: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
        completion_date: now,
        orgId
      }
    })
  ]);

  // 6. Tasks
  console.log('Seeding Tasks...');
  await prisma.task.createMany({
    data: [
      {
        project_id: projects[0].id,
        title: 'Design wireframes for homepage',
        description: 'Create initial wireframes for client approval.',
        status: TaskStatus.completed,
        priority: Priority.high,
        assigned_by: teamMembers[0].id,
        assigned_member_ids: [teamMembers[2].id],
        orgId
      },
      {
        project_id: projects[0].id,
        title: 'Setup Next.js boilerplate',
        description: 'Initialize repo and setup tailwind.',
        status: TaskStatus.in_progress,
        priority: Priority.medium,
        assigned_by: teamMembers[0].id,
        assigned_member_ids: [teamMembers[1].id],
        orgId
      },
      {
        project_id: projects[0].id,
        title: 'Implement authentication',
        description: 'Setup NextAuth with Google provider.',
        status: TaskStatus.todo,
        priority: Priority.high,
        assigned_by: teamMembers[0].id,
        assigned_member_ids: [teamMembers[1].id],
        orgId
      },
      {
        project_id: projects[1].id,
        title: 'Initial Keyword Research',
        status: TaskStatus.todo,
        priority: Priority.medium,
        assigned_by: adminUser.id,
        orgId
      },
      {
        project_id: projects[2].id,
        title: 'Finalize Content Calendar',
        status: TaskStatus.completed,
        priority: Priority.high,
        assigned_by: teamMembers[0].id,
        orgId
      }
    ]
  });

  // 7. Invoices
  console.log('Seeding Invoices...');
  await prisma.invoice.create({
    data: {
      invoice_number: 'INV-TECH-001',
      project_id: projects[0].id,
      client_id: clients[0].id,
      quoted_value: 15000,
      final_billing: 15000,
      amount_received: 5000,
      invoice_date: now,
      due_date: nextMonth,
      status: InvoiceStatus.partially_paid,
      created_by: adminUser.id,
      orgId,
      payments: {
        create: [
          {
            amount: 5000,
            payment_date: now,
            payment_mode: PaymentMode.bank_transfer,
            notes: 'Advance payment',
            recorded_by: adminUser.id,
            orgId
          }
        ]
      }
    }
  });

  await prisma.invoice.create({
    data: {
      invoice_number: 'INV-APX-001',
      project_id: projects[2].id,
      client_id: clients[2].id,
      quoted_value: 8000,
      final_billing: 8000,
      amount_received: 8000,
      invoice_date: new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000),
      payment_date: now,
      status: InvoiceStatus.paid,
      created_by: adminUser.id,
      orgId,
      payments: {
        create: [
          {
            amount: 8000,
            payment_date: now,
            payment_mode: PaymentMode.card,
            recorded_by: adminUser.id,
            orgId
          }
        ]
      }
    }
  });

  // 8. Prospects
  console.log('Seeding Prospects...');
  await prisma.prospect.create({
    data: {
      name: 'Future Innovations LLC',
      email: 'hello@futureinnovations.com',
      mobile: '+1-555-0999',
      company_name: 'Future Innovations',
      proposal_submitted: true,
      proposal_submission_date: now,
      quote_submitted: 12000,
      services: ['Web Development', 'SEO Optimization'],
      orgId
    }
  });

  // 9. Calendar Events
  console.log('Seeding Calendar Events...');
  await prisma.calendarEvent.create({
    data: {
      title: 'Kickoff Meeting: TechNova',
      start_date: new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000),
      end_date: new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000 + 60 * 60 * 1000), // + 1 hour
      type: 'meeting',
      meeting_platform: 'google_meet',
      created_by: adminUser.id,
      orgId
    }
  });

  console.log('✅ Successfully seeded all dummy data for demo organization!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
