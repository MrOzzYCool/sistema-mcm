import { NextRequest, NextResponse } from "next/server";
import { verifyGerenciaAccess } from "@/lib/verify-gerencia-access";
import { validateDateParams } from "@/lib/validate-date-params";
import { supabaseAdmin } from "@/lib/supabase-admin";

/**
 * GET /api/admin/reports/summary
 *
 * Devuelve resumen financiero (KPIs) y últimos 50 vouchers.
 * Query params: from, to (requeridos), carrera, ciclo (opcionales)
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
    return NextResponse.json({ error: dateResult.error }, { status: dateResult.status });
  }

  const { from, to } = dateResult;
  const carrera = searchParams.get("carrera");
  const ciclo = searchParams.get("ciclo");

  try {
    // 3. Query report_financial_summary view with filters
    let summaryQuery = supabaseAdmin
      .from("report_financial_summary")
      .select("month, total_ingresos, total_egresos, carrera_id, ciclo")
      .gte("month", from.slice(0, 7)) // YYYY-MM format comparison
      .lte("month", to.slice(0, 7));

    if (carrera) {
      summaryQuery = summaryQuery.eq("carrera_id", carrera);
    }
    if (ciclo) {
      summaryQuery = summaryQuery.eq("ciclo", Number(ciclo));
    }

    const { data: summaryData, error: summaryError } = await summaryQuery;

    if (summaryError) {
      console.error("[REPORTS/SUMMARY] Error querying financial summary:", summaryError.message);
      return NextResponse.json(
        { error: "Error interno al consultar datos" },
        { status: 500 }
      );
    }

    // 4. Calculate totals from aggregated view data
    const total_pagado = (summaryData ?? []).reduce(
      (sum, row) => sum + Number(row.total_ingresos ?? 0),
      0
    );
    const total_pendiente = (summaryData ?? []).reduce(
      (sum, row) => sum + Number(row.total_egresos ?? 0),
      0
    );

    // total_ingresos and total_egresos in response are same as total_pagado and total_pendiente
    const total_ingresos = total_pagado;
    const total_egresos = total_pendiente;

    // 5. Calculate porcentaje_cobranza with division-by-zero handling
    let porcentaje_cobranza = 0.0;
    const divisor = total_pagado + total_pendiente;
    if (divisor > 0) {
      porcentaje_cobranza = Math.round((total_pagado / divisor) * 1000) / 10;
    }

    // 6. Query report_recent_vouchers view for latest 50 vouchers
    const { data: vouchersData, error: vouchersError } = await supabaseAdmin
      .from("report_recent_vouchers")
      .select("id, alumno_nombre, monto, fecha, status, comprobante_url")
      .limit(50);

    if (vouchersError) {
      console.error("[REPORTS/SUMMARY] Error querying recent vouchers:", vouchersError.message);
      return NextResponse.json(
        { error: "Error interno al consultar datos" },
        { status: 500 }
      );
    }

    // 7. Return response
    return NextResponse.json({
      total_pagado,
      total_pendiente,
      total_ingresos,
      total_egresos,
      porcentaje_cobranza,
      vouchers_recientes: vouchersData ?? [],
    });
  } catch (err) {
    console.error("[REPORTS/SUMMARY] Unexpected error:", err);
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
