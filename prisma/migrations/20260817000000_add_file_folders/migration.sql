-- AlterTable
ALTER TABLE "FileRecord" ADD COLUMN "folder_id" TEXT;

-- CreateTable
CREATE TABLE "FileFolder" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "context" TEXT NOT NULL DEFAULT 'all',
    "context_id" TEXT,
    "created_by" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "orgId" TEXT NOT NULL DEFAULT 'default_org_id',

    CONSTRAINT "FileFolder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FileFolder_context_idx" ON "FileFolder"("context");

-- CreateIndex
CREATE INDEX "FileFolder_context_id_idx" ON "FileFolder"("context_id");

-- CreateIndex
CREATE INDEX "FileFolder_orgId_idx" ON "FileFolder"("orgId");

-- CreateIndex
CREATE INDEX "FileRecord_folder_id_idx" ON "FileRecord"("folder_id");

-- AddForeignKey
ALTER TABLE "FileRecord" ADD CONSTRAINT "FileRecord_folder_id_fkey" FOREIGN KEY ("folder_id") REFERENCES "FileFolder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FileFolder" ADD CONSTRAINT "FileFolder_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
