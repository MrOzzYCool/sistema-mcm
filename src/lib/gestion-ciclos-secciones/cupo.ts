// Feature: gestion-ciclos-secciones
// Modelo de referencia PURO de la lógica de cupo y ciclo de vida de una sección.
//
// La aplicación real del control de cupo, duplicados y ciclo de vida vive en la
// RPC de Postgres `enroll_into_opening` (SELECT ... FOR UPDATE), que no puede
// ejecutarse en tests unitarios. Este archivo documenta y verifica la conducta
// prevista de esa lógica con funciones puras y determinísticas, de modo que sirva
// como especificación ejecutable de la RPC.
//
// Requisitos: 2.4, 3.2, 3.3, 3.5, 3.6, 3.7, 5.1, 5.2, 5.5, 8.4

/** Estado observable de una sección relevante para decidir una matrícula. */
export interface SeccionEstado {
  /** Cupo máximo de la sección (Tope). */
  tope: number;
  /** Cantidad de alumnas actualmente vinculadas a la sección. */
  vinculadas: number;
  /** Estado del ciclo de vida de la sección. */
  status: "activo" | "llena" | "concluido" | "suspendido";
}

/** Resultado de intentar una matrícula sobre una sección. */
export type EnrollOutcome =
  | { ok: true; nuevoEstado: SeccionEstado }
  | { ok: false; error: "SECCION_LLENA" | "SECCION_NO_ADMITE_MATRICULAS" };

/**
 * Intenta matricular a una alumna en una sección aplicando el control de cupo
 * y de ciclo de vida.
 *
 * Reglas (equivalentes a la RPC `enroll_into_opening`):
 *  - Solo una sección `activo` admite matrículas; cualquier otro estado
 *    (`llena`, `concluido`, `suspendido`) se rechaza con `SECCION_NO_ADMITE_MATRICULAS`.
 *  - Si la sección ya alcanzó su tope (`vinculadas >= tope`), se rechaza con
 *    `SECCION_LLENA`.
 *  - En caso contrario, se vincula a la alumna (`vinculadas + 1`) y, si con ese
 *    vínculo se alcanza el tope, la sección transita a `llena`.
 *
 * La función es pura: no muta `estado`, devuelve un nuevo objeto.
 */
export function intentarMatricula(estado: SeccionEstado): EnrollOutcome {
  if (estado.status !== "activo") {
    return { ok: false, error: "SECCION_NO_ADMITE_MATRICULAS" };
  }
  if (estado.vinculadas >= estado.tope) {
    return { ok: false, error: "SECCION_LLENA" };
  }
  const vinculadas = estado.vinculadas + 1;
  const status: SeccionEstado["status"] = vinculadas >= estado.tope ? "llena" : "activo";
  return { ok: true, nuevoEstado: { ...estado, vinculadas, status } };
}

/** Identificador de una matrícula activa: alumna + carrera + ciclo. */
export interface MatriculaTupla {
  alumno_id: string;
  carrera_id: string;
  ciclo: number;
}

/** Serializa una tupla de matrícula para compararla dentro de un conjunto. */
function claveTupla(t: MatriculaTupla): string {
  return `${t.alumno_id}::${t.carrera_id}::${t.ciclo}`;
}

/**
 * Determina si un intento de matrícula duplica una inscripción activa existente.
 *
 * Equivale a la validación de la RPC que rechaza con `MATRICULA_DUPLICADA` cuando
 * ya existe una inscripción `estado = activo` para la misma alumna, carrera y ciclo.
 *
 * @param existentes Tuplas de matrículas activas actuales.
 * @param intento Tupla de la matrícula que se desea registrar.
 * @returns `true` si ya existe una matrícula activa idéntica.
 */
export function esDuplicado(
  existentes: MatriculaTupla[],
  intento: MatriculaTupla
): boolean {
  const clave = claveTupla(intento);
  return existentes.some((e) => claveTupla(e) === clave);
}

/**
 * Aplica un intento de matrícula al conjunto de matrículas activas.
 *
 * Si el intento es duplicado, el conjunto no crece (se devuelve una copia sin
 * cambios). Si no lo es, se agrega la nueva tupla.
 *
 * @returns Un nuevo arreglo con el conjunto resultante (no muta el original).
 */
export function agregarMatricula(
  existentes: MatriculaTupla[],
  intento: MatriculaTupla
): MatriculaTupla[] {
  if (esDuplicado(existentes, intento)) {
    return [...existentes];
  }
  return [...existentes, intento];
}

/**
 * Calcula los cupos disponibles de una sección.
 *
 * Equivale al `cupos_disponibles` que expone el endpoint
 * `GET /api/admin/cycle-openings/available`: la diferencia entre el tope de la
 * sección y la cantidad de alumnas actualmente vinculadas.
 *
 * El resultado puede ser cero (sección llena) o negativo (sobrecupo, p. ej. tras
 * reducir el tope de una sección ya poblada); la función no lo satura.
 *
 * @param tope Cupo máximo de la sección.
 * @param vinculadas Cantidad de alumnas vinculadas a la sección.
 * @returns `tope - vinculadas`.
 */
export function calcularCupos(tope: number, vinculadas: number): number {
  return tope - vinculadas;
}
