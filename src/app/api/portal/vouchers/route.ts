import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { supabaseAdmin } from "@/lib/supabase-admin";

/**
 * POST /api/portal/vouchers
 * Alumno submits a voucher for a pending installment.
 * Body: { installment_id, voucher_url }
 */
export async function POST(req: NextRequest) {
  const token = (req.headers.get("authorization") ?? "").replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { data: { user } } = await supabase.auth.getUser(token);
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { installment_id, voucher_url } = await req.json();
  if (!installment_id || !voucher_url) {
    return NextResponse.json({ error: "installment_id y voucher_url requeridos" }, { status: 400 });
  }

  // Verify the installment belongs to this student
  const { data: inst } = await supabaseAdmin
    .from("installments")
    .select("id, status, plan_id, payment_plans!inner(alumno_id)")
    .eq("id", installment_id)
    .single();

  if (!inst) return NextResponse.json({ error: "Cuota no encontrada" }, { status: 404 });

  const planData = inst.payment_plans as unknown as { alumno_id: string };
  if (planData.alumno_id !== user.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  if (inst.status !== "pending") {
    return NextResponse.json({ error: "Solo se pueden adjuntar vouchers a cuotas pendientes" }, { status: 400 });
  }

  // Create voucher record
  const { error: vErr } = await supabaseAdmin.from("payment_vouchers").insert({
    installment_id,
    alumno_id: user.id,
    voucher_url,
    status: "pending_review",
  });
  if (vErr) return NextResponse.json({ error: vErr.message }, { status: 500 });

  // Update installment status to in_review
  await supabaseAdmin.from("installments").update({ status: "in_review" }).eq("id", installment_id);

  return NextResponse.json({ success: true, message: "Voucher enviado. Pendiente de revisión." });
}
