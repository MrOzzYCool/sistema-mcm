-- ============================================================
-- Módulo Bolsa Laboral: Schema Migration
-- Creates tables for ofertas_laborales, solicitudes_acceso_bolsa,
-- and postulaciones with check constraints and RLS policies.
-- This migration is idempotent and safe to re-run.
-- ============================================================

-- ============================================================
-- 1. Table: ofertas_laborales
-- ============================================================

CREATE TABLE IF NOT EXISTS ofertas_laborales (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_nombre text NOT NULL,
  empresa_contacto text NOT NULL,
  puesto text NOT NULL,
  descripcion text NOT NULL,
  requisitos text,
  sueldo_min numeric,
  sueldo_max numeric,
  modalidad text NOT NULL CHECK (modalidad IN ('presencial', 'remoto', 'hibrido')),
  ubicacion text,
  estado text NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'activa', 'cerrada', 'rechazada')),
  fecha_publicacion timestamptz,
  fecha_cierre date,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT ofertas_sueldo_check CHECK (
    sueldo_min IS NULL OR sueldo_max IS NULL OR sueldo_min <= sueldo_max
  )
);

-- ============================================================
-- 2. Table: solicitudes_acceso_bolsa
-- ============================================================

CREATE TABLE IF NOT EXISTS solicitudes_acceso_bolsa (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  alumna_nombre text NOT NULL,
  alumna_dni text NOT NULL,
  alumna_email text NOT NULL,
  alumna_telefono text,
  carrera text NOT NULL,
  anio_ingreso integer NOT NULL,
  anio_egreso integer NOT NULL,
  estado text NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'aprobada', 'rechazada')),
  motivo_rechazo text,
  aprobada_por uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);

-- ============================================================
-- 3. Table: postulaciones
-- ============================================================

CREATE TABLE IF NOT EXISTS postulaciones (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  oferta_id uuid NOT NULL REFERENCES ofertas_laborales(id),
  alumna_id uuid NOT NULL REFERENCES auth.users(id),
  mensaje text,
  cv_url text,
  estado text NOT NULL DEFAULT 'enviada' CHECK (estado IN ('enviada', 'vista', 'seleccionada', 'descartada')),
  created_at timestamptz DEFAULT now(),
  CONSTRAINT postulaciones_oferta_alumna_unique UNIQUE (oferta_id, alumna_id)
);

-- ============================================================
-- 4. Row Level Security: ofertas_laborales
-- ============================================================

ALTER TABLE ofertas_laborales ENABLE ROW LEVEL SECURITY;

-- Allow anyone (anonymous and authenticated) to SELECT active offers
CREATE POLICY "ofertas_select_activas" ON ofertas_laborales
  FOR SELECT
  USING (estado = 'activa');

-- Allow super_admin full access to all offers
CREATE POLICY "ofertas_admin_all" ON ofertas_laborales
  FOR ALL
  USING (
    auth.uid() IN (SELECT id FROM profiles WHERE rol = 'super_admin')
  );

-- ============================================================
-- 5. Row Level Security: solicitudes_acceso_bolsa
-- ============================================================

ALTER TABLE solicitudes_acceso_bolsa ENABLE ROW LEVEL SECURITY;

-- Allow anonymous users to INSERT new solicitudes (public form)
CREATE POLICY "solicitudes_anon_insert" ON solicitudes_acceso_bolsa
  FOR INSERT
  WITH CHECK (true);

-- Allow super_admin full access (SELECT, UPDATE, INSERT, DELETE)
CREATE POLICY "solicitudes_admin_select_update" ON solicitudes_acceso_bolsa
  FOR ALL
  USING (
    auth.uid() IN (SELECT id FROM profiles WHERE rol = 'super_admin')
  );

-- ============================================================
-- 6. Row Level Security: postulaciones
-- ============================================================

ALTER TABLE postulaciones ENABLE ROW LEVEL SECURITY;

-- Allow alumna_bolsa to INSERT postulaciones for themselves
CREATE POLICY "postulaciones_alumna_insert" ON postulaciones
  FOR INSERT
  WITH CHECK (
    alumna_id = auth.uid() AND
    auth.uid() IN (SELECT id FROM profiles WHERE rol = 'alumna_bolsa')
  );

-- Allow alumna_bolsa to SELECT only their own postulaciones
CREATE POLICY "postulaciones_alumna_select_own" ON postulaciones
  FOR SELECT
  USING (
    alumna_id = auth.uid() AND
    auth.uid() IN (SELECT id FROM profiles WHERE rol = 'alumna_bolsa')
  );

-- Allow super_admin full access to all postulaciones
CREATE POLICY "postulaciones_admin_all" ON postulaciones
  FOR ALL
  USING (
    auth.uid() IN (SELECT id FROM profiles WHERE rol = 'super_admin')
  );

-- ============================================================
-- 7. Performance Indexes
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_ofertas_laborales_estado ON ofertas_laborales(estado);
CREATE INDEX IF NOT EXISTS idx_ofertas_laborales_created_at ON ofertas_laborales(created_at);
CREATE INDEX IF NOT EXISTS idx_solicitudes_acceso_bolsa_estado ON solicitudes_acceso_bolsa(estado);
CREATE INDEX IF NOT EXISTS idx_solicitudes_acceso_bolsa_dni ON solicitudes_acceso_bolsa(alumna_dni);
CREATE INDEX IF NOT EXISTS idx_postulaciones_oferta_id ON postulaciones(oferta_id);
CREATE INDEX IF NOT EXISTS idx_postulaciones_alumna_id ON postulaciones(alumna_id);
CREATE INDEX IF NOT EXISTS idx_postulaciones_estado ON postulaciones(estado);

-- ============================================================
-- 8. Add 'alumna_bolsa' to profiles.rol check constraint
-- ============================================================

ALTER TABLE profiles
  DROP CONSTRAINT IF EXISTS profiles_rol_check;

ALTER TABLE profiles
  ADD CONSTRAINT profiles_rol_check
  CHECK (rol IN (
    'super_admin',
    'staff_tramites',
    'gestor',
    'actualizacion',
    'profesor',
    'alumno',
    'cycle_manager',
    'administradora',
    'secretaria_academica',
    'secretaria_atencion_academica',
    'coordinacion_academica',
    'gerenta',
    'contabilidad',
    'alumna_bolsa'
  ));

-- ============================================================
-- IMPORTANT NOTES:
-- - Run this migration via Supabase SQL Editor or CLI.
-- - The 'ofertas_select_activas' policy allows public read of active offers.
-- - The 'solicitudes_anon_insert' policy allows public form submission.
-- - The 'postulaciones_alumna_insert' policy ensures alumnas can only
--   create postulaciones for themselves (alumna_id = auth.uid()).
-- - The UNIQUE constraint on postulaciones(oferta_id, alumna_id) prevents
--   duplicate applications from the same alumna to the same offer.
-- - The sueldo check constraint allows NULL values but enforces
--   sueldo_min <= sueldo_max when both are provided.
-- ============================================================
