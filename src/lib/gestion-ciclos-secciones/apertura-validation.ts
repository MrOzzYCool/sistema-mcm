// Feature: gestion-ciclos-secciones
// Lógica PURA de validación del body de apertura de sección.
//
// Refleja las reglas del `POST` de `src/app/api/admin/cycle-openings/route.ts`,
// extraídas a una función determinística y testeable sin tocar Supabase.
//
// Requisitos: 1.1, 1.2, 1.3

/** Body candidato para aperturar una sección (campos sin validar). */
export type AperturaInput = {
  carrera_id?: unknown;
  cycle_number?: unknown;
  start_date?: unknown;
  tope?: unknown;
};

/** Error de validación con el campo ofensor y su mensaje, o `null` si es válido. */
export type ValidationError = { field: string; message: string } | null;

/**
 * Valida el body de una apertura de sección.
 *
 * Reglas (equivalentes al `POST /api/admin/cycle-openings`):
 *  - `carrera_id` ausente → error en `carrera_id` ("La carrera es obligatoria").
 *  - `cycle_number` o `start_date` ausentes → error ("cycle_number y start_date son requeridos").
 *  - `cycle_number` no entero > 0 → error ("cycle_number debe ser un entero positivo").
 *  - `tope` no entero >= 1 → error en `tope` ("El tope debe ser un entero mayor o igual a 1").
 *  - En caso contrario → `null` (body válido).
 *
 * La función es pura: no muta la entrada ni realiza efectos secundarios.
 */
export function validarApertura(body: AperturaInput): ValidationError {
  const { carrera_id, cycle_number, start_date, tope } = body;

  if (!carrera_id) {
    return { field: "carrera_id", message: "La carrera es obligatoria" };
  }

  if (!cycle_number || !start_date) {
    return {
      field: "cycle_number|start_date",
      message: "cycle_number y start_date son requeridos",
    };
  }

  if (!Number.isInteger(cycle_number) || (cycle_number as number) <= 0) {
    return {
      field: "cycle_number",
      message: "cycle_number debe ser un entero positivo",
    };
  }

  if (!Number.isInteger(tope) || (tope as number) < 1) {
    return {
      field: "tope",
      message: "El tope debe ser un entero mayor o igual a 1",
    };
  }

  return null;
}
