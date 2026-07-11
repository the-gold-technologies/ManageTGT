-- Migration: add assigned_member_ids to Project table
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "assigned_member_ids" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
