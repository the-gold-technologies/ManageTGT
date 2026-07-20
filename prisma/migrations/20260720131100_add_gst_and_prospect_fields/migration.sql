-- AlterTable
ALTER TABLE "Client" ADD COLUMN "document_urls" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN "gst_applied" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Prospect" ADD COLUMN "comments" TEXT,
ADD COLUMN "document_urls" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "services" TEXT[] DEFAULT ARRAY[]::TEXT[];
