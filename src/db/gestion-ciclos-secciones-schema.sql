-- ============================================================
-- Módulo Gestión de Ciclos y Secciones: Schema Migration
-- - Agrega `tope` (cupo máximo) a cycle_openings
-- - Agrega `cycle_opening_id` (FK) a inscripciones (vínculo directo alumna-sección)
-- - Amplía cycle_openings.status para incluir 'llena' y 'concluido'
-- - Provee función RPC atómica para matrícula con control de cupo
-- - Backfill de cycle_opening_id para inscripciones existentes
--
-- Esta migración es idempotente y segura de re-ejecutar.
-- Ejecutar vía Supabase SQL Editor o CLI.
-- ============================================================

-- ============================================================
-- 1. Nuevas columnas
-- ============================================================

-- Cupo máximo de alumnas por sección. NOT NULL con default 20.
ALTER TABLE cycle_openings ADD COLUMN IF NOT EXISTS tope INTEGER NOT NULL DEFAULT 20;

-- Vínculo directo alumna-sección. Nullable para permitir el backfill gradual.
ALTER TABLE inscripciones ADD COLUMN IF NOT EXISTS cycle_opening_id UUID REFERENCES cycle_openings(id);

-- ============================================================
-- 2. CHECK constraints
-- ============================================================

-- Tope debe ser un entero >= 1 (Req 1.3).
ALTER TABLE cycle_openings DROP CONSTRAINT IF EXISTS chk_cycle_openings_tope;
ALTER TABLE cycle_openings ADD CONSTRAINT chk_cycle_openings_tope
  CHECK (tope >= 1);

-- Limpieza del CHECK constraint legado autogenerado (cycle_openings_status_check).
-- Ese constraint viejo solo permitía ('activo','cerrado') y rechaza los nuevos
-- estados, provocando el error de violación al promover/cerrar una sección.
-- Primero migramos los datos legados y luego eliminamos el constraint viejo.
UPDATE cycle_openings SET status = 'concluido' WHERE status = 'cerrado';
ALTER TABLE cycle_openings DROP CONSTRAINT IF EXISTS cycle_openings_status_check;

-- Estados válidos del ciclo de vida de la sección (Req 5).
-- 'suspendido' se conserva porque la UI actual lo usa al pausar aperturas.
ALTER TABLE cycle_openings DROP CONSTRAINT IF EXISTS chk_cycle_openings_status;
ALTER TABLE cycle_openings ADD CONSTRAINT chk_cycle_openings_status
  CHECK (status IN ('activo', 'llena', 'concluido', 'suspendido'));

-- ============================================================
-- 3. Índices de rendimiento
-- ============================================================

-- Conteo de cupos por sección (Req 2.4).
CREATE INDEX IF NOT EXISTS idx_inscripciones_cycle_opening_id
  ON inscripciones(cycle_opening_id);

-- Búsqueda de aperturas activas por carrera + ciclo (matrícula, promoción).
CREATE INDEX IF NOT EXISTS idx_cycle_openings_carrera_ciclo_status
  ON cycle_openings(carrera_id, cycle_number, status);

-- ============================================================
-- 4. RPC atómica de matrícula con control de cupo (Req 3.7)
-- ============================================================
-- Cuenta las inscripciones activas vinculadas a la apertura y realiza
-- el vínculo dentro de la misma transacción, bloqueando la fila de la
-- apertura con FOR UPDATE para serializar matrículas concurrentes.
-- Devuelve el nuevo conteo y el estado resultante de la apertura.

CREATE OR REPLACE FUNCTION enroll_into_opening(
  p_alumno_id UUID,
  p_carrera_id UUID,
  p_ciclo INTEGER,
  p_opening_id UUID,
  p_fecha_inicio TIMESTAMPTZ,
  p_fecha_matricula TIMESTAMPTZ
)
RETURNS JSON
LANGUAGE plpgsql
AS $$
DECLARE
  v_opening   cycle_openings%ROWTYPE;
  v_count     INTEGER;
  v_insc_id   UUID;
  v_duplicate UUID;
  v_new_status TEXT;
