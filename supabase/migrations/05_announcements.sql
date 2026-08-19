-- ─────────────────────────────────────────────────────
-- Migration: 05_announcements.sql
-- Adds 'announcement' enum value to notification_type
-- ─────────────────────────────────────────────────────

do $$ begin
  alter type notification_type add value if not exists 'announcement';
exception
  when duplicate_object then null;
end $$;
