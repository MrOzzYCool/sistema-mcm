import type { MonthlyFinancial, TramiteRow } from "@/types/gerencia";

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
