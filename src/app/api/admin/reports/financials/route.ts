import { NextRequest, NextResponse } from "next/server";
import { verifyGerenciaAccess } from "@/lib/verify-gerencia-access";
import { validateDateParams } from "@/lib/validate-date-params";
import { supabaseAdmin } from "@/lib/supabase-admin";

/**
 * GET /api/admin/reports/financials
 *
 * Devuelve datos financieros mensuales para el gráfico de líneas.
 * Query params: from, to (requeridos), group_by (debe ser "month"),
 *               ciclo (opcional)
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
  const ciclo = searchParams.get("ciclo");

  try {
    // 4. Query installments joined with payment_plans, filtered by date range
    let query = supabaseAdmin
      .from("installments")
      .select("amount, status, due_date, payment_plans!inner(ciclo)")
      .gte("due_date", `${from}T00:00:00`)
      .lte("due_date", `${to}T23:59:59`);

    if (ciclo) {
      query = query.eq("payment_plans.ciclo", Number(ciclo));
    }

    const { data, error } = await query;

    if (error) {
      console.error("[REPORTS/FINANCIALS] Error querying installments:", JSON.stringify(error));
      return NextResponse.json(
        { error: "Error interno al consultar datos", detail: error.message },
        { status: 500 }
      );
    }

    // 5. Aggregate by month (YYYY-MM from due_date)
    const monthlyMap = new Map<string, { ingresos: number; egresos: number }>();

    for (const row of data ?? []) {
      const dueDate = row.due_date as string;
      if (!dueDate) continue;
      const month = dueDate.slice(0, 7); // YYYY-MM
      const existing = monthlyMap.get(month) ?? { ingresos: 0, egresos: 0 };
      const amount = Number(row.amount ?? 0);

      if (row.status === "paid") {
        existing.ingresos += amount;
      } else if (row.status === "pending" || row.status === "overdue") {
        existing.egresos += amount;
      }

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
