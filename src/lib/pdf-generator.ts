import { jsPDF } from "jspdf";
import type {
  MonthlyFinancial,
  TramiteRow,
  GerenciaFilters,
} from "@/types/gerencia";
import type { FinancialDetailRow } from "@/lib/csv-generator";

const INSTITUTION_NAME = "I.E.S. Privada Margarita Cabrera";
const PAGE_MARGIN = 14;
const LINE_HEIGHT = 7;
const HEADER_FONT_SIZE = 14;
const SUBTITLE_FONT_SIZE = 10;
const TABLE_FONT_SIZE = 8;

function addHeader(doc: jsPDF, title: string, filters: GerenciaFilters): number {
  doc.setFontSize(HEADER_FONT_SIZE);
  doc.text(title, PAGE_MARGIN, 20);

  doc.setFontSize(SUBTITLE_FONT_SIZE);
  doc.text(`Periodo: ${filters.from} a ${filters.to}`, PAGE_MARGIN, 28);

  return 40;
}

function checkPageOverflow(doc: jsPDF, y: number): number {
  const pageHeight = doc.internal.pageSize.getHeight();
  if (y >= pageHeight - PAGE_MARGIN) {
    doc.addPage();
    return PAGE_MARGIN + 10;
  }
  return y;
}

export function generateFinancialPDF(
  data: MonthlyFinancial[],
  filters: GerenciaFilters
): Buffer {
  const doc = new jsPDF();

  const title = `Reporte Financiero - ${INSTITUTION_NAME}`;
  let y = addHeader(doc, title, filters);

  doc.setFontSize(TABLE_FONT_SIZE);
  doc.setFont("helvetica", "bold");
  doc.text("Mes", PAGE_MARGIN, y);
  doc.text("Ingresos (S/)", 70, y);
  doc.text("Egresos (S/)", 130, y);
  doc.setFont("helvetica", "normal");

  for (const row of data) {
    y += LINE_HEIGHT;
    y = checkPageOverflow(doc, y);
    doc.text(row.month, PAGE_MARGIN, y);
    doc.text(row.ingresos.toFixed(2), 70, y);
    doc.text(row.egresos.toFixed(2), 130, y);
  }

  return Buffer.from(doc.output("arraybuffer"));
}

const STATUS_LABELS: Record<string, string> = { paid: "Pagado", pending: "Pendiente", overdue: "Vencido", in_review: "En revisión" };

export function generateFinancialDetailPDF(
  data: FinancialDetailRow[],
  filters: GerenciaFilters
): Buffer {
  const doc = new jsPDF({ orientation: "landscape" });

  const title = `Detalle Financiero por Alumno - ${INSTITUTION_NAME}`;
  let y = addHeader(doc, title, filters);

  doc.setFontSize(TABLE_FONT_SIZE);
  doc.setFont("helvetica", "bold");
  doc.text("Alumno", PAGE_MARGIN, y);
  doc.text("Carrera", 60, y);
  doc.text("Ciclo", 120, y);
  doc.text("Concepto", 140, y);
  doc.text("Monto", 190, y);
  doc.text("Estado", 220, y);
  doc.text("Vencimiento", 250, y);
  doc.setFont("helvetica", "normal");

  for (const row of data) {
    y += LINE_HEIGHT;
    y = checkPageOverflow(doc, y);
    doc.text(row.alumno.substring(0, 25), PAGE_MARGIN, y);
    doc.text(row.carrera.substring(0, 30), 60, y);
    doc.text(String(row.ciclo), 120, y);
    doc.text(row.concepto.substring(0, 20), 140, y);
    doc.text(row.monto.toFixed(2), 190, y);
    doc.text(STATUS_LABELS[row.estado] ?? row.estado, 220, y);
    doc.text(row.due_date, 250, y);
  }

  return Buffer.from(doc.output("arraybuffer"));
}

export function generateTramitesPDF(
  data: TramiteRow[],
  filters: GerenciaFilters
): Buffer {
  const doc = new jsPDF();

  const title = `Reporte de Trámites - ${INSTITUTION_NAME}`;
  let y = addHeader(doc, title, filters);

  doc.setFontSize(TABLE_FONT_SIZE);
  doc.setFont("helvetica", "bold");
  doc.text("Fecha", PAGE_MARGIN, y);
  doc.text("Tipo", 50, y);
  doc.text("Alumno", 100, y);
  doc.text("Costo (S/)", 150, y);
  doc.text("Estado", 180, y);
  doc.setFont("helvetica", "normal");

  for (const row of data) {
    y += LINE_HEIGHT;
    y = checkPageOverflow(doc, y);
    doc.text(row.fecha, PAGE_MARGIN, y);
    doc.text(row.tipo_tramite.substring(0, 25), 50, y);
    doc.text(row.alumno.substring(0, 25), 100, y);
    doc.text(row.costo.toFixed(2), 150, y);
    doc.text(row.estado, 180, y);
  }

  return Buffer.from(doc.output("arraybuffer"));
}
