-- ============================================================
-- Módulo Bolsa Laboral: Supabase Storage Configuration
-- Creates the 'cvs' bucket and storage policies for CV uploads.
-- This migration is idempotent and safe to re-run.
-- ============================================================

-- 1. Create the 'cvs' storage bucket (private)
INSERT INTO storage.buckets (id, name, public)
VALUES ('cvs', 'cvs', false)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 2. Storage Policies for the 'cvs' bucket
-- ============================================================

-- 2a. alumna_bolsa can INSERT (upload) files only in their own folder
-- Path format: {alumna_id}/{oferta_id}.pdf
CREATE POLICY "alumna_bolsa_insert_own_cvs"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'cvs'
  AND (storage.foldername(name))[1] = auth.uid()::text
  AND auth.uid() IN (
    SELECT id FROM public.profiles WHERE rol = 'alumna_bolsa'
  )
);

-- 2b. alumna_bolsa can SELECT (download) files only from their own folder
CREATE POLICY "alumna_bolsa_select_own_cvs"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'cvs'
  AND (storage.foldername(name))[1] = auth.uid()::text
  AND auth.uid() IN (
    SELECT id FROM public.profiles WHERE rol = 'alumna_bolsa'
  )
);

-- 2c. super_admin can SELECT (download) all files in the cvs bucket
CREATE POLICY "super_admin_select_all_cvs"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'cvs'
  AND auth.uid() IN (
    SELECT id FROM public.profiles WHERE rol = 'super_admin'
  )
);

-- ============================================================
-- IMPORTANT NOTES:
-- - The 'cvs' bucket is PRIVATE (public = false).
-- - Files are stored at path: {alumna_id}/{oferta_id}.pdf
-- - Only alumna_bolsa users can upload, and only in their own folder.
-- - Only alumna_bolsa can view their own CVs; super_admin can view all.
-- - This migration should be run via Supabase SQL Editor or CLI.
-- ============================================================
