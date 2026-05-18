import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET(req: NextRequest) {
  const token = (req.headers.get("authorization") ?? "").replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { data: { user } } = await supabase.auth.getUser(token);
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { data: plans } = await supabaseAdmin
    .from("payment_plans")
    .select("id, ciclo, year, status, installments(id, concepto, tipo, numero, amount, amount_original, due_date, status, fecha_pago, observacion, comprobante_url, tipo_comprobante)")
    .eq("alumno_id", user.id)
    .eq("status", "activo")
    .order("year", { ascending: false });

  // Fix inconsistencies: if a cuota has comprobante_url + fecha_pago but status is still pending,
  // treat it as paid (and fix it in the DB for next time)
  const idsToFix: string[] = [];
  const fixedPlans = (plans ?? []).map((plan) => ({
    ...plan,
    installments: ((plan.installments as Record<string, unknown>[]) ?? []).map((inst) => {
      if (
        inst.comprobante_url &&
        inst.fecha_pago &&
        (inst.status === "pending" || inst.status === "in_review")
      ) {
        idsToFix.push(inst.id as string);
        return { ...inst, status: "paid" };
      }
      return inst;
    }),
  }));

  // Auto-fix the DB in the background (non-blocking)
  if (idsToFix.length > 0) {
    supabaseAdmin
      .from("installments")
      .update({ status: "paid" })
      .in("id", idsToFix)
      .then(() => {
        console.log(`[MIS-PAGOS] Auto-fixed ${idsToFix.length} installments with comprobante but pending status`);
      });
  }

  return NextResponse.json(
    { plans: fixedPlans },
    { headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } }
  );
}
