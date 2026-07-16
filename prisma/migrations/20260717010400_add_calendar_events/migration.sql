-- CreateEnum
CREATE TYPE "CalendarEventType" AS ENUM ('meeting', 'reminder', 'milestone', 'leave', 'custom');

-- CreateTable
CREATE TABLE "CalendarEvent" (
    "id" TEXT NOT NULL,
    "type" "CalendarEventType" NOT NULL DEFAULT 'custom',
    "title" TEXT NOT NULL,
    "description" TEXT,
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3),
    "all_day" BOOLEAN NOT NULL DEFAULT false,
    "color" TEXT,
    "attendee_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_by" TEXT,
    "is_cancelled" BOOLEAN NOT NULL DEFAULT false,
    "source_type" TEXT,
    "source_id" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CalendarEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CalendarEvent_start_date_idx" ON "CalendarEvent"("start_date");

-- CreateIndex
CREATE INDEX "CalendarEvent_created_by_idx" ON "CalendarEvent"("created_by");
