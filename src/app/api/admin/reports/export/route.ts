import { NextRequest, NextResponse } from "next/server";
import { verifyGerenciaAccess } from "@/lib/verify-gerencia-access";
import { validateDateParams } from "@/lib/validate-date-params";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { generateFinancialDetailCSV, generateTramitesCSV } from "@/lib/csv-generator";
import type { FinancialDetailRow } from "@/lib/csv-generator";
import { generateFinancialDetailPDF, generateTramitesPDF } from "@/lib/pdf-generator";
import type { TramiteRow } from "@/types/gerencia";

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
      // Query installments with full detail joins for export
      let query = supabaseAdmin
        .from("installments")
        .select(`
          id, amount, status, due_date, concepto,
          payment_plans!inner(
            alumno_id, ciclo,
            profiles:alumno_id(nombre_completo),
            inscripciones:alumno_id(carrera_id, carreras:carrera_id(nombre_carrera))
          )
        `)
        .gte("due_date", `${from}T00:00:00`)
        .lte("due_date", `${to}T23:59:59`)
        .order("due_date", { ascending: false });

      if (ciclo) {
        query = query.eq("payment_plans.ciclo", Number(ciclo));
      }

      const { data, error } = await query;

      if (error) {
        console.error("[REPORTS/EXPORT] Error querying financial data:", error.message);
        return NextResponse.json(
          { error: "Error interno al consultar datos" },
          { status: 500 }
        );
      }

      // Transform to detail rows
      const detailData: FinancialDetailRow[] = [];

      for (const row of data ?? []) {
        const plan = row.payment_plans as unknown as {
          ciclo?: number;
          profiles?: { nombre_completo?: string } | { nombre_completo?: string }[] | null;
          inscripciones?: Array<{ carreras?: { nombre_carrera?: string } | { nombre_carrera?: string }[] | null }> | null;
        } | null;

        let alumnoNombre = "—";
        let carreraNombre = "—";

        if (plan) {
          const profiles = plan.profiles;
          if (Array.isArray(profiles)) {
            alumnoNombre = profiles[0]?.nombre_completo ?? "—";
          } else if (profiles) {
            alumnoNombre = profiles.nombre_completo ?? "—";
          }

          const inscripciones = plan.inscripciones;
          if (Array.isArray(inscripciones) && inscripciones.length > 0) {
            const carreras = inscripciones[0].carreras;
            if (Array.isArray(carreras)) {
              carreraNombre = carreras[0]?.nombre_carrera ?? "—";
            } else if (carreras) {
              carreraNombre = carreras.nombre_carrera ?? "—";
            }
          }
        }

        // Apply carrera filter
        if (carrera && carreraNombre !== carrera && carreraNombre !== "—") continue;

        detailData.push({
          alumno: alumnoNombre,
          carrera: carreraNombre,
          ciclo: plan?.ciclo ?? 0,
          concepto: (row.concepto as string) ?? "Cuota",
          monto: Number(row.amount ?? 0),
          estado: row.status as string,
          due_date: (row.due_date as string).slice(0, 10),
        });
      }

      if (format === "csv") {
        fileContent = generateFinancialDetailCSV(detailData);
        contentType = "text/csv; charset=utf-8";
      } else {
        fileContent = generateFinancialDetailPDF(detailData, { from, to, carrera: carrera ?? undefined, ciclo: ciclo ? Number(ciclo) : undefined });
        contentType = "application/pdf";
      }
    } else {
      // type === "tramites"
      // Query solicitudes directly filtered by date range
      let query = supabaseAdmin
        .from("solicitudes")
        .select("id, created_at, tipo_tramite, nombres, apellidos, monto_pagado, estado")
        .gte("created_at", `${from}T00:00:00`)
        .lte("created_at", `${to}T23:59:59`)
        .order("created_at", { ascending: false });

      if (carrera) {
        query = query.eq("carrera", carrera);
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
        fecha: (row.created_at as string).slice(0, 10),
        tipo_tramite: (row.tipo_tramite as string) ?? "",
        alumno: `${row.nombres ?? ""} ${row.apellidos ?? ""}`.trim(),
        costo: Number(row.monto_pagado ?? 0),
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
