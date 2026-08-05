-- AlterTable
ALTER TABLE "ChatMessage" ADD COLUMN IF NOT EXISTS "reply_to_id" TEXT;
ALTER TABLE "ChatMessage" ADD COLUMN IF NOT EXISTS "is_pinned" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ChatMessage" ADD COLUMN IF NOT EXISTS "is_edited" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ChatMessage" ADD COLUMN IF NOT EXISTS "is_deleted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ChatMessage" ADD COLUMN IF NOT EXISTS "edited_at" TIMESTAMP(3);
ALTER TABLE "ChatMessage" ADD COLUMN IF NOT EXISTS "reactions" JSONB NOT NULL DEFAULT '{}';


-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ChatMessage_reply_to_id_fkey') THEN
        ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_reply_to_id_fkey" FOREIGN KEY ("reply_to_id") REFERENCES "ChatMessage"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;
