-- Slack-style chat notification routing: per-conversation notification levels,
-- stored mentions with a delivery-time scope, and keyword highlights.
--
-- Idempotent for the same reason as the previous migration: this schema has
-- been maintained with `prisma db push`, so objects may already exist.

-- ─── Per-conversation notification level ────────────────────────────────────
-- Column default is MENTIONS (the channel default). DMs are set to ALL by the
-- application at participant-creation time.
ALTER TABLE "ChatParticipant"
    ADD COLUMN IF NOT EXISTS "notify_level" TEXT NOT NULL DEFAULT 'MENTIONS';
ALTER TABLE "ChatParticipant"
    ADD COLUMN IF NOT EXISTS "muted_until" TIMESTAMP(3);

-- Existing 1:1 conversations should keep notifying on every message, so
-- backfill them to ALL rather than silently downgrading them to MENTIONS.
UPDATE "ChatParticipant" p
   SET "notify_level" = 'ALL'
  FROM "ChatConversation" c
 WHERE p."conversation_id" = c."id"
   AND c."is_group" = false
   AND p."notify_level" = 'MENTIONS';

-- ─── Stored mentions ────────────────────────────────────────────────────────
ALTER TABLE "ChatMessage"
    ADD COLUMN IF NOT EXISTS "mentioned_user_ids" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "ChatMessage"
    ADD COLUMN IF NOT EXISTS "mention_scope" TEXT NOT NULL DEFAULT 'NONE';

-- Lets the unread-mentions badge count without scanning a conversation.
CREATE INDEX IF NOT EXISTS "ChatMessage_mentioned_user_ids_idx"
    ON "ChatMessage" USING GIN ("mentioned_user_ids");

-- ─── Keyword highlights ─────────────────────────────────────────────────────
ALTER TABLE "NotificationPreference"
    ADD COLUMN IF NOT EXISTS "keywords" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
