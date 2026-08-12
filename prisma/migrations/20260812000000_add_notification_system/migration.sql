-- Adds the unified notification system: per-user preferences, web-push
-- subscriptions, and the extra Notification columns the engine writes.
--
-- Written idempotently (IF NOT EXISTS / duplicate_object guards) on purpose:
-- these objects were originally created with `prisma db push`, so they already
-- exist in any database that was pushed to. This lets `prisma migrate deploy`
-- apply cleanly against both an already-pushed database and a fresh one.

-- ─── Notification: extra columns ────────────────────────────────────────────
ALTER TABLE "Notification" ADD COLUMN IF NOT EXISTS "readAt"     TIMESTAMP(3);
ALTER TABLE "Notification" ADD COLUMN IF NOT EXISTS "priority"   TEXT NOT NULL DEFAULT 'MEDIUM';
ALTER TABLE "Notification" ADD COLUMN IF NOT EXISTS "entityType" TEXT;
ALTER TABLE "Notification" ADD COLUMN IF NOT EXISTS "entityId"   TEXT;
ALTER TABLE "Notification" ADD COLUMN IF NOT EXISTS "channels"   TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- ─── NotificationPreference ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "NotificationPreference" (
    "id"                TEXT         NOT NULL,
    "userId"            TEXT         NOT NULL,
    "inAppEnabled"      BOOLEAN      NOT NULL DEFAULT true,
    "pushEnabled"       BOOLEAN      NOT NULL DEFAULT true,
    "emailEnabled"      BOOLEAN      NOT NULL DEFAULT true,
    "channelOverrides"  JSONB        NOT NULL DEFAULT '{}',
    "quietHoursEnabled" BOOLEAN      NOT NULL DEFAULT false,
    "quietHoursStart"   INTEGER,
    "quietHoursEnd"     INTEGER,
    "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"         TIMESTAMP(3) NOT NULL,
    "orgId"             TEXT         NOT NULL DEFAULT 'default_org_id',

    CONSTRAINT "NotificationPreference_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "NotificationPreference_userId_key"
    ON "NotificationPreference"("userId");

-- ─── PushSubscription ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "PushSubscription" (
    "id"          TEXT         NOT NULL,
    "userId"      TEXT         NOT NULL,
    "endpoint"    TEXT         NOT NULL,
    "p256dh"      TEXT         NOT NULL,
    "auth"        TEXT         NOT NULL,
    "deviceName"  TEXT,
    "deviceType"  TEXT         NOT NULL DEFAULT 'web',
    "browserName" TEXT,
    "isActive"    BOOLEAN      NOT NULL DEFAULT true,
    "lastSeenAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "orgId"       TEXT         NOT NULL DEFAULT 'default_org_id',

    CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PushSubscription_endpoint_key"
    ON "PushSubscription"("endpoint");

CREATE INDEX IF NOT EXISTS "PushSubscription_userId_idx"
    ON "PushSubscription"("userId");

-- ─── Foreign keys ───────────────────────────────────────────────────────────
-- Postgres has no ADD CONSTRAINT IF NOT EXISTS, so each is wrapped.
DO $$ BEGIN
    ALTER TABLE "Notification"
        ADD CONSTRAINT "Notification_orgId_fkey"
        FOREIGN KEY ("orgId") REFERENCES "Organization"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "NotificationPreference"
        ADD CONSTRAINT "NotificationPreference_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "User"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "NotificationPreference"
        ADD CONSTRAINT "NotificationPreference_orgId_fkey"
        FOREIGN KEY ("orgId") REFERENCES "Organization"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "PushSubscription"
        ADD CONSTRAINT "PushSubscription_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "User"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "PushSubscription"
        ADD CONSTRAINT "PushSubscription_orgId_fkey"
        FOREIGN KEY ("orgId") REFERENCES "Organization"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
