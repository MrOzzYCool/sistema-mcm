import { NextRequest, NextResponse } from "next/server";
import { verifyGerenciaAccess } from "@/lib/verify-gerencia-access";
import { validateDateParams } from "@/lib/validate-date-params";
import { supabaseAdmin } from "@/lib/supabase-admin";

/**
 * GET /api/admin/reports/financials
 *
 * Devuelve datos financieros mensuales para el gráfico de líneas.
 * Query params: from, to (requeridos), group_by (debe ser "month"),
 *               carrera (opcional), ciclo (opcional)
 */
export async function GET(req: NextRequest) {
  // 1. Auth
  const user = await verifyGerenciaAccess(req);
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  // 2. Validar fechas
  const searchParams = req.nextUrl.searchParams;
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

  // 3. Validar group_by
  const groupBy = searchParams.get("group_by");
  if (!groupBy || groupBy !== "month") {
    return NextResponse.json(
      { error: "Parámetro 'group_by' es requerido y debe ser 'month'" },
      { status: 400 }
    );
  }

  const { from, to } = dateResult;
  const carrera = searchParams.get("carrera");
  const ciclo = searchParams.get("ciclo");

  try {
    // 4. Query report_financial_summary view filtered by date range
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
      console.error(
        "[REPORTS/FINANCIALS] Error querying financial summary:",
        error.message
      );
      return NextResponse.json(
        { error: "Error interno al consultar datos" },
        { status: 500 }
      );
    }

    // 5. Aggregate by month (sum total_ingresos and total_egresos across carrera_id/ciclo)
    const monthlyMap = new Map<
      string,
      { ingresos: number; egresos: number }
    >();

    for (const row of data ?? []) {
      const month = row.month as string;
      const existing = monthlyMap.get(month) ?? { ingresos: 0, egresos: 0 };
      existing.ingresos += Number(row.total_ingresos ?? 0);
      existing.egresos += Number(row.total_egresos ?? 0);
      monthlyMap.set(month, existing);
    }

    // 6. Convert to sorted array
    const result = Array.from(monthlyMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, values]) => ({
        month,
        ingresos: values.ingresos,
        egresos: values.egresos,
      }));

    return NextResponse.json({ data: result });
  } catch (err) {
    console.error("[REPORTS/FINANCIALS] Unexpected error:", err);
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
