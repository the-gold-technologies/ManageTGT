-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- Insert Default Organization
INSERT INTO "Organization" ("id", "name", "createdAt", "updatedAt") VALUES ('default_org_id', 'Default Organization', NOW(), NOW());

-- AlterTable
ALTER TABLE "ActivityLog" ADD COLUMN "orgId" TEXT NOT NULL DEFAULT 'default_org_id';
ALTER TABLE "CalendarEvent" ADD COLUMN "orgId" TEXT NOT NULL DEFAULT 'default_org_id';
ALTER TABLE "Client" ADD COLUMN "orgId" TEXT NOT NULL DEFAULT 'default_org_id';
ALTER TABLE "Expense" ADD COLUMN "orgId" TEXT NOT NULL DEFAULT 'default_org_id';
ALTER TABLE "FileRecord" ADD COLUMN "orgId" TEXT NOT NULL DEFAULT 'default_org_id';
ALTER TABLE "Invoice" ADD COLUMN "orgId" TEXT NOT NULL DEFAULT 'default_org_id';
ALTER TABLE "InvoicePayment" ADD COLUMN "orgId" TEXT NOT NULL DEFAULT 'default_org_id';
ALTER TABLE "Notification" ADD COLUMN "orgId" TEXT NOT NULL DEFAULT 'default_org_id';
ALTER TABLE "Project" ADD COLUMN "orgId" TEXT NOT NULL DEFAULT 'default_org_id';
ALTER TABLE "Prospect" ADD COLUMN "orgId" TEXT NOT NULL DEFAULT 'default_org_id';
ALTER TABLE "Role" ADD COLUMN "orgId" TEXT NOT NULL DEFAULT 'default_org_id';
ALTER TABLE "RoleModuleAccess" ADD COLUMN "orgId" TEXT NOT NULL DEFAULT 'default_org_id';
ALTER TABLE "SalesClosure" ADD COLUMN "orgId" TEXT NOT NULL DEFAULT 'default_org_id';
ALTER TABLE "SalesTarget" ADD COLUMN "orgId" TEXT NOT NULL DEFAULT 'default_org_id';
ALTER TABLE "ServiceType" ADD COLUMN "orgId" TEXT NOT NULL DEFAULT 'default_org_id';
ALTER TABLE "Subtask" ADD COLUMN "orgId" TEXT NOT NULL DEFAULT 'default_org_id';
ALTER TABLE "Task" ADD COLUMN "orgId" TEXT NOT NULL DEFAULT 'default_org_id';
ALTER TABLE "TaskFile" ADD COLUMN "orgId" TEXT NOT NULL DEFAULT 'default_org_id';
ALTER TABLE "User" ADD COLUMN "orgId" TEXT NOT NULL DEFAULT 'default_org_id';

-- AddForeignKey
ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CalendarEvent" ADD CONSTRAINT "CalendarEvent_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Client" ADD CONSTRAINT "Client_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FileRecord" ADD CONSTRAINT "FileRecord_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InvoicePayment" ADD CONSTRAINT "InvoicePayment_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Project" ADD CONSTRAINT "Project_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Prospect" ADD CONSTRAINT "Prospect_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Role" ADD CONSTRAINT "Role_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RoleModuleAccess" ADD CONSTRAINT "RoleModuleAccess_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SalesClosure" ADD CONSTRAINT "SalesClosure_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SalesTarget" ADD CONSTRAINT "SalesTarget_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ServiceType" ADD CONSTRAINT "ServiceType_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Subtask" ADD CONSTRAINT "Subtask_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Task" ADD CONSTRAINT "Task_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TaskFile" ADD CONSTRAINT "TaskFile_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "User" ADD CONSTRAINT "User_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
