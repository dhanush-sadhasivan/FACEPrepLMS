-- ==============================================================================
-- Migration: Setup Supabase Storage API Cache Bucket with Strict RLS Policies
-- Purpose: Enable Cached Egress via Supabase Smart CDN for Leaderboards & Contests
-- ==============================================================================

-- 1. Create the 'api-cache' storage bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'api-cache',
  'api-cache',
  true,
  5242880, -- 5 MB max per cache file
  ARRAY['application/json']
)
ON CONFLICT (id) DO UPDATE 
SET public = true,
    allowed_mime_types = ARRAY['application/json'];

-- 2. Drop existing policy if exists to avoid conflicts
DROP POLICY IF EXISTS "Public Read Cache" ON storage.objects;
DROP POLICY IF EXISTS "Service Role Manage Cache" ON storage.objects;

-- 3. Policy: Allow anyone (public/anon/authenticated) to read cache JSON objects
CREATE POLICY "Public Read Cache"
ON storage.objects FOR SELECT
USING (bucket_id = 'api-cache');

-- 4. Policy: Allow write/update/delete only for service_role
-- Note: In Supabase, the service_role key automatically bypasses RLS,
-- but we explicitly disallow anon and authenticated users from writing.
CREATE POLICY "Service Role Manage Cache"
ON storage.objects FOR ALL
TO service_role
USING (bucket_id = 'api-cache')
WITH CHECK (bucket_id = 'api-cache');
