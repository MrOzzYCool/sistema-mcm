import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { supabase } from "@/lib/supabase";

async function verifyAdmin(req: NextRequest) {
  const token = (req.headers.get("authorization") ?? "").replace("Bearer ", "");
  if (!token) return null;
  const { data: { user } } = await supabase.auth.getUser(token);
  if (!user) return null;
  if (user.email?.toLowerCase() === "admin@margaritacabrera.edu.pe") return user;
  const { data: profile } = await supabaseAdmin.from("profiles").select("rol").eq("id", user.id).single();
  if (!profile || !["super_admin", "administradora"].includes(profile.rol)) return null;
  return user;
}

/**
 * GET /api/admin/benefits?alumno_id=xxx
 */
export async function GET(req: NextRequest) {
  const admin = await verifyAdmin(req);
  if (!admin) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const alumnoId = req.nextUrl.searchParams.get("alumno_id");
  if (!alumnoId) return NextResponse.json({ error: "alumno_id requerido" }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from("student_benefits")
    .select("*")
    .eq("alumno_id", alumnoId)
    .eq("activo", true)
    .order("tipo_concepto");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ benefits: data ?? [] });
}

/**
 * POST /api/admin/benefits
 * Body: { alumno_id, tipo_concepto, monto_final, es_permanente, descripcion, ciclo_aplicable? }
 */
export async function POST(req: NextRequest) {
  const admin = await verifyAdmin(req);
  if (!admin) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const { alumno_id, tipo_concepto, monto_final, es_permanente } = await req.json();

  if (!alumno_id || !tipo_concepto || monto_final == null) {
    return NextResponse.json({ error: "alumno_id, tipo_concepto y monto_final son requeridos" }, { status: 400 });
  }

  if (!["matricula", "cuota"].includes(tipo_concepto)) {
    return NextResponse.json({ error: "tipo_concepto debe ser 'matricula' o 'cuota'" }, { status: 400 });
  }

  if (Number(monto_final) < 0) {
    return NextResponse.json({ error: "monto_final no puede ser negativo" }, { status: 400 });
  }

  // Deactivate existing benefit of same type
  await supabaseAdmin
    .from("student_benefits")
    .update({ activo: false })
    .eq("alumno_id", alumno_id)
    .eq("tipo_concepto", tipo_concepto)
    .eq("activo", true);

  // Create new benefit
  const { data, error } = await supabaseAdmin
    .from("student_benefits")
    .insert({
      alumno_id,
      tipo_concepto,
      monto_final: Number(monto_final),
      es_permanente: !!es_permanente,
      activo: true,
      created_by: admin.id,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // ── Apply benefit to existing installments immediately ──
  // Get all active plans for this student
  const { data: plans } = await supabaseAdmin
    .from("payment_plans")
    .select("id")
    .eq("alumno_id", alumno_id)
    .eq("status", "activo");

  if (plans && plans.length > 0) {
    const planIds = plans.map(p => p.id);
    const tipoFilter = tipo_concepto === "matricula" ? "matricula" : "cuota";

    // Update all matching installments that are still pending
    let query = supabaseAdmin
      .from("installments")
      .update({ amount: Number(monto_final) })
      .in("plan_id", planIds)
      .eq("tipo", tipoFilter)
      .in("status", ["pending", "in_review"]);

    await query;
  }

  await supabaseAdmin.from("historial_auditoria").insert({
    accion: "asignar_beneficio",
    admin_id: admin.id, admin_email: admin.email, target_id: alumno_id,
    detalle: { tipo_concepto, monto_final, es_permanente },
  });

  return NextResponse.json({ success: true, benefit: data });
}

/**
 * DELETE /api/admin/benefits
 * Body: { benefit_id }
 */
export async function DELETE(req: NextRequest) {
  const admin = await verifyAdmin(req);
  if (!admin) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const { benefit_id } = await req.json();
  if (!benefit_id) return NextResponse.json({ error: "benefit_id requerido" }, { status: 400 });

  await supabaseAdmin.from("student_benefits").update({ activo: false }).eq("id", benefit_id);
  return NextResponse.json({ success: true });
}
