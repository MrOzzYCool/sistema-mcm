-- ============================================================
-- Agrega columna boleta_pregenerada a installments
-- Para el flujo de pregeneración mensual de boletas SUNAT
-- ============================================================

ALTER TABLE installments
  ADD COLUMN IF NOT EXISTS boleta_pregenerada boolean DEFAULT false;

-- Índice para el cron que busca cuotas pendientes sin boleta
CREATE INDEX IF NOT EXISTS idx_installments_boleta_pregenerada
  ON installments(boleta_pregenerada)
  WHERE status = 'pending' AND boleta_pregenerada = false;
