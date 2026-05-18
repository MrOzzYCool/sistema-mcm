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
    // 4. Query installments with full joins for detail
    // installments → payment_plans (alumno_id, ciclo) → profiles (nombre_completo)
    // Also get inscripciones → carreras for carrera name
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
      console.error("[REPORTS/FINANCIALS] Error querying installments:", JSON.stringify(error));
      return NextResponse.json(
        { error: "Error interno al consultar datos", detail: error.message },
        { status: 500 }
      );
    }

    // 5. Process data: aggregate monthly + build detail items
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

    for (const row of data ?? []) {
      const dueDate = row.due_date as string;
      if (!dueDate) continue;

      const amount = Number(row.amount ?? 0);
      const month = dueDate.slice(0, 7);

      // Monthly aggregation
      const existing = monthlyMap.get(month) ?? { ingresos: 0, egresos: 0 };
      if (row.status === "paid") {
        existing.ingresos += amount;
      } else if (row.status === "pending" || row.status === "overdue") {
        existing.egresos += amount;
      }
      monthlyMap.set(month, existing);

      // Extract detail info from nested joins
      const plan = row.payment_plans as unknown as {
        alumno_id?: string;
        ciclo?: number;
        profiles?: { nombre_completo?: string } | { nombre_completo?: string }[] | null;
        inscripciones?: Array<{ carrera_id?: string; carreras?: { nombre_carrera?: string } | { nombre_carrera?: string }[] | null }> | null;
      } | null;

      let alumnoNombre = "—";
      let carreraNombre = "—";
      let cicloNum = 0;

      if (plan) {
        cicloNum = plan.ciclo ?? 0;

        // profiles can be object or array depending on Supabase response
        const profiles = plan.profiles;
        if (Array.isArray(profiles)) {
          alumnoNombre = profiles[0]?.nombre_completo ?? "—";
        } else if (profiles) {
          alumnoNombre = profiles.nombre_completo ?? "—";
        }

        // inscripciones is an array
        const inscripciones = plan.inscripciones;
        if (Array.isArray(inscripciones) && inscripciones.length > 0) {
          const insc = inscripciones[0];
          const carreras = insc.carreras;
          if (Array.isArray(carreras)) {
            carreraNombre = carreras[0]?.nombre_carrera ?? "—";
          } else if (carreras) {
            carreraNombre = carreras.nombre_carrera ?? "—";
          }
        }
      }

      // Apply carrera filter client-side (since it's a nested join)
      if (carrera && carreraNombre !== carrera && carreraNombre !== "—") {
        // Remove from monthly aggregation
        if (row.status === "paid") {
          existing.ingresos -= amount;
        } else if (row.status === "pending" || row.status === "overdue") {
          existing.egresos -= amount;
        }
        monthlyMap.set(month, existing);
        continue;
      }

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

    // If carrera filter was applied, recalculate monthly from filtered items
    if (carrera) {
      monthlyMap.clear();
      for (const item of allItems) {
        const month = item.due_date.slice(0, 7);
        const existing = monthlyMap.get(month) ?? { ingresos: 0, egresos: 0 };
        if (item.estado === "paid") {
          existing.ingresos += item.monto;
        } else if (item.estado === "pending" || item.estado === "overdue") {
          existing.egresos += item.monto;
        }
        monthlyMap.set(month, existing);
      }
    }

    // 6. Convert monthly to sorted array
    const monthlySummary = Array.from(monthlyMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, values]) => ({
        month,
        ingresos: values.ingresos,
        egresos: values.egresos,
      }));

    // 7. Paginate detail items
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

export function POST() { return methodNotAllowed(); }
export function PUT() { return methodNotAllowed(); }
export function PATCH() { return methodNotAllowed(); }
export function DELETE() { return methodNotAllowed(); }
