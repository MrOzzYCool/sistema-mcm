import { NextRequest, NextResponse } from "next/server";
import { verifyGerenciaAccess } from "@/lib/verify-gerencia-access";
import { validateDateParams } from "@/lib/validate-date-params";
import { supabaseAdmin } from "@/lib/supabase-admin";

/**
 * GET /api/admin/reports/financials
 *
 * Devuelve datos financieros mensuales + detalle de cuotas por alumno.
 * Query params: from, to (requeridos), group_by=month (requerido),
 *               carrera (opcional, nombre_carrera), ciclo (opcional)
 *               page, limit (opcionales, para detalle)
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
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const limit = Math.min(50, Math.max(1, Number(searchParams.get("limit")) || 50));
  const offset = (page - 1) * limit;

  try {
    // 4. Step 1: Query installments with payment_plans (simple join)
    let query = supabaseAdmin
      .from("installments")
      .select("id, amount, status, due_date, concepto, plan_id, payment_plans!inner(id, alumno_id, ciclo)")
      .gte("due_date", `${from}T00:00:00`)
      .lte("due_date", `${to}T23:59:59`)
      .order("due_date", { ascending: false });

    if (ciclo) {
      query = query.eq("payment_plans.ciclo", Number(ciclo));
    }

    const { data: installmentsData, error: installmentsError } = await query;

    if (installmentsError) {
      console.error("[REPORTS/FINANCIALS] Supabase error:", JSON.stringify(installmentsError));
      return NextResponse.json(
        { error: "Error interno al consultar datos", detail: installmentsError.message, code: installmentsError.code },
        { status: 500 }
      );
    }

    // 5. Step 2: Get unique alumno_ids to resolve names and carreras
    const alumnoIds = [...new Set(
      (installmentsData ?? []).map((row) => {
        const plan = row.payment_plans as unknown as { alumno_id?: string } | null;
        return plan?.alumno_id;
      }).filter(Boolean)
    )] as string[];

    // Resolve alumno names from profiles
    let alumnoNameMap: Record<string, string> = {};
    if (alumnoIds.length > 0) {
      const { data: profiles } = await supabaseAdmin
        .from("profiles")
        .select("id, nombre_completo")
        .in("id", alumnoIds);

      for (const p of profiles ?? []) {
        alumnoNameMap[p.id] = p.nombre_completo ?? "—";
      }
    }

    // Resolve carrera names from inscripciones → carreras
    let alumnoCarreraMap: Record<string, string> = {};
    if (alumnoIds.length > 0) {
      const { data: inscripciones } = await supabaseAdmin
        .from("inscripciones")
        .select("alumno_id, carreras:carrera_id(nombre_carrera)")
        .in("alumno_id", alumnoIds);

      for (const insc of inscripciones ?? []) {
        const carreraObj = insc.carreras as unknown as { nombre_carrera?: string } | null;
        if (carreraObj?.nombre_carrera) {
          alumnoCarreraMap[insc.alumno_id] = carreraObj.nombre_carrera;
        }
      }
    }

    // 6. Process data: aggregate monthly + build detail items
    const monthlyMap = new Map<string, { ingresos: number; egresos: number }>();

    interface DetailItem {
      id: string;
      alumno: string;
      carrera: string;
      ciclo: number;
      concepto: string;
      monto: number;
      estado: string;
      due_date: string;
    }

    const allItems: DetailItem[] = [];

    for (const row of installmentsData ?? []) {
      const dueDate = row.due_date as string;
      if (!dueDate) continue;

      const amount = Number(row.amount ?? 0);
      const plan = row.payment_plans as unknown as { alumno_id?: string; ciclo?: number } | null;
      const alumnoId = plan?.alumno_id ?? "";
      const cicloNum = plan?.ciclo ?? 0;
      const alumnoNombre = alumnoNameMap[alumnoId] ?? "—";
      const carreraNombre = alumnoCarreraMap[alumnoId] ?? "—";

      // Apply carrera filter
      if (carrera && carreraNombre !== carrera) continue;

      const month = dueDate.slice(0, 7);
      const existing = monthlyMap.get(month) ?? { ingresos: 0, egresos: 0 };
      if (row.status === "paid") {
        existing.ingresos += amount;
      } else if (row.status === "pending" || row.status === "overdue") {
        existing.egresos += amount;
      }
      monthlyMap.set(month, existing);

      allItems.push({
        id: row.id as string,
        alumno: alumnoNombre,
        carrera: carreraNombre,
        ciclo: cicloNum,
        concepto: (row.concepto as string) ?? "Cuota",
        monto: amount,
        estado: row.status as string,
        due_date: dueDate.slice(0, 10),
      });
    }

    // 7. Convert monthly to sorted array
    const monthlySummary = Array.from(monthlyMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, values]) => ({
        month,
        ingresos: values.ingresos,
        egresos: values.egresos,
      }));

    // 8. Paginate detail items
    const total = allItems.length;
    const paginatedItems = allItems.slice(offset, offset + limit);

    return NextResponse.json({
      data: monthlySummary,
      detail: {
        items: paginatedItems,
        total,
        page,
        limit,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[REPORTS/FINANCIALS] Unexpected error:", message, err);
    return NextResponse.json(
      { error: "Error interno al consultar datos", detail: message },
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

export function POST() { return methodNotAllowed(); }
export function PUT() { return methodNotAllowed(); }
export function PATCH() { return methodNotAllowed(); }
export function DELETE() { return methodNotAllowed(); }
