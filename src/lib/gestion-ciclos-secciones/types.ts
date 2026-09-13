// Feature: gestion-ciclos-secciones
// Formas TypeScript del módulo de gestión de ciclos y secciones.
// Requisitos: 2.1, 2.2, 5.1

/** Sección/apertura de ciclo (`cycle_openings`). */
export interface CycleOpening {
  id: string;
  cycle_number: number;
  status: "activo" | "llena" | "concluido" | "suspendido";
  start_date: string; // YYYY-MM-DD
  fecha_fin: string | null;
  seccion: number;
  tope: number;
  carrera_id: string;
  created_by: string;
  created_at: string;
}

/** Inscripción de una alumna a una sección (`inscripciones`). */
export interface Inscripcion {
  id: string;
  alumno_id: string;
  carrera_id: string;
  ciclo_actual: number;
  fecha_inicio_ciclo: string;
  fecha_matricula: string;
  estado: "activo" | "egresado";
  cycle_opening_id: string | null;
  created_at: string;
}

/** Respuesta de la RPC `enroll_into_opening`. */
export interface EnrollResult {
  inscripcion_id: string;
  vinculadas: number;
  tope: number;
  status: "activo" | "llena";
}

/** Resultado de la promoción grupal de una sección. */
export interface PromocionGrupalResult {
  opening_id: string;
  total_activas: number;
  promovidas: Array<{ alumno_id: string; ciclo_nuevo: number; con_deuda: boolean }>;
  egresadas: string[];
  omitidas: string[];
  errores: Array<{ alumno_id: string; error: string }>;
  advertencias_deuda: string[];
  status_final: "concluido";
}
