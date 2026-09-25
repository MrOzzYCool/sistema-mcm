// Lógica pura del módulo Grupos de Actualización.
// Sin dependencias de Supabase ni de red: recibe los datos como argumentos
// para poder ejercitarla con pruebas basadas en propiedades.

export interface ValidarAperturaInput {
  programa_id: string;
}

export type ValidarAperturaResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Valida la apertura de un grupo (Req 1.1, 1.3, 1.4).
 * - `programa_id` debe existir en el catálogo (`catalogoIds`).
 * - No puede existir ya un grupo activo del mismo programa.
 *
 * Nota: todas las fechas del grupo son opcionales, por lo que la apertura ya
 * NO exige una fecha de inicio.
 */
export function validarApertura(
  input: ValidarAperturaInput,
  gruposExistentes: { programa_id: string; estado: string }[],
  catalogoIds: string[]
): ValidarAperturaResult {
  if (!input.programa_id || !catalogoIds.includes(input.programa_id)) {
    return { ok: false, error: "Programa inválido" };
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
 * Indica si la inscripción de un grupo ya está cerrada por fecha.
 * Sirve para bloquear nuevas inscripciones (y para ocultar el programa del
 * formulario público) aunque el grupo siga en estado `activo`.
 *
 * Devuelve `true` solo si el grupo tiene una `fecha_cierre_inscripcion` y esa
 * fecha ya pasó comparando por día (hoy > fecha de cierre).
 */
export function inscripcionCerradaPorFecha(
  grupo: { fecha_cierre_inscripcion?: string | null },
  hoy: Date
): boolean {
  if (!grupo.fecha_cierre_inscripcion) return false;
  // Comparación por día: normalizar ambas fechas a medianoche (UTC del valor
  // ISO 'YYYY-MM-DD') y considerar cerrado solo cuando hoy es un día posterior.
  const cierre = new Date(grupo.fecha_cierre_inscripcion);
  const cierreDia = Date.UTC(cierre.getUTCFullYear(), cierre.getUTCMonth(), cierre.getUTCDate());
  const hoyDia = Date.UTC(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  return hoyDia > cierreDia;
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
  fecha_inicio?: string | null;
  fecha_inicio_inscripcion?: string | null;
  fecha_cierre_inscripcion?: string | null;
  fecha_inicio_actualizacion?: string | null;
  fecha_fin_actualizacion?: string | null;
}

/**
 * Deriva la lista de programas que tienen un grupo activo (Req 3.1, 3.4).
 * Devuelve un item por cada programa con grupo activo. Incluye las 4 fechas
 * nuevas por si el formulario público quiere mostrarlas.
 */
export function programasActivos(
  grupos: {
    programa_id: string;
    programa_label: string;
    id?: string;
    estado: string;
    fecha_inicio?: string | null;
    fecha_inicio_inscripcion?: string | null;
    fecha_cierre_inscripcion?: string | null;
    fecha_inicio_actualizacion?: string | null;
    fecha_fin_actualizacion?: string | null;
  }[]
): ProgramaActivo[] {
  return grupos
    .filter((g) => g.estado === "activo")
    .map((g) => ({
      programa_id: g.programa_id,
      programa_label: g.programa_label,
      grupo_id: g.id,
      // Para mostrar "inicio" priorizamos el inicio de la actualización y, si no
      // existe, caemos al valor viejo `fecha_inicio` para no romper datos previos.
      fecha_inicio: g.fecha_inicio_actualizacion ?? g.fecha_inicio,
      fecha_inicio_inscripcion: g.fecha_inicio_inscripcion,
      fecha_cierre_inscripcion: g.fecha_cierre_inscripcion,
      fecha_inicio_actualizacion: g.fecha_inicio_actualizacion,
      fecha_fin_actualizacion: g.fecha_fin_actualizacion,
    }));
}
