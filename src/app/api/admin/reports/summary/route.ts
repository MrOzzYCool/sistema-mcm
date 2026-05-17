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
  const ciclo = searchParams.get("ciclo");

  try {
    // 3. Query installments joined with payment_plans for financial summary
    let installmentsQuery = supabaseAdmin
      .from("installments")
      .select("amount, status, due_date, plan_id, payment_plans!inner(ciclo)")
      .gte("due_date", `${from}T00:00:00`)
      .lte("due_date", `${to}T23:59:59`);

    if (ciclo) {
      installmentsQuery = installmentsQuery.eq("payment_plans.ciclo", Number(ciclo));
    }

    const { data: installmentsData, error: installmentsError } = await installmentsQuery;

    if (installmentsError) {
      console.error("[REPORTS/SUMMARY] Error querying installments:", JSON.stringify(installmentsError));
      return NextResponse.json(
        { error: "Error interno al consultar datos", detail: installmentsError.message },
        { status: 500 }
      );
    }

    // 4. Calculate totals from raw installments data
    let total_pagado = 0;
    let total_pendiente = 0;

    for (const row of installmentsData ?? []) {
      const amount = Number(row.amount ?? 0);
      if (row.status === "paid") {
        total_pagado += amount;
      } else if (row.status === "pending" || row.status === "overdue") {
        total_pendiente += amount;
      }
    }

    const total_ingresos = total_pagado;
    const total_egresos = total_pendiente;

    // 5. Calculate porcentaje_cobranza with division-by-zero handling
    let porcentaje_cobranza = 0.0;
    const divisor = total_pagado + total_pendiente;
    if (divisor > 0) {
      porcentaje_cobranza = Math.round((total_pagado / divisor) * 1000) / 10;
    }

    // 6. Query recent vouchers with simpler join structure
    const { data: vouchersData, error: vouchersError } = await supabaseAdmin
      .from("payment_vouchers")
      .select(`
        id,
        created_at,
        status,
        installment_id,
        installments(amount, comprobante_url, plan_id)
      `)
      .order("created_at", { ascending: false })
      .limit(50);

    if (vouchersError) {
      console.error("[REPORTS/SUMMARY] Error querying vouchers:", JSON.stringify(vouchersError));
      // Return financial data even if vouchers fail
      return NextResponse.json({
        total_pagado,
        total_pendiente,
        total_ingresos,
        total_egresos,
        porcentaje_cobranza,
        vouchers_recientes: [],
      });
    }

    // 7. Get alumno names for vouchers via payment_plans → profiles
    const planIds = [...new Set(
      (vouchersData ?? [])
        .map((v) => {
          const inst = v.installments as unknown as { plan_id?: string } | null;
          return inst?.plan_id;
        })
        .filter(Boolean)
    )] as string[];

    let alumnoMap: Record<string, string> = {};
    if (planIds.length > 0) {
      const { data: plans } = await supabaseAdmin
        .from("payment_plans")
        .select("id, alumno_id, profiles:alumno_id(nombre_completo)")
        .in("id", planIds);

      for (const plan of plans ?? []) {
        const profile = plan.profiles as unknown as { nombre_completo?: string } | null;
        if (profile?.nombre_completo) {
          alumnoMap[plan.id] = profile.nombre_completo;
        }
      }
    }

    // 8. Transform vouchers data to expected format
    const vouchers_recientes = (vouchersData ?? []).map((v) => {
      const inst = v.installments as unknown as { amount?: number; comprobante_url?: string; plan_id?: string } | null;
      const planId = inst?.plan_id ?? "";

      return {
        id: v.id,
        alumno_nombre: alumnoMap[planId] ?? "—",
        monto: Number(inst?.amount ?? 0),
        fecha: v.created_at,
        status: v.status,
        comprobante_url: inst?.comprobante_url ?? null,
      };
    });

    // 9. Return response
    return NextResponse.json({
      total_pagado,
      total_pendiente,
      total_ingresos,
      total_egresos,
      porcentaje_cobranza,
      vouchers_recientes,
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
