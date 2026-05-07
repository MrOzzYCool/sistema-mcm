import { supabaseAdmin } from "./supabase-admin";

/**
 * Obtiene el último día de un mes dado (maneja 28, 29, 30, 31 correctamente).
 * month es 0-indexed (0=Enero, 11=Diciembre)
 */
function getLastDayOfMonth(year: number, month: number): string {
  // new Date(year, month+1, 0) da el último día del mes
  const d = new Date(year, month + 1, 0);
  return d.toISOString().slice(0, 10);
}

/**
 * generateStudentPaymentPlan
 * Lógica de fechas:
 * - Busca cycle_opening activa → usa su start_date como mes base
 * - Matrícula y Cuota 01 → último día del mes de inicio
 * - Cuota 02, 03, 04 → último día de los meses siguientes consecutivos
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
    const d = new Date(opening.start_date + "T00:00:00");
    startMonthIndex = d.getMonth();
    startYear = d.getFullYear();
  } else {
    startMonthIndex = ((ciclo - 1) % 3) * 4;
    const yearOffset = Math.floor((ciclo - 1) / 3);
    startYear = year + yearOffset;
  }

  // Check for student benefits (discounts)
  const { data: benefits } = await supabaseAdmin
    .from("student_benefits")
    .select("tipo_concepto, monto_final, es_permanente, ciclo_aplicable")
    .eq("alumno_id", alumnoId)
    .eq("activo", true);

  const matriculaBenefit = (benefits ?? []).find(b =>
    b.tipo_concepto === "matricula" && (b.es_permanente || b.ciclo_aplicable === ciclo || !b.ciclo_aplicable)
  );
  const cuotaBenefit = (benefits ?? []).find(b =>
    b.tipo_concepto === "cuota" && (b.es_permanente || b.ciclo_aplicable === ciclo || !b.ciclo_aplicable)
  );

  const montoMatricula = matriculaBenefit ? Number(matriculaBenefit.monto_final) : 250.00;
  const montoCuota = cuotaBenefit ? Number(cuotaBenefit.monto_final) : 400.00;

  const items: Record<string, unknown>[] = [];

  // Matrícula — último día del mes de inicio
  items.push({
    plan_id: plan.id,
    tipo: "matricula",
    numero: 0,
    concepto: "MATRÍCULA",
    amount_original: 250.00,
    amount: montoMatricula,
    due_date: getLastDayOfMonth(startYear, startMonthIndex),
    status: "pending",
  });

  // Cuotas 1..4 — último día de cada mes consecutivo
  // Cuota 01 = mismo mes que matrícula (mes de inicio)
  // Cuota 02 = mes siguiente, etc.
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
      amount: montoCuota,
      due_date: getLastDayOfMonth(dueYear, realMonthIndex),
      status: "pending",
    });
  }

  const { error: insertErr } = await supabaseAdmin.from("installments").insert(items);
  if (insertErr) throw insertErr;

  return plan;
}
