-- AlterTable
ALTER TABLE "ChatMessage" ADD COLUMN "reply_to_id" TEXT;
ALTER TABLE "ChatMessage" ADD COLUMN "is_pinned" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ChatMessage" ADD COLUMN "is_edited" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ChatMessage" ADD COLUMN "is_deleted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ChatMessage" ADD COLUMN "edited_at" TIMESTAMP(3);
ALTER TABLE "ChatMessage" ADD COLUMN "reactions" JSONB NOT NULL DEFAULT '{}';

-- AddForeignKey
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_reply_to_id_fkey" FOREIGN KEY ("reply_to_id") REFERENCES "ChatMessage"("id") ON DELETE SET NULL ON UPDATE CASCADE;
