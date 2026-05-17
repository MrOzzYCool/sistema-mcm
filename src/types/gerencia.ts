// ─── Tipos del Módulo Gerencia ──────────────────────────────────────────────

export interface FinancialSummary {
  total_pagado: number;
  total_pendiente: number;
  total_ingresos: number;
  total_egresos: number;
  porcentaje_cobranza: number;
}

export interface MonthlyFinancial {
  month: string; // YYYY-MM
  ingresos: number;
  egresos: number;
}

export interface TramitesCounts {
  pendiente: number;
  aprobado: number;
  observado: number;
  rechazado: number;
}

export interface TramiteRow {
  id: string;
  fecha: string;
  tipo_tramite: string;
  alumno: string;
  costo: number;
  estado: string;
}

export interface VoucherRow {
  id: string;
  alumno_nombre: string;
  monto: number;
  fecha: string;
  status: string;
  comprobante_url: string | null;
}

export interface GerenciaFilters {
  from: string; // YYYY-MM-DD
  to: string;   // YYYY-MM-DD
  carrera?: string;
  ciclo?: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}
