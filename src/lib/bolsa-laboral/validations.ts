import { ModalidadOferta } from './types';

// ─── Form Data Interfaces ────────────────────────────────────────────────────

export interface OfertaFormData {
  empresa_nombre: string;
  empresa_contacto: string;
  puesto: string;
  descripcion: string;
  requisitos?: string;
  sueldo_min?: number;
  sueldo_max?: number;
  modalidad: ModalidadOferta;
  ubicacion?: string;
  fecha_cierre?: string;
}

export interface SolicitudFormData {
  alumna_nombre: string;
  alumna_dni: string;
  alumna_email: string;
  alumna_telefono?: string;
  carrera: string;
  anio_ingreso: number;
  anio_egreso: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const VALID_MODALIDADES: ModalidadOferta[] = ['presencial', 'remoto', 'hibrido'];

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function getTomorrow(): Date {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  return tomorrow;
}

// ─── Validation Functions ────────────────────────────────────────────────────

/**
 * Validates oferta form data.
 * Returns a field → error message map. An empty object means no errors.
 */
export function validateOferta(data: Partial<OfertaFormData>): Record<string, string> {
  const errors: Record<string, string> = {};

  // empresa_nombre: required, non-empty
  if (!data.empresa_nombre || data.empresa_nombre.trim() === '') {
    errors.empresa_nombre = 'El nombre de la empresa es requerido';
  }

  // empresa_contacto: required, valid email format
  if (!data.empresa_contacto || data.empresa_contacto.trim() === '') {
    errors.empresa_contacto = 'El email de contacto es requerido';
  } else if (!isValidEmail(data.empresa_contacto.trim())) {
    errors.empresa_contacto = 'El email de contacto no tiene un formato válido';
  }

  // puesto: required, non-empty
  if (!data.puesto || data.puesto.trim() === '') {
    errors.puesto = 'El puesto es requerido';
  }

  // descripcion: required, minimum 50 characters
  if (!data.descripcion || data.descripcion.trim() === '') {
    errors.descripcion = 'La descripción es requerida';
  } else if (data.descripcion.trim().length < 50) {
    errors.descripcion = 'La descripción debe tener al menos 50 caracteres';
  }

  // modalidad: required, must be one of valid values
  if (!data.modalidad) {
    errors.modalidad = 'La modalidad es requerida';
  } else if (!VALID_MODALIDADES.includes(data.modalidad)) {
    errors.modalidad = 'La modalidad debe ser presencial, remoto o híbrido';
  }

  // sueldo_min / sueldo_max: if both provided, sueldo_min <= sueldo_max
  if (
    data.sueldo_min !== undefined &&
    data.sueldo_min !== null &&
    data.sueldo_max !== undefined &&
    data.sueldo_max !== null
  ) {
    if (data.sueldo_min > data.sueldo_max) {
      errors.sueldo_min = 'El sueldo mínimo no puede ser mayor al sueldo máximo';
    }
  }

  // fecha_cierre: if provided, must be tomorrow or later
  if (data.fecha_cierre && data.fecha_cierre.trim() !== '') {
    const fechaCierre = new Date(data.fecha_cierre);
    const tomorrow = getTomorrow();
    if (fechaCierre < tomorrow) {
      errors.fecha_cierre = 'La fecha de cierre debe ser mañana o posterior';
    }
  }

  return errors;
}

/**
 * Validates solicitud de acceso form data.
 * Returns a field → error message map. An empty object means no errors.
 */
export function validateSolicitud(data: Partial<SolicitudFormData>): Record<string, string> {
  const errors: Record<string, string> = {};
  const currentYear = new Date().getFullYear();

  // alumna_nombre: required, non-empty
  if (!data.alumna_nombre || data.alumna_nombre.trim() === '') {
    errors.alumna_nombre = 'El nombre es requerido';
  }

  // alumna_dni: required, exactly 8 digits
  if (!data.alumna_dni || data.alumna_dni.trim() === '') {
    errors.alumna_dni = 'El DNI es requerido';
  } else if (!/^\d{8}$/.test(data.alumna_dni.trim())) {
    errors.alumna_dni = 'El DNI debe tener exactamente 8 dígitos';
  }

  // alumna_email: required, valid email format
  if (!data.alumna_email || data.alumna_email.trim() === '') {
    errors.alumna_email = 'El email es requerido';
  } else if (!isValidEmail(data.alumna_email.trim())) {
    errors.alumna_email = 'El email no tiene un formato válido';
  }

  // carrera: required, non-empty
  if (!data.carrera || data.carrera.trim() === '') {
    errors.carrera = 'La carrera es requerida';
  }

  // anio_ingreso: required, 4-digit year between 2000 and current year
  if (data.anio_ingreso === undefined || data.anio_ingreso === null) {
    errors.anio_ingreso = 'El año de ingreso es requerido';
  } else if (data.anio_ingreso < 2000 || data.anio_ingreso > currentYear) {
    errors.anio_ingreso = `El año de ingreso debe estar entre 2000 y ${currentYear}`;
  }

  // anio_egreso: required, >= anio_ingreso and <= current year + 1
  if (data.anio_egreso === undefined || data.anio_egreso === null) {
    errors.anio_egreso = 'El año de egreso es requerido';
  } else if (
    data.anio_ingreso !== undefined &&
    data.anio_ingreso !== null &&
    data.anio_egreso < data.anio_ingreso
  ) {
    errors.anio_egreso = 'El año de egreso no puede ser anterior al año de ingreso';
  } else if (data.anio_egreso > currentYear + 1) {
    errors.anio_egreso = `El año de egreso no puede ser mayor a ${currentYear + 1}`;
  }

  return errors;
}
