import { NextRequest, NextResponse } from "next/server";
import { verifyGerenciaAccess } from "@/lib/verify-gerencia-access";
import { validateDateParams } from "@/lib/validate-date-params";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { generateFinancialCSV, generateTramitesCSV } from "@/lib/csv-generator";
import { generateFinancialPDF, generateTramitesPDF } from "@/lib/pdf-generator";
import type { MonthlyFinancial, TramiteRow } from "@/types/gerencia";

const VALID_TYPES = ["financials", "tramites"] as const;
const VALID_FORMATS = ["csv", "pdf"] as const;

/**
 * GET /api/admin/reports/export
 *
 * Genera y descarga un archivo CSV o PDF con datos financieros o de trámites.
 * Query params: type, format, from, to (requeridos), carrera, ciclo (opcionales)
 */
export async function GET(req: NextRequest) {
  // 1. Auth
  const user = await verifyGerenciaAccess(req);
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  // 2. Validar type y format
  const searchParams = req.nextUrl.searchParams;
  const type = searchParams.get("type");
  const format = searchParams.get("format");

  if (
    !type ||
    !format ||
    !VALID_TYPES.includes(type as typeof VALID_TYPES[number]) ||
    !VALID_FORMATS.includes(format as typeof VALID_FORMATS[number])
  ) {
    return NextResponse.json(
      {
        error:
          "Parámetro inválido: type debe ser 'financials' o 'tramites', format debe ser 'csv' o 'pdf'",
      },
      { status: 400 }
    );
  }

  // 3. Validar fechas
  const dateResult = validateDateParams(
    searchParams.get("from"),
    searchParams.get("to")
  );
  if (!dateResult.valid) {
    return NextResponse.json(
      { error: dateResult.error },
      { status: dateResult.status }
    );
  }

  const { from, to } = dateResult;
  const carrera = searchParams.get("carrera");
  const ciclo = searchParams.get("ciclo");

  try {
    let fileContent: string | Buffer;
    let contentType: string;
    const filename = `reporte-${type}-${from}-${to}.${format}`;

    if (type === "financials") {
      // Query report_financial_summary view filtered by month range
      let query = supabaseAdmin
        .from("report_financial_summary")
        .select("month, total_ingresos, total_egresos, carrera_id, ciclo")
        .gte("month", from.slice(0, 7)) // YYYY-MM format comparison
        .lte("month", to.slice(0, 7));

      if (carrera) {
        query = query.eq("carrera_id", carrera);
      }
      if (ciclo) {
        query = query.eq("ciclo", Number(ciclo));
      }

      const { data, error } = await query;

      if (error) {
        console.error("[REPORTS/EXPORT] Error querying financial data:", error.message);
        return NextResponse.json(
          { error: "Error interno al consultar datos" },
          { status: 500 }
        );
      }

      // Aggregate by month (sum ingresos/egresos across carrera_id/ciclo)
      const monthlyMap = new Map<string, { ingresos: number; egresos: number }>();

      for (const row of data ?? []) {
        const month = row.month as string;
        const existing = monthlyMap.get(month) ?? { ingresos: 0, egresos: 0 };
        existing.ingresos += Number(row.total_ingresos ?? 0);
        existing.egresos += Number(row.total_egresos ?? 0);
        monthlyMap.set(month, existing);
      }

      const financialData: MonthlyFinancial[] = Array.from(monthlyMap.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([month, values]) => ({
          month,
          ingresos: values.ingresos,
          egresos: values.egresos,
        }));

      if (format === "csv") {
        fileContent = generateFinancialCSV(financialData);
        contentType = "text/csv; charset=utf-8";
      } else {
        fileContent = generateFinancialPDF(financialData, { from, to, carrera: carrera ?? undefined, ciclo: ciclo ? Number(ciclo) : undefined });
        contentType = "application/pdf";
      }
    } else {
      // type === "tramites"
      // Query report_tramites_overview view filtered by date range
      let query = supabaseAdmin
        .from("report_tramites_overview")
        .select("id, fecha, tipo_tramite, alumno, costo, estado")
        .gte("fecha", `${from}T00:00:00`)
        .lte("fecha", `${to}T23:59:59`)
        .order("fecha", { ascending: false });

      if (carrera) {
        query = query.eq("carrera", carrera);
      }
      if (ciclo) {
        query = query.eq("ciclo", Number(ciclo));
      }

      const { data, error } = await query;

      if (error) {
        console.error("[REPORTS/EXPORT] Error querying tramites data:", error.message);
        return NextResponse.json(
          { error: "Error interno al consultar datos" },
          { status: 500 }
        );
      }

      const tramitesData: TramiteRow[] = (data ?? []).map((row) => ({
        id: row.id as string,
        fecha: (row.fecha as string).slice(0, 10),
        tipo_tramite: row.tipo_tramite as string,
        alumno: row.alumno as string,
        costo: Number(row.costo ?? 0),
        estado: row.estado as string,
      }));

      if (format === "csv") {
        fileContent = generateTramitesCSV(tramitesData);
        contentType = "text/csv; charset=utf-8";
      } else {
        fileContent = generateTramitesPDF(tramitesData, { from, to, carrera: carrera ?? undefined, ciclo: ciclo ? Number(ciclo) : undefined });
        contentType = "application/pdf";
      }
    }

    // Return file response with appropriate headers
    const body: BodyInit = typeof fileContent === "string"
      ? fileContent
      : new Uint8Array(fileContent);

    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    console.error("[REPORTS/EXPORT] Unexpected error:", err);
    return NextResponse.json(
      { error: "Error interno al consultar datos" },
      { status: 500 }
    );
  }
}

// ─── Non-GET methods return 405 ─────────────────────────────────────────────

function methodNotAllowed() {
  return new NextResponse(null, {
    status: 405,
    headers: { Allow: "GET" },
  });
}

export function POST() {
  return methodNotAllowed();
}

export function PUT() {
  return methodNotAllowed();
}

export function PATCH() {
  return methodNotAllowed();
}

export function DELETE() {
  return methodNotAllowed();
}
