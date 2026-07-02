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

    try {
      const { generateStudentPaymentPlan } = await import("@/lib/payment-service");
      const plan = await generateStudentPaymentPlan({
        alumnoId: alumno_id,
        ciclo: parseInt(ciclo),
        year: parseInt(year),
      });

      await supabaseAdmin.from("historial_auditoria").insert({
        accion: "generar_plan_pagos",
        admin_id: admin.id, admin_email: admin.email, target_id: alumno_id,
        detalle: { ciclo, year, plan_id: plan.id },
      });

      return NextResponse.json({ success: true, planId: plan.id });
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "Error generando plan" },
        { status: 400 },
      );
    }
  }

  if (action === "mark-paid") {
    const { installment_id } = body;
    if (!installment_id) return NextResponse.json({ error: "installment_id requerido" }, { status: 400 });

    const { error } = await supabaseAdmin
      .from("installments")
      .update({ status: "paid", fecha_pago: new Date().toISOString() })
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
      .update({ amount: Number(monto), observacion: observacion ?? null })
      .eq("id", installment_id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  if (action === "delete-plan") {
    const { plan_id } = body;
    if (!plan_id) return NextResponse.json({ error: "plan_id requerido" }, { status: 400 });

    // Delete installments first (FK cascade would handle it, but explicit is clearer)
    await supabaseAdmin.from("installments").delete().eq("plan_id", plan_id);
    const { error } = await supabaseAdmin.from("payment_plans").delete().eq("id", plan_id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    await supabaseAdmin.from("historial_auditoria").insert({
      accion: "eliminar_plan_pagos",
      admin_id: admin.id, admin_email: admin.email,
      detalle: { plan_id },
    });

    return NextResponse.json({ success: true, message: "Plan de pagos eliminado." });
  }

  if (action === "change-ciclo") {
    const { alumno_id, plan_id, nuevo_ciclo } = body;
    if (!alumno_id || !nuevo_ciclo) {
      return NextResponse.json({ error: "alumno_id y nuevo_ciclo requeridos" }, { status: 400 });
    }

    // Update payment_plan ciclo
    if (plan_id) {
      await supabaseAdmin.from("payment_plans").update({ ciclo: Number(nuevo_ciclo) }).eq("id", plan_id);
    }

    // Update inscripciones
    await supabaseAdmin.from("inscripciones").update({ ciclo_actual: Number(nuevo_ciclo) }).eq("alumno_id", alumno_id);

    return NextResponse.json({ success: true, message: `Ciclo actualizado a ${nuevo_ciclo}. Recuerda regenerar el plan de pagos.` });
  }

  if (action === "manual-comprobante") {
    const { installment_id, comprobante_url, comprobante_serie, comprobante_numero, tipo_comprobante, fecha_pago } = body;
    if (!installment_id || !comprobante_url || !comprobante_serie || !comprobante_numero) {
      return NextResponse.json({ error: "installment_id, comprobante_url, comprobante_serie y comprobante_numero son requeridos" }, { status: 400 });
    }

    // Update installment to paid with comprobante info
    const { error: instErr } = await supabaseAdmin.from("installments").update({
      status: "paid",
      fecha_pago: fecha_pago ?? new Date().toISOString(),
      tipo_comprobante: tipo_comprobante ?? "boleta",
      comprobante_serie,
      comprobante_numero: String(comprobante_numero),
      comprobante_url,
    }).eq("id", installment_id);

    if (instErr) return NextResponse.json({ error: instErr.message }, { status: 500 });

    // Also approve any pending voucher for this installment
    await supabaseAdmin.from("payment_vouchers").update({
      status: "approved", reviewed_by: admin.id, reviewed_at: new Date().toISOString(),
    }).eq("installment_id", installment_id).eq("status", "pending_review");

    await supabaseAdmin.from("historial_auditoria").insert({
      accion: "comprobante_manual",
      admin_id: admin.id, admin_email: admin.email,
      detalle: { installment_id, comprobante_serie, comprobante_numero, tipo_comprobante },
    });

    return NextResponse.json({ success: true, message: `Comprobante ${comprobante_serie}-${comprobante_numero} adjuntado. Cuota marcada como pagada.` });
  }

  if (action === "cancel-by-opening") {
    // Cancelar todas las cuotas pendientes de alumnos de un ciclo/apertura específica
    const { cycle_number, carrera_id } = body;
    if (!cycle_number) {
      return NextResponse.json({ error: "cycle_number es requerido" }, { status: 400 });
    }

    try {
      // Buscar alumnos inscritos en ese ciclo (y opcionalmente carrera)
      let query = supabaseAdmin
        .from("inscripciones")
        .select("alumno_id")
        .eq("ciclo_actual", parseInt(cycle_number));

      if (carrera_id) {
        query = query.eq("carrera_id", carrera_id);
      }

      const { data: inscripciones } = await query;
      const alumnoIds = [...new Set((inscripciones ?? []).map(i => i.alumno_id).filter(Boolean))];

      if (alumnoIds.length === 0) {
        return NextResponse.json({ success: true, message: "No se encontraron alumnos para ese ciclo.", cancelled: 0 });
      }

      // Buscar planes de pago de esos alumnos
      const { data: plans } = await supabaseAdmin
        .from("payment_plans")
        .select("id")
        .in("alumno_id", alumnoIds);

      const planIds = (plans ?? []).map(p => p.id);

      if (planIds.length === 0) {
        return NextResponse.json({ success: true, message: "No hay planes de pago para esos alumnos.", cancelled: 0 });
      }

      // Cancelar todas las cuotas pendientes de esos planes
      const { data: updated, error: cancelErr } = await supabaseAdmin
        .from("installments")
        .update({ status: "cancelled" })
        .in("plan_id", planIds)
        .eq("status", "pending")
        .select("id");

      if (cancelErr) {
        return NextResponse.json({ error: cancelErr.message }, { status: 500 });
      }

      const cancelled = updated?.length ?? 0;

      await supabaseAdmin.from("historial_auditoria").insert({
        accion: "cancelar_cuotas_masivo",
        admin_id: admin.id, admin_email: admin.email,
        detalle: { cycle_number, carrera_id, alumnos: alumnoIds.length, cuotas_canceladas: cancelled },
      });

      return NextResponse.json({
        success: true,
        message: `${cancelled} cuotas pendientes canceladas para ${alumnoIds.length} alumnos del Ciclo ${cycle_number}.`,
        cancelled,
        alumnos: alumnoIds.length,
      });
    } catch (err) {
      return NextResponse.json({ error: err instanceof Error ? err.message : "Error" }, { status: 500 });
    }
  }

  return NextResponse.json({ error: "Acción no reconocida" }, { status: 400 });
}
