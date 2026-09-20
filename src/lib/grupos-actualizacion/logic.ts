// Lógica pura del módulo Grupos de Actualización.
// Sin dependencias de Supabase ni de red: recibe los datos como argumentos
// para poder ejercitarla con pruebas basadas en propiedades.

export interface ValidarAperturaInput {
  programa_id: string;
  fecha_inicio: string;
}

export type ValidarAperturaResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Valida la apertura de un grupo (Req 1.1, 1.3, 1.4, 1.5).
 * - `programa_id` debe existir en el catálogo (`catalogoIds`).
 * - `fecha_inicio` no puede estar vacía.
 * - No puede existir ya un grupo activo del mismo programa.
 */
export function validarApertura(
  input: ValidarAperturaInput,
  gruposExistentes: { programa_id: string; estado: string }[],
  catalogoIds: string[]
): ValidarAperturaResult {
  if (!input.programa_id || !catalogoIds.includes(input.programa_id)) {
    return { ok: false, error: "Programa inválido" };
  }

  if (!input.fecha_inicio || input.fecha_inicio.trim() === "") {
    return { ok: false, error: "Fecha de inicio inválida" };
  }

  const yaHayActivo = gruposExistentes.some(
    (g) => g.programa_id === input.programa_id && g.estado === "activo"
  );
  if (yaHayActivo) {
    return { ok: false, error: "Ya existe un grupo activo para este programa" };
  }

  return { ok: true };
}

/**
 * Devuelve el id del grupo activo de un programa, o null si no hay ninguno (Req 4.1, 4.3).
 */
export function resolverGrupoActivo(
  programaId: string,
  grupos: { id?: string; programa_id: string; estado: string }[]
): string | null {
  const activo = grupos.find(
    (g) => g.programa_id === programaId && g.estado === "activo"
  );
  return activo?.id ?? null;
}

/**
 * Calcula el indicador "vencido" sin cambiar el estado del grupo (Req 2.3, 2.4).
 * Verdadero solo si el grupo está activo y su fecha de cierre ya pasó.
 */
export function estaVencido(
  grupo: { fecha_cierre_inscripcion?: string | null; estado: string },
  hoy: Date
): boolean {
  if (grupo.estado !== "activo") return false;
  if (!grupo.fecha_cierre_inscripcion) return false;
  const cierre = new Date(grupo.fecha_cierre_inscripcion);
  return cierre < hoy;
}

export interface ProgramaActivo {
  programa_id: string;
  programa_label: string;
  grupo_id?: string;
  fecha_inicio?: string;
  fecha_cierre_inscripcion?: string | null;
}

/**
 * Deriva la lista de programas que tienen un grupo activo (Req 3.1, 3.4).
 * Devuelve un item por cada programa con grupo activo.
 */
export function programasActivos(
  grupos: {
    programa_id: string;
    programa_label: string;
    id?: string;
    estado: string;
    fecha_inicio?: string;
    fecha_cierre_inscripcion?: string | null;
  }[]
): ProgramaActivo[] {
  return grupos
    .filter((g) => g.estado === "activo")
    .map((g) => ({
      programa_id: g.programa_id,
      programa_label: g.programa_label,
      grupo_id: g.id,
      fecha_inicio: g.fecha_inicio,
      fecha_cierre_inscripcion: g.fecha_cierre_inscripcion,
    }));
}
