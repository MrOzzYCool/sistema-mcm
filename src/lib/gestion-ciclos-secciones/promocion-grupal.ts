// Feature: gestion-ciclos-secciones
// Lógica pura de decisión para la promoción grupal de una sección.
// Estas funciones NO acceden a la base de datos: son la lógica de decisión
// que el endpoint de cierre/promoción reutiliza.
// Requisitos: 6.3, 6.4, 9.1, 9.2, 10.1

// Tipos del módulo (reexportados para conveniencia del endpoint consumidor).
export type { PromocionGrupalResult } from "./types";

/**
 * Decide si una alumna debe ser promovida al siguiente ciclo o egresar.
 *
 * Una alumna egresa cuando ya cursó el último ciclo de su carrera, es decir
 * cuando su `cicloActual` alcanza o supera la `duracionCiclos` de la carrera.
 * En cualquier otro caso, corresponde promoverla.
 *
 * @param cicloActual Ciclo que la alumna acaba de completar (1-based).
 * @param duracionCiclos Cantidad total de ciclos que tiene la carrera.
 * @returns `"egreso"` si `cicloActual >= duracionCiclos`, de lo contrario `"promover"`.
 */
export function decidirPromocion(
  cicloActual: number,
  duracionCiclos: number
): "promover" | "egreso" {
  return cicloActual >= duracionCiclos ? "egreso" : "promover";
}

/**
 * Calcula el nuevo número de ciclo resultante de aplicar la promoción.
 *
 * Si la decisión es `"promover"`, avanza un ciclo (`cicloActual + 1`).
 * Si la decisión es `"egreso"`, el ciclo permanece sin cambios porque la
 * alumna no avanza (se marca como egresada sin plan ni cursos nuevos).
 *
 * @param cicloActual Ciclo que la alumna acaba de completar (1-based).
 * @param duracionCiclos Cantidad total de ciclos que tiene la carrera.
 * @returns `cicloActual + 1` cuando corresponde promover; `cicloActual` cuando egresa.
 */
export function nuevoCiclo(cicloActual: number, duracionCiclos: number): number {
  return decidirPromocion(cicloActual, duracionCiclos) === "promover"
    ? cicloActual + 1
    : cicloActual;
}

/** Forma mínima de una cuota necesaria para detectar deuda pendiente. */
export interface CuotaLite {
  /** Estado de la cuota (p. ej. `paid`, `pending`, `exonerado`). */
  status: string;
  /** Fecha de vencimiento en formato `YYYY-MM-DD`. */
  due_date: string;
}

/**
 * Determina si una alumna tiene deuda pendiente (`Deuda_Pendiente`).
 *
 * Se considera deuda pendiente cuando existe al menos una cuota que a la vez:
 *  - no está pagada (`status` distinto de `paid`), y
 *  - no está exonerada (`status` distinto de `exonerado`), y
 *  - ya está vencida (`due_date` anterior a `hoy`).
 *
 * @param cuotas Cuotas de la alumna a evaluar.
 * @param hoy Fecha de referencia para el vencimiento. Por defecto, `new Date()`.
 * @returns `true` si hay al menos una cuota impaga y vencida; `false` en caso contrario.
 */
export function detectarDeudaPendiente(cuotas: CuotaLite[], hoy: Date = new Date()): boolean {
  return cuotas.some(
    (cuota) =>
      cuota.status !== "paid" &&
      cuota.status !== "exonerado" &&
      new Date(cuota.due_date) < hoy
  );
}