BEGIN
  -- Bloquea la apertura para serializar el conteo + inserción.
  SELECT * INTO v_opening FROM cycle_openings WHERE id = p_opening_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'APERTURA_NO_ENCONTRADA';
  END IF;

  IF v_opening.status <> 'activo' THEN
    RAISE EXCEPTION 'SECCION_NO_ADMITE_MATRICULAS';
  END IF;

  -- Rechaza matrícula duplicada activa en misma carrera + ciclo (Req 3.6).
  SELECT id INTO v_duplicate FROM inscripciones
    WHERE alumno_id = p_alumno_id
      AND carrera_id = p_carrera_id
      AND ciclo_actual = p_ciclo
      AND estado = 'activo'
    LIMIT 1;
  IF v_duplicate IS NOT NULL THEN
    RAISE EXCEPTION 'MATRICULA_DUPLICADA';
  END IF;

  -- Conteo de cupos ocupados (Req 2.4).
  SELECT COUNT(*) INTO v_count FROM inscripciones
    WHERE cycle_opening_id = p_opening_id AND estado = 'activo';

  IF v_count >= v_opening.tope THEN
    RAISE EXCEPTION 'SECCION_LLENA';
  END IF;

  -- Inserta o reutiliza la inscripción del alumno en la carrera.
  SELECT id INTO v_insc_id FROM inscripciones
    WHERE alumno_id = p_alumno_id AND carrera_id = p_carrera_id LIMIT 1;

  IF v_insc_id IS NULL THEN
    INSERT INTO inscripciones (alumno_id, carrera_id, ciclo_actual, fecha_inicio_ciclo, fecha_matricula, estado, cycle_opening_id)
      VALUES (p_alumno_id, p_carrera_id, p_ciclo, p_fecha_inicio, p_fecha_matricula, 'activo', p_opening_id)
      RETURNING id INTO v_insc_id;
  ELSE
    UPDATE inscripciones SET
      ciclo_actual = p_ciclo,
      fecha_inicio_ciclo = p_fecha_inicio,
      estado = 'activo',
      cycle_opening_id = p_opening_id
      WHERE id = v_insc_id;
  END IF;

  v_count := v_count + 1;

  -- Transición a 'llena' cuando se alcanza el tope (Req 5.1).
  v_new_status := v_opening.status;
  IF v_count >= v_opening.tope THEN
    UPDATE cycle_openings SET status = 'llena' WHERE id = p_opening_id;
    v_new_status := 'llena';
  END IF;

  RETURN json_build_object(
    'inscripcion_id', v_insc_id,
    'vinculadas', v_count,
    'tope', v_opening.tope,
    'status', v_new_status
  );
END;
$$;

-- ============================================================
-- 5. Backfill de cycle_opening_id para inscripciones existentes
-- ============================================================
-- Vincula cada inscripción existente a la apertura que coincida por
-- carrera_id + ciclo_actual == cycle_number, SOLO cuando el vínculo es
-- inequívoco (existe exactamente una apertura candidata). Las inscripciones
-- con 0 o >1 aperturas candidatas se dejan sin vincular para revisión manual.
UPDATE inscripciones i
SET cycle_opening_id = sub.opening_id
FROM (
  SELECT co.carrera_id, co.cycle_number, (array_agg(co.id))[1] AS opening_id
  FROM cycle_openings co
  GROUP BY co.carrera_id, co.cycle_number
  HAVING COUNT(*) = 1
) sub
WHERE i.cycle_opening_id IS NULL
  AND i.carrera_id = sub.carrera_id
  AND i.ciclo_actual = sub.cycle_number;

-- ============================================================
-- NOTAS IMPORTANTES:
-- - `tope` toma default 20 en aperturas existentes; ajustar manualmente
--   por sección si el cupo real difiere (ver Consideraciones de migración).
-- - `cycle_opening_id` queda nullable tras el backfill; las inscripciones
--   ambiguas (dos secciones del mismo ciclo/carrera) requieren asignación
--   manual desde la UI.
-- - La RPC enroll_into_opening centraliza el control de cupo y concurrencia;
--   la API debe llamarla en lugar de insertar directamente.
-- ============================================================
