-- ============================================================
-- Módulo Grupos de Actualización: migración de esquema
-- ============================================================

-- 1. Tabla de grupos (tandas)
CREATE TABLE IF NOT EXISTS grupos_actualizacion (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  programa_id              TEXT NOT NULL,
  programa_label           TEXT NOT NULL,
  fecha_inicio             DATE NOT NULL,
  fecha_cierre_inscripcion DATE,
  estado                   TEXT NOT NULL DEFAULT 'activo',
  created_by               UUID,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Estados válidos (Req 8.6)
ALTER TABLE grupos_actualizacion DROP CONSTRAINT IF EXISTS chk_grupos_actualizacion_estado;
ALTER TABLE grupos_actualizacion ADD CONSTRAINT chk_grupos_actualizacion_estado
  CHECK (estado IN ('activo', 'cerrado'));

-- 3. Un solo grupo activo por programa (Req 1.3)
CREATE UNIQUE INDEX IF NOT EXISTS uq_grupos_actualizacion_activo_por_programa
  ON grupos_actualizacion (programa_id)
  WHERE estado = 'activo';

-- 4. Vínculo inscripción -> grupo (nullable, Req 8.2 / 8.3)
ALTER TABLE solicitudes
  ADD COLUMN IF NOT EXISTS grupo_actualizacion_id UUID REFERENCES grupos_actualizacion(id);

CREATE INDEX IF NOT EXISTS idx_solicitudes_grupo_actualizacion_id
  ON solicitudes(grupo_actualizacion_id);

-- NOTA: las inscripciones de actualización previas quedan con
-- grupo_actualizacion_id = NULL ("sin agrupar"). No se realiza backfill
-- automático; se asignan manualmente desde el panel (Req 8.4 / 8.5).
