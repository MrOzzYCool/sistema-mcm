import { supabaseAdmin } from "./supabase-admin";

const MONTO_MATRICULA = 250;
const MONTO_CUOTA = 400;
const NUM_CUOTAS = 4;

// Ciclo 1 = Enero, Ciclo 2 = Mayo, Ciclo 3 = Septiembre
function getMesInicio(ciclo: number): number {
  if (ciclo === 1) return 0;  // Enero (0-indexed)
  if (ciclo === 2) return 4;  // Mayo
  if (ciclo === 3) return 8;  // Septiembre
  return (ciclo - 1) * 4;
}

export async function generateStudentPaymentPlan(
  alumnoId: string,
  ciclo: number,
  year: number
): Promise<{ planId: string; installments: number; error?: string }> {

  const { data: existing } = await supabaseAdmin
    .from("payment_plans")
    .select("id")
    .eq("alumno_id", alumnoId)
    .eq("ciclo", ciclo)
    .eq("year", year)
    .single();

  if (existing) {
    return { planId: existing.id, installments: 0, error: "Ya existe un plan de pagos para este ciclo y año" };
  }

  const { data: plan, error: planErr } = await supabaseAdmin
    .from("payment_plans")
    .insert({ alumno_id: alumnoId, ciclo, year, status: "activo" })
    .select("id")
    .single();

  if (planErr || !plan) {
    return { planId: "", installments: 0, error: planErr?.message ?? "Error creando plan" };
  }

  const mesInicio = getMesInicio(ciclo);
  const rows = [];

  // 1. MATRÍCULA — vence el 01 del primer mes
  rows.push({
    plan_id: plan.id,
    concepto: "MATRÍCULA",
    tipo: "matricula",
    numero: 0,
    amount: MONTO_MATRICULA,
    amount_original: MONTO_MATRICULA,
    due_date: `${year}-${String(mesInicio + 1).padStart(2, "0")}-01`,
    status: "pendiente",
  });

  // 2. CUOTAS 01..04 — vencen el 01 de cada mes
  for (let i = 0; i < NUM_CUOTAS; i++) {
    const mes = mesInicio + i;
    rows.push({
      plan_id: plan.id,
      concepto: `CUOTAS ${String(i + 1).padStart(2, "0")}`,
      tipo: "cuota",
      numero: i + 1,
      amount: MONTO_CUOTA,
      amount_original: MONTO_CUOTA,
      due_date: `${year}-${String(mes + 1).padStart(2, "0")}-01`,
      status: "pendiente",
    });
  }

  const { error: insErr } = await supabaseAdmin.from("installments").insert(rows);
  if (insErr) {
    await supabaseAdmin.from("payment_plans").delete().eq("id", plan.id);
    return { planId: "", installments: 0, error: insErr.message };
  }

  return { planId: plan.id, installments: rows.length };
}
