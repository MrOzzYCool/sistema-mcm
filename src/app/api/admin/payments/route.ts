import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { supabase } from "@/lib/supabase";

const ADMIN_EMAIL = "admin@margaritacabrera.edu.pe";

async function verifyAdmin(req: NextRequest) {
  const token = (req.headers.get("authorization") ?? "").replace("Bearer ", "");
  if (!token) return null;
  const { data: { user } } = await supabase.auth.getUser(token);
  if (!user?.email || user.email.toLowerCase() !== ADMIN_EMAIL) return null;
  return user;
}

/**
 * GET /api/admin/payments?alumno_id=xxx
 * Returns payment plans and installments for a student.
 */
export async function GET(req: NextRequest) {
  const admin = await verifyAdmin(req);
  if (!admin) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const alumnoId = req.nextUrl.searchParams.get("alumno_id");
  if (!alumnoId) return NextResponse.json({ error: "alumno_id requerido" }, { status: 400 });

  const { data: plans } = await supabaseAdmin
    .from("payment_plans")
    .select("*, installments(*)")
    .eq("alumno_id", alumnoId)
    .order("year", { ascending: false });

  return NextResponse.json({ plans: plans ?? [] });
}

/**
 * POST /api/admin/payments
 * Actions: generate-plan, mark-paid, update-amount
 */
export async function POST(req: NextRequest) {
  const admin = await verifyAdmin(req);
  if (!admin) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const body = await req.json();
  const { action } = body;

  if (action === "generate-plan") {
    const { alumno_id, ciclo, year } = body;
    if (!alumno_id || !ciclo || !year) {
      return NextResponse.json({ error: "alumno_id, ciclo y year son requeridos" }, { status: 400 });
    }

    const { generateStudentPaymentPlan } = await import("@/lib/payment-service");
    const result = await generateStudentPaymentPlan(alumno_id, ciclo, year);

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    await supabaseAdmin.from("historial_auditoria").insert({
      accion: "generar_plan_pagos",
      admin_id: admin.id, admin_email: admin.email, target_id: alumno_id,
      detalle: { ciclo, year, plan_id: result.planId, installments: result.installments },
    });

    return NextResponse.json({ success: true, ...result });
  }

  if (action === "mark-paid") {
    const { installment_id } = body;
    if (!installment_id) return NextResponse.json({ error: "installment_id requerido" }, { status: 400 });

    const { error } = await supabaseAdmin
      .from("installments")
      .update({ status: "pagado", fecha_pago: new Date().toISOString() })
      .eq("id", installment_id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  if (action === "update-amount") {
    const { installment_id, monto, observacion } = body;
    if (!installment_id || monto == null) {
      return NextResponse.json({ error: "installment_id y monto requeridos" }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from("installments")
      .update({ monto: Number(monto), observacion: observacion ?? null })
      .eq("id", installment_id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Acción no reconocida" }, { status: 400 });
}
