import { jsPDF } from "jspdf";
import type {
  MonthlyFinancial,
  TramiteRow,
  GerenciaFilters,
} from "@/types/gerencia";

const INSTITUTION_NAME = "I.E.S. Privada Margarita Cabrera";
const PAGE_MARGIN = 20;
const LINE_HEIGHT = 8;
const HEADER_FONT_SIZE = 16;
const SUBTITLE_FONT_SIZE = 10;
const TABLE_FONT_SIZE = 9;

function addHeader(doc: jsPDF, title: string, filters: GerenciaFilters): number {
  doc.setFontSize(HEADER_FONT_SIZE);
  doc.text(title, PAGE_MARGIN, 20);

  doc.setFontSize(SUBTITLE_FONT_SIZE);
  doc.text(`Periodo: ${filters.from} a ${filters.to}`, PAGE_MARGIN, 30);

  return 45;
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

  // Table header
  doc.setFontSize(TABLE_FONT_SIZE);
  doc.setFont("helvetica", "bold");
  doc.text("Mes", PAGE_MARGIN, y);
  doc.text("Ingresos (S/)", 70, y);
  doc.text("Egresos (S/)", 130, y);
  doc.setFont("helvetica", "normal");

  // Table rows
  for (const row of data) {
    y += LINE_HEIGHT;
    y = checkPageOverflow(doc, y);
    doc.text(row.month, PAGE_MARGIN, y);
    doc.text(row.ingresos.toFixed(2), 70, y);
    doc.text(row.egresos.toFixed(2), 130, y);
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

  // Table header
  doc.setFontSize(TABLE_FONT_SIZE);
  doc.setFont("helvetica", "bold");
  doc.text("Fecha", PAGE_MARGIN, y);
  doc.text("Tipo", 50, y);
  doc.text("Alumno", 100, y);
  doc.text("Costo (S/)", 150, y);
  doc.text("Estado", 180, y);
  doc.setFont("helvetica", "normal");

  // Table rows
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
