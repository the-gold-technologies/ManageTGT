-- CreateEnum
CREATE TYPE "FileCategory" AS ENUM ('brand_assets', 'reference', 'deliverable', 'contract', 'invoice_docs', 'content', 'bill_receipt', 'general');

-- CreateTable
CREATE TABLE "FileRecord" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "storage_path" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "size" INTEGER,
    "mime_type" TEXT,
    "category" "FileCategory" NOT NULL DEFAULT 'general',
    "source_date" TIMESTAMP(3),
    "source_note" TEXT,
    "client_id" TEXT,
    "project_id" TEXT,
    "prospect_id" TEXT,
    "task_id" TEXT,
    "invoice_id" TEXT,
    "expense_id" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "parent_id" TEXT,
    "uploaded_by" TEXT,
    "uploader_name" TEXT,
    "shared_with" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "is_archived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FileRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FileRecord_client_id_idx" ON "FileRecord"("client_id");

-- CreateIndex
CREATE INDEX "FileRecord_project_id_idx" ON "FileRecord"("project_id");

-- CreateIndex
CREATE INDEX "FileRecord_prospect_id_idx" ON "FileRecord"("prospect_id");

-- CreateIndex
CREATE INDEX "FileRecord_task_id_idx" ON "FileRecord"("task_id");

-- CreateIndex
CREATE INDEX "FileRecord_invoice_id_idx" ON "FileRecord"("invoice_id");

-- CreateIndex
CREATE INDEX "FileRecord_expense_id_idx" ON "FileRecord"("expense_id");

-- CreateIndex
CREATE INDEX "FileRecord_parent_id_idx" ON "FileRecord"("parent_id");

-- CreateIndex
CREATE INDEX "FileRecord_uploaded_by_idx" ON "FileRecord"("uploaded_by");

-- AddForeignKey
ALTER TABLE "FileRecord" ADD CONSTRAINT "FileRecord_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FileRecord" ADD CONSTRAINT "FileRecord_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FileRecord" ADD CONSTRAINT "FileRecord_prospect_id_fkey" FOREIGN KEY ("prospect_id") REFERENCES "Prospect"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FileRecord" ADD CONSTRAINT "FileRecord_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FileRecord" ADD CONSTRAINT "FileRecord_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FileRecord" ADD CONSTRAINT "FileRecord_expense_id_fkey" FOREIGN KEY ("expense_id") REFERENCES "Expense"("id") ON DELETE CASCADE ON UPDATE CASCADE;

