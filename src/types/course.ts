// ─── Tipos del Aula Virtual ──────────────────────────────────────────────────

export interface Course {
  id: string;
  nombre_curso: string;
  ciclo_perteneciente: number;
  creditos: number;
  // Campos del aula virtual
  codigo: string | null;
  nombre: string | null;
  profesor: string | null;
  progreso: number | null;
  modalidad: string | null;
  periodo: string | null;
  carrera: string | null;
  imagen_url: string | null;
}

export interface ContenidoSemana {
  id: string;
  curso_id: string;
  semana: number;
  titulo: string;
  tipo: string; // "pdf" | "video" | "link"
  url: string;
  created_at: string;
}

export interface Tarea {
  id: string;
  curso_id: string;
  titulo: string;
  fecha_entrega: string;
  estado: string; // "pendiente" | "entregado" | "vencido"
  created_at: string;
}
