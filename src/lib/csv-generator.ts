import type { MonthlyFinancial, TramiteRow } from "@/types/gerencia";

export interface FinancialDetailRow {
  alumno: string;
  carrera: string;
  ciclo: number;
  concepto: string;
  monto: number;
  estado: string;
  due_date: string;
}

/**
 * Escapes a CSV field value. If the field contains commas, double quotes,
 * or newlines, it wraps the value in double quotes and escapes internal
 * quotes by doubling them.
 */
function escapeCSVField(value: string): string {
  if (
    value.includes(",") ||
    value.includes('"') ||
    value.includes("\n") ||
    value.includes("\r")
  ) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Generates a CSV string from monthly financial data.
 * Format: Mes,Ingresos (S/),Egresos (S/)
 */
export function generateFinancialCSV(data: MonthlyFinancial[]): string {
  const header = "Mes,Ingresos (S/),Egresos (S/)";
  const rows = data.map(
    (r) =>
      `${escapeCSVField(r.month)},${r.ingresos.toFixed(2)},${r.egresos.toFixed(2)}`
  );
  return [header, ...rows].join("\n");
}

/**
 * Generates a CSV string from financial detail data (per-alumno).
 */
export function generateFinancialDetailCSV(data: FinancialDetailRow[]): string {
  const header = "Alumno,Carrera,Ciclo,Concepto,Monto (S/),Estado,Fecha Vencimiento";
  const statusLabels: Record<string, string> = { paid: "Pagado", pending: "Pendiente", overdue: "Vencido", in_review: "En revisión" };
  const rows = data.map(
    (r) =>
      `${escapeCSVField(r.alumno)},${escapeCSVField(r.carrera)},${r.ciclo},${escapeCSVField(r.concepto)},${r.monto.toFixed(2)},${escapeCSVField(statusLabels[r.estado] ?? r.estado)},${escapeCSVField(r.due_date)}`
  );
  return [header, ...rows].join("\n");
}

/**
 * Generates a CSV string from tramites data.
 * Format: Fecha,Tipo de Trámite,Alumno,Costo (S/),Estado
 */
export function generateTramitesCSV(data: TramiteRow[]): string {
  const header = "Fecha,Tipo de Trámite,Alumno,Costo (S/),Estado";
  const rows = data.map(
    (r) =>
      `${escapeCSVField(r.fecha)},${escapeCSVField(r.tipo_tramite)},${escapeCSVField(r.alumno)},${r.costo.toFixed(2)},${escapeCSVField(r.estado)}`
  );
  return [header, ...rows].join("\n");
}
