-- Drop previous global unique constraints
DROP INDEX IF EXISTS "Invoice_invoice_number_key";

-- Drop previous global unique constraints
DROP INDEX IF EXISTS "Project_project_code_key";

-- Drop previous global unique constraints
DROP INDEX IF EXISTS "Role_name_key";

-- Drop previous global unique constraints
DROP INDEX IF EXISTS "SalesTarget_service_type_month_year_key";

-- Drop previous global unique constraints
DROP INDEX IF EXISTS "ServiceType_name_key";

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_invoice_number_orgId_key" ON "Invoice"("invoice_number", "orgId");

-- CreateIndex
CREATE UNIQUE INDEX "Project_project_code_orgId_key" ON "Project"("project_code", "orgId");

-- CreateIndex
CREATE UNIQUE INDEX "Role_name_orgId_key" ON "Role"("name", "orgId");

-- CreateIndex
CREATE UNIQUE INDEX "SalesTarget_service_type_month_year_orgId_key" ON "SalesTarget"("service_type", "month", "year", "orgId");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceType_name_orgId_key" ON "ServiceType"("name", "orgId");
