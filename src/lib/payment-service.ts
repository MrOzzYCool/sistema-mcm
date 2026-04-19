import { supabaseAdmin } from "./supabase-admin";

/**
 * generateStudentPaymentPlan
 * 1. Busca si hay una cycle_opening activa para el ciclo → usa su start_date
 * 2. Si no hay apertura, calcula con la fórmula:
 *    startMonthIndex = ((ciclo - 1) % 3) * 4
 *    startYear = year + Math.floor((ciclo - 1) / 3)
 */
export async function generateStudentPaymentPlan(
  { alumnoId, ciclo, year }: { alumnoId: string; ciclo: number; year: number }
) {
  if (!alumnoId || !ciclo || !year) throw new Error("alumnoId, ciclo y year son requeridos");
  if (!Number.isInteger(ciclo) || ciclo <= 0) throw new Error("ciclo inválido");

  // Prevenir duplicados
  const { data: existing } = await supabaseAdmin
    .from("payment_plans")
    .select("id")
    .eq("alumno_id", alumnoId)
    .eq("ciclo", ciclo)
    .eq("year", year)
    .limit(1);

  if (existing && existing.length > 0) throw new Error("Ya existe un plan para este alumno/ciclo/año");

  // Crear plan
  const { data: plan, error: planError } = await supabaseAdmin
    .from("payment_plans")
    .insert([{ alumno_id: alumnoId, ciclo, year, status: "activo" }])
    .select()
    .single();
  if (planError) throw planError;

  // Buscar cycle_opening activa para determinar fecha de inicio
  let startMonthIndex: number;
  let startYear: number;

  const { data: opening } = await supabaseAdmin
    .from("cycle_openings")
    .select("start_date")
    .eq("cycle_number", ciclo)
    .eq("status", "activo")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (opening?.start_date) {
    // Usar la fecha de la apertura
    const d = new Date(opening.start_date + "T00:00:00");
    startMonthIndex = d.getMonth(); // 0-indexed
    startYear = d.getFullYear();
  } else {
    // Fallback: cálculo por fórmula
    startMonthIndex = ((ciclo - 1) % 3) * 4;
    const yearOffset = Math.floor((ciclo - 1) / 3);
    startYear = year + yearOffset;
  }

  const items: Record<string, unknown>[] = [];

  // Matrícula — día 01 del mes de inicio
  items.push({
    plan_id: plan.id,
    tipo: "matricula",
    numero: 0,
    concepto: "MATRÍCULA",
    amount_original: 250.00,
    amount: 250.00,
    due_date: new Date(startYear, startMonthIndex, 1).toISOString().slice(0, 10),
    status: "pending",
  });

  // Cuotas 1..4 — día 01 de cada mes consecutivo
  for (let i = 0; i < 4; i++) {
    const monthIndex = startMonthIndex + i;
    const addYears = Math.floor(monthIndex / 12);
    const realMonthIndex = monthIndex % 12;
    const dueYear = startYear + addYears;

    const numero = i + 1;
    items.push({
      plan_id: plan.id,
      tipo: "cuota",
      numero,
      concepto: `CUOTAS ${String(numero).padStart(2, "0")}`,
      amount_original: 400.00,
      amount: 400.00,
      due_date: new Date(dueYear, realMonthIndex, 1).toISOString().slice(0, 10),
      status: "pending",
    });
  }

  const { error: insertErr } = await supabaseAdmin.from("installments").insert(items);
  if (insertErr) throw insertErr;

  return plan;
}
