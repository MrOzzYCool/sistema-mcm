/**
 * Utilidad para validar parámetros de fecha ISO 8601 (YYYY-MM-DD)
 * usados en los endpoints de reportes del Módulo Gerencia.
 */

export type DateValidationSuccess = {
  valid: true;
  from: string;
  to: string;
};

export type DateValidationError = {
  valid: false;
  error: string;
  status: number;
};

export type DateValidationResult = DateValidationSuccess | DateValidationError;

const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Valida que los parámetros `from` y `to` estén presentes,
 * tengan formato YYYY-MM-DD válido, y que `from` no sea posterior a `to`.
 */
export function validateDateParams(
  from: string | null,
  to: string | null
): DateValidationResult {
  // 1. Validar presencia
  if (!from || !to) {
    return {
      valid: false,
      error: "Parámetros 'from' y 'to' son requeridos (formato YYYY-MM-DD)",
      status: 400,
    };
  }

  // 2. Validar formato YYYY-MM-DD
  if (!ISO_DATE_REGEX.test(from) || !ISO_DATE_REGEX.test(to)) {
    return {
      valid: false,
      error: "Formato de fecha inválido. Use YYYY-MM-DD",
      status: 400,
    };
  }

  // 3. Validar que from no sea posterior a to
  if (from > to) {
    return {
      valid: false,
      error: "La fecha 'from' no puede ser posterior a 'to'",
      status: 400,
    };
  }

  return { valid: true, from, to };
}
