-- CreateEnum
CREATE TYPE "FollowUpChannel" AS ENUM ('email', 'whatsapp', 'manual');

-- CreateEnum
CREATE TYPE "FollowUpStatus" AS ENUM ('pending', 'sent', 'skipped', 'failed');

-- CreateTable
CREATE TABLE "ProspectFollowUp" (
    "id" TEXT NOT NULL,
    "prospect_id" TEXT NOT NULL,
    "scheduled_date" TIMESTAMP(3) NOT NULL,
    "channel" "FollowUpChannel" NOT NULL DEFAULT 'email',
    "status" "FollowUpStatus" NOT NULL DEFAULT 'pending',
    "note" TEXT,
    "sent_at" TIMESTAMP(3),
    "is_approved" BOOLEAN NOT NULL DEFAULT false,
    "approved_by" TEXT,
    "approved_at" TIMESTAMP(3),
    "created_by" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "orgId" TEXT NOT NULL DEFAULT 'default_org_id',

    CONSTRAINT "ProspectFollowUp_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProspectFollowUp_prospect_id_idx" ON "ProspectFollowUp"("prospect_id");

-- CreateIndex
CREATE INDEX "ProspectFollowUp_status_idx" ON "ProspectFollowUp"("status");

-- CreateIndex
CREATE INDEX "ProspectFollowUp_scheduled_date_idx" ON "ProspectFollowUp"("scheduled_date");

-- AddForeignKey
ALTER TABLE "ProspectFollowUp" ADD CONSTRAINT "ProspectFollowUp_prospect_id_fkey" FOREIGN KEY ("prospect_id") REFERENCES "Prospect"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProspectFollowUp" ADD CONSTRAINT "ProspectFollowUp_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
