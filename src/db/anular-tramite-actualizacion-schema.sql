-- ============================================================
-- Anular trámite de actualización: Schema Migration
-- Columnas de auditoría para la anulación de trámites de actualización.
--
-- La anulación marca el registro con estado "anulado" (sin borrarlo) y
-- conserva quién anuló, cuándo y por qué. Estas tres columnas soportan
-- ese registro de auditoría. Un trámite en estado "anulado" deja de sumar
-- en el módulo de Contabilidad porque esa consulta filtra por
-- estado = "aprobado".
--
-- IMPORTANTE: el USUARIO debe ejecutar este script en el editor SQL de
-- Supabase ANTES de desplegar el endpoint de anulación, ya que el UPDATE
-- del endpoint referencia estas columnas.
--
-- Esta migración es idempotente y segura de re-ejecutar (usa IF NOT EXISTS).
-- ============================================================

ALTER TABLE solicitudes ADD COLUMN IF NOT EXISTS motivo_anulacion text;
ALTER TABLE solicitudes ADD COLUMN IF NOT EXISTS anulado_por       text;
ALTER TABLE solicitudes ADD COLUMN IF NOT EXISTS anulado_at        timestamptz;

COMMENT ON COLUMN solicitudes.motivo_anulacion IS 'Motivo obligatorio de la anulación del trámite (texto libre, mínimo 3 caracteres). NULL si el trámite no está anulado.';
COMMENT ON COLUMN solicitudes.anulado_por       IS 'Correo o id del administrador (Usuario_Autorizado) que anuló el trámite. NULL si el trámite no está anulado.';
COMMENT ON COLUMN solicitudes.anulado_at         IS 'Fecha y hora (timestamptz) en que se anuló el trámite. NULL si el trámite no está anulado.';

-- ============================================================
-- Actualizar el CHECK constraint de 'estado' para permitir 'anulado'.
-- El constraint legado 'solicitudes_estado_check' solo permitia
-- pendiente/aprobado/observado/rechazado, por lo que el UPDATE a
-- estado='anulado' fallaba. Se recrea incluyendo 'anulado' y
-- conservando los estados existentes.
-- ============================================================

ALTER TABLE solicitudes DROP CONSTRAINT IF EXISTS solicitudes_estado_check;

ALTER TABLE solicitudes ADD CONSTRAINT solicitudes_estado_check
  CHECK (estado IN ('pendiente', 'aprobado', 'observado', 'rechazado', 'anulado'));
