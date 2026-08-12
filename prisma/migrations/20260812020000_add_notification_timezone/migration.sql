-- Quiet hours were being evaluated against the server's clock, so the
-- do-not-disturb window applied at the wrong time of day for anyone outside the
-- server's timezone. Storing the user's IANA zone makes the check correct.
--
-- Idempotent for the same reason as the earlier migrations: this schema has been
-- maintained with `prisma db push`.

ALTER TABLE "NotificationPreference"
    ADD COLUMN IF NOT EXISTS "timezone" TEXT;
