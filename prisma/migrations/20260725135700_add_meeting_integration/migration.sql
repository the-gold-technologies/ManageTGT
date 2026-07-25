-- AlterTable
ALTER TABLE "CalendarEvent" ADD COLUMN "attendee_emails" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "CalendarEvent" ADD COLUMN "meeting_platform" TEXT;
ALTER TABLE "CalendarEvent" ADD COLUMN "meeting_url" TEXT;
ALTER TABLE "CalendarEvent" ADD COLUMN "meeting_id" TEXT;
