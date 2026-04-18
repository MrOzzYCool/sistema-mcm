import { supabaseAdmin } from "./supabase-admin";

const MONTO_MATRICULA = 250;
const MONTO_CUOTA = 400;
const NUM_CUOTAS = 4;

// Ciclo 1 = Enero-Abril, Ciclo 2 = Mayo-Agosto, Ciclo 3 = Septiembre-Diciembre
function getMesInicio(ciclo: number): number {
  if (ciclo === 1) return 0;  // Enero (0-indexed)
  if (ciclo === 2) return 4;  // Mayo
  if (ciclo === 3) return 8;  // Septiembre
  return (ciclo - 1) * 4;     // Fallback
}

export async function generateStudentPaymentPlan(
  alumnoId: string,
  ciclo: number,
  year: number
): Promise<{ planId: string; installments: number; error?: string }> {

  // Check if plan already exists
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

  // Create payment plan
  const { data: plan, error: planErr } = await supabaseAdmin
    .from("payment_plans")
    .insert({ alumno_id: alumnoId, ciclo, year, estado: "activo" })
    .select("id")
    .single();

  if (planErr || !plan) {
    return { planId: "", installments: 0, error: planErr?.message ?? "Error creando plan" };
  }

  const mesInicio = getMesInicio(ciclo);
  const rows = [];

  // 1. Matrícula — vence el 05 del primer mes
  rows.push({
    plan_id: plan.id,
    tipo: "matricula",
    numero: 0,
    monto: MONTO_MATRICULA,
    monto_original: MONTO_MATRICULA,
    fecha_vencimiento: `${year}-${String(mesInicio + 1).padStart(2, "0")}-05`,
    estado: "pendiente",
  });

  // 2. Cuotas mensuales — vencen el 05 de cada mes
  for (let i = 0; i < NUM_CUOTAS; i++) {
    const mes = mesInicio + i;
    rows.push({
      plan_id: plan.id,
      tipo: "cuota",
      numero: i + 1,
      monto: MONTO_CUOTA,
      monto_original: MONTO_CUOTA,
      fecha_vencimiento: `${year}-${String(mes + 1).padStart(2, "0")}-05`,
      estado: "pendiente",
    });
  }

  const { error: insErr } = await supabaseAdmin.from("installments").insert(rows);
  if (insErr) {
    // Cleanup: delete the plan if installments failed
    await supabaseAdmin.from("payment_plans").delete().eq("id", plan.id);
    return { planId: "", installments: 0, error: insErr.message };
  }

  return { planId: plan.id, installments: rows.length };
}
