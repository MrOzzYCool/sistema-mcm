import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { supabase } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.replace("Bearer ", "");
  const { data: { user: admin } } = await supabase.auth.getUser(token);
  if (!admin?.email || admin.email.toLowerCase() !== "admin@margaritacabrera.edu.pe") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const body = await req.json();

  // ── Acción masiva: desactivar alumnos por ciclo ──
  if (body.action === "deactivate-by-cycle") {
    const { cycle_number, carrera_id } = body;
    if (!cycle_number) return NextResponse.json({ error: "cycle_number requerido" }, { status: 400 });

    try {
      let query = supabaseAdmin
        .from("inscripciones")
        .select("alumno_id")
        .eq("ciclo_actual", parseInt(cycle_number));

      if (carrera_id) query = query.eq("carrera_id", carrera_id);

      const { data: inscripciones } = await query;
      const alumnoIds = [...new Set((inscripciones ?? []).map(i => i.alumno_id).filter(Boolean))];

      if (alumnoIds.length === 0) {
        return NextResponse.json({ success: true, message: "No se encontraron alumnos.", deactivated: 0 });
      }

      // Desactivar alumnos (is_active = false, estado = inactivo)
      const { error: updateErr } = await supabaseAdmin
        .from("profiles")
        .update({ is_active: false, estado: "inactivo" })
        .in("id", alumnoIds)
        .eq("rol", "alumno");

      if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });

      await supabaseAdmin.from("historial_auditoria").insert({
        accion: "desactivar_alumnos_ciclo",
        admin_id: admin.id, admin_email: admin.email,
        detalle: { cycle_number, carrera_id, alumnos_desactivados: alumnoIds.length },
      });

      return NextResponse.json({
        success: true,
        message: `${alumnoIds.length} alumnos del Ciclo ${cycle_number} desactivados.`,
        deactivated: alumnoIds.length,
      });
    } catch (err) {
      return NextResponse.json({ error: err instanceof Error ? err.message : "Error" }, { status: 500 });
    }
  }

  // ── Acción individual: toggle usuario ──
  const { userId, estado } = body;
  if (!userId || !estado) return NextResponse.json({ error: "Datos incompletos" }, { status: 400 });

  if (estado === "eliminado") {
    return NextResponse.json(
      { error: "No se puede usar este endpoint para eliminar usuarios" },
      { status: 400 }
    );
  }

  const { error } = await supabaseAdmin.from("profiles").update({ estado }).eq("id", userId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Auditoría
  await supabaseAdmin.from("historial_auditoria").insert({
    accion: estado === "activo" ? "activar_usuario" : "desactivar_usuario",
    admin_id: admin.id, admin_email: admin.email, target_id: userId,
  });

  return NextResponse.json({ success: true });
}
