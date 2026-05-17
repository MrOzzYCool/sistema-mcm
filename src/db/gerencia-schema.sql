-- ============================================================
-- Módulo Gerencia: Schema Migration
-- Adds the 'gerenta' role, reporting views, and performance indexes.
-- This migration is idempotent and safe to re-run.
-- ============================================================

-- 1. Add 'gerenta' to the profiles.rol check constraint
-- Drop the existing constraint and recreate with all roles including 'gerenta'
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
    'gerenta'
  ));

-- ============================================================
-- 2. Reporting Views (SELECT-only, no modifications to existing tables)
-- ============================================================

-- 2a. Financial summary aggregated by month with carrera_id and ciclo
CREATE OR REPLACE VIEW report_financial_summary AS
SELECT
  to_char(i.due_date, 'YYYY-MM') AS month,
  COALESCE(SUM(i.amount) FILTER (WHERE i.status = 'paid'), 0) AS total_ingresos,
  COALESCE(SUM(i.amount) FILTER (WHERE i.status IN ('pending', 'overdue')), 0) AS total_egresos,
  pp.carrera_id,
  pp.ciclo
FROM installments i
JOIN payment_plans pp ON pp.id = i.plan_id
GROUP BY to_char(i.due_date, 'YYYY-MM'), pp.carrera_id, pp.ciclo;

-- 2b. Tramites overview joining solicitudes data
CREATE OR REPLACE VIEW report_tramites_overview AS
SELECT
  s.id,
  s.created_at AS fecha,
  s.tipo_tramite,
  s.nombres || ' ' || s.apellidos AS alumno,
  s.monto_pagado AS costo,
  s.estado,
  s.carrera
FROM solicitudes s;

-- 2c. Recent vouchers joining payment_vouchers, installments, payment_plans, profiles
CREATE OR REPLACE VIEW report_recent_vouchers AS
SELECT
  pv.id,
  p.nombre_completo AS alumno_nombre,
  i.amount AS monto,
  pv.created_at AS fecha,
  pv.status,
  i.comprobante_url
FROM payment_vouchers pv
JOIN installments i ON i.id = pv.installment_id
JOIN payment_plans pp ON pp.id = i.plan_id
JOIN profiles p ON p.id = pp.alumno_id
ORDER BY pv.created_at DESC
LIMIT 50;

-- ============================================================
-- 3. Performance Indexes (created only if they don't already exist)
-- ============================================================

-- Indexes on installments table
CREATE INDEX IF NOT EXISTS idx_installments_due_date ON installments(due_date);
CREATE INDEX IF NOT EXISTS idx_installments_status ON installments(status);
CREATE INDEX IF NOT EXISTS idx_installments_carrera_id ON installments(carrera_id);

-- Indexes on solicitudes table
CREATE INDEX IF NOT EXISTS idx_solicitudes_created_at ON solicitudes(created_at);
CREATE INDEX IF NOT EXISTS idx_solicitudes_estado ON solicitudes(estado);

-- Indexes on payment_vouchers table
CREATE INDEX IF NOT EXISTS idx_payment_vouchers_created_at ON payment_vouchers(created_at);

-- ============================================================
-- 4. Report Schedules Table (for optional email scheduling feature)
-- ============================================================

CREATE TABLE IF NOT EXISTS report_schedules (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  frequency text NOT NULL CHECK (frequency IN ('diario', 'semanal')),
  report_type text NOT NULL CHECK (report_type IN ('financials', 'tramites')),
  format text NOT NULL CHECK (format IN ('csv', 'pdf')),
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Index for querying active schedules by user
CREATE INDEX IF NOT EXISTS idx_report_schedules_user_active
  ON report_schedules(user_id, active);

-- ============================================================
-- IMPORTANT NOTES:
-- - The 'gerenta' role has NO write permissions on any table.
-- - All views are SELECT-only and do not modify existing tables.
-- - Views use the 'report_' prefix for easy identification.
-- - The report_schedules table is the ONE exception to read-only:
--   it stores schedule configuration (not report data).
-- - This migration should be run via Supabase SQL Editor or CLI.
-- ============================================================
