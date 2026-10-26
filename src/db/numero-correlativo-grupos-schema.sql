-- ============================================================
-- Número Correlativo de Grupos: Schema Migration
-- - Añade el correlativo interno por programa a `grupos_actualizacion`
--   mediante la nueva columna `numero_grupo`.
-- - Hace backfill determinista de los grupos existentes por programa
--   (ac1 -> inicia en 10, ac2 -> inicia en 30, cualquier otro -> 1).
-- - Crea un índice único parcial para garantizar la unicidad del
--   correlativo dentro de cada programa.
--
-- Esta migración es idempotente y segura de re-ejecutar.
-- IMPORTANTE: el usuario debe ejecutarla en Supabase (SQL Editor o CLI)
-- ANTES del deploy del código que usa `numero_grupo`.
-- ============================================================

-- 1. Columna correlativa interna (Req 4.1)
--    Nullable para permitir el ALTER sobre filas existentes antes del backfill.
ALTER TABLE grupos_actualizacion
  ADD COLUMN IF NOT EXISTS numero_grupo INTEGER;

-- 2. Backfill determinista de los grupos existentes (Req 5.1, 5.2, 5.3)
--    Regla: al grupo más antiguo del programa (created_at ascendente) se le
--    asigna el número de inicio del programa, y los siguientes se incrementan
--    en 1 por orden de creación. Con un solo grupo por programa, esto asigna
--    ac1 -> 10 y ac2 -> 30.
WITH numerados AS (
  SELECT
    id,
    CASE programa_id WHEN 'ac1' THEN 10 WHEN 'ac2' THEN 30 ELSE 1 END
      + (ROW_NUMBER() OVER (PARTITION BY programa_id ORDER BY created_at ASC) - 1)
      AS nuevo_numero
  FROM grupos_actualizacion
  WHERE numero_grupo IS NULL
)
UPDATE grupos_actualizacion g
SET numero_grupo = n.nuevo_numero
FROM numerados n
WHERE g.id = n.id;

-- 3. Índice único parcial para evitar duplicados dentro del programa (Req 3.1)
--    Parcial sobre numero_grupo NOT NULL para no chocar con filas sin numerar.
CREATE UNIQUE INDEX IF NOT EXISTS uq_grupos_actualizacion_numero_por_programa
  ON grupos_actualizacion (programa_id, numero_grupo)
  WHERE numero_grupo IS NOT NULL;
