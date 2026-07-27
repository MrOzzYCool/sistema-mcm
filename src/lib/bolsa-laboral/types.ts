// ─── Tipos del módulo Bolsa Laboral ──────────────────────────────────────────

export type ModalidadOferta = 'presencial' | 'remoto' | 'hibrido';
export type EstadoOferta = 'pendiente' | 'activa' | 'cerrada' | 'rechazada';
export type EstadoSolicitud = 'pendiente' | 'aprobada' | 'rechazada';
export type EstadoPostulacion = 'enviada' | 'vista' | 'seleccionada' | 'descartada';

export interface OfertaLaboral {
  id: string;
  empresa_nombre: string;
  empresa_contacto: string;
  puesto: string;
  descripcion: string;
  requisitos: string | null;
  sueldo_min: number | null;
  sueldo_max: number | null;
  modalidad: ModalidadOferta;
  ubicacion: string | null;
  estado: EstadoOferta;
  fecha_publicacion: string | null;
  fecha_cierre: string | null;
  created_at: string;
  postulaciones_count?: number;
}

export interface SolicitudAcceso {
  id: string;
  alumna_nombre: string;
  alumna_dni: string;
  alumna_email: string;
  alumna_telefono: string | null;
  carrera: string;
  anio_ingreso: number;
  anio_egreso: number;
  estado: EstadoSolicitud;
  motivo_rechazo: string | null;
  aprobada_por: string | null;
  created_at: string;
}

export interface Postulacion {
  id: string;
  oferta_id: string;
  alumna_id: string;
  mensaje: string | null;
  cv_url: string | null;
  estado: EstadoPostulacion;
  created_at: string;
  // Joined fields
  oferta?: Pick<OfertaLaboral, 'puesto' | 'empresa_nombre'>;
  alumna_nombre?: string;
}
