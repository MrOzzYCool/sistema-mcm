import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { supabase } from "@/lib/supabase";

const ALLOWED_ROLES = ["super_admin", "administradora", "secretaria_academica"];

async function verifyStaff(req: NextRequest) {
  const token = (req.headers.get("authorization") ?? "").replace("Bearer ", "");
  if (!token) return null;
  const { data: { user } } = await supabase.auth.getUser(token);
  if (!user) return null;
  if (user.email?.toLowerCase() === "admin@margaritacabrera.edu.pe") return user;
  const { data: profile } = await supabaseAdmin.from("profiles").select("rol").eq("id", user.id).single();
  if (!profile || !ALLOWED_ROLES.includes(profile.rol)) return null;
  return user;
}

/**
 * GET /api/admin/voucher-review — list pending vouchers
 */
export async function GET(req: NextRequest) {
  const admin = await verifyStaff(req);
  if (!admin) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const { data } = await supabaseAdmin
    .from("payment_vouchers")
    .select("*, profiles!alumno_id(nombre_completo), installments(concepto, amount, due_date, plan_id, payment_plans(ciclo, year))")
    .eq("status", "pending_review")
    .order("created_at", { ascending: false });

  return NextResponse.json({ vouchers: data ?? [] });
}

/**
 * POST /api/admin/voucher-review
 * Body: { voucher_id, action: "approve" | "reject", reason? }
 */
export async function POST(req: NextRequest) {
  const admin = await verifyStaff(req);
  if (!admin) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const { voucher_id, action, reason } = await req.json();
  if (!voucher_id || !action) {
    return NextResponse.json({ error: "voucher_id y action requeridos" }, { status: 400 });
  }

  const { data: voucher } = await supabaseAdmin
    .from("payment_vouchers")
    .select("id, installment_id, alumno_id, status")
    .eq("id", voucher_id)
    .single();

  if (!voucher) return NextResponse.json({ error: "Voucher no encontrado" }, { status: 404 });
  if (voucher.status !== "pending_review") {
    return NextResponse.json({ error: "Este voucher ya fue procesado" }, { status: 400 });
  }

  if (action === "approve") {
    // Update voucher
    await supabaseAdmin.from("payment_vouchers").update({
      status: "approved", reviewed_by: admin.id, reviewed_at: new Date().toISOString(),
    }).eq("id", voucher_id);

    // Update installment to paid
    await supabaseAdmin.from("installments").update({
      status: "paid", fecha_pago: new Date().toISOString(),
    }).eq("id", voucher.installment_id);

    return NextResponse.json({ success: true, message: "Voucher aprobado. Cuota marcada como pagada." });
  }

  if (action === "reject") {
    // Update voucher
    await supabaseAdmin.from("payment_vouchers").update({
      status: "rejected", reviewed_by: admin.id, reviewed_at: new Date().toISOString(),
      rejection_reason: reason ?? "Voucher no válido",
    }).eq("id", voucher_id);

    // Revert installment to pending
    await supabaseAdmin.from("installments").update({ status: "pending" }).eq("id", voucher.installment_id);

    return NextResponse.json({ success: true, message: "Voucher rechazado. Cuota vuelve a pendiente." });
  }

  return NextResponse.json({ error: "Acción no válida. Usa 'approve' o 'reject'" }, { status: 400 });
}
