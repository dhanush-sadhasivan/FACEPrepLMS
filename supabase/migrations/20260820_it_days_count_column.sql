-- ==============================================================================
-- Migration: Add IT Days Count and Last Check Date to Public Users Table
-- Purpose: Persist internal training attendance metrics directly in PostgreSQL
-- ==============================================================================

ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS it_days_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_it_check_date DATE DEFAULT NULL;
