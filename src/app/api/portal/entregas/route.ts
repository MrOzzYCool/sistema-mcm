import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

/**
 * GET /api/portal/entregas?actividad_id=xxx or ?alumno_id=xxx&curso_id=xxx
 */
export async function GET(req: NextRequest) {
  const token = (req.headers.get("authorization") ?? "").replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { data: { user } } = await supabaseAdmin.auth.getUser(token);
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const actividadId = req.nextUrl.searchParams.get("actividad_id");
  const alumnoId = req.nextUrl.searchParams.get("alumno_id");

  if (actividadId) {
    // Profesor: ver todas las entregas de una actividad
    const { data, error } = await supabaseAdmin
      .from("entregas")
      .select("*")
      .eq("actividad_id", actividadId)
      .order("entregado_at", { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ entregas: data ?? [] });
  }

  if (alumnoId) {
    // Alumno: ver sus propias entregas
    const { data, error } = await supabaseAdmin
      .from("entregas")
      .select("*")
      .eq("alumno_id", alumnoId)
      .order("entregado_at", { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ entregas: data ?? [] });
  }

  // Default: mis entregas
  const { data, error } = await supabaseAdmin
    .from("entregas")
    .select("*")
    .eq("alumno_id", user.id)
    .order("entregado_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ entregas: data ?? [] });
}

/**
 * POST /api/portal/entregas
 * Body: { actividad_id, comentario, archivos: [{nombre, url, tipo, tamano}] }
 * Alumno entrega su tarea
 */
export async function POST(req: NextRequest) {
  const token = (req.headers.get("authorization") ?? "").replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { data: { user } } = await supabaseAdmin.auth.getUser(token);
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { actividad_id, comentario, archivos } = await req.json();

  if (!actividad_id) {
    return NextResponse.json({ error: "actividad_id requerido" }, { status: 400 });
  }

  // Check actividad exists and is within deadline
  const { data: actividad } = await supabaseAdmin
    .from("actividades")
    .select("id, fecha_limite, intentos_permitidos")
    .eq("id", actividad_id)
    .single();

  if (!actividad) return NextResponse.json({ error: "Actividad no encontrada" }, { status: 404 });

  // Check deadline
  if (new Date() > new Date(actividad.fecha_limite)) {
    return NextResponse.json({ error: "La fecha límite ha pasado" }, { status: 400 });
  }

  // Check intentos
  const { data: prevEntregas } = await supabaseAdmin
    .from("entregas")
    .select("id")
    .eq("actividad_id", actividad_id)
    .eq("alumno_id", user.id);

  const intentoActual = (prevEntregas?.length ?? 0) + 1;
  if (intentoActual > actividad.intentos_permitidos) {
    return NextResponse.json({ error: "Has alcanzado el máximo de intentos permitidos" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("entregas")
    .insert({
      actividad_id,
      alumno_id: user.id,
      intento: intentoActual,
      comentario: comentario || null,
      archivos: archivos || [],
      estado: "entregado",
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true, entrega: data }, { status: 201 });
}

/**
 * PUT /api/portal/entregas
 * Body: { id, nota, feedback_profesor, estado }
 * Profesor califica
 */
export async function PUT(req: NextRequest) {
  const token = (req.headers.get("authorization") ?? "").replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { data: { user } } = await supabaseAdmin.auth.getUser(token);
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  // Verify is profesor
  const { data: profile } = await supabaseAdmin
    .from("profiles").select("rol, es_profesor").eq("id", user.id).single();

  if (!profile || (profile.rol !== "profesor" && !profile.es_profesor && profile.rol !== "super_admin")) {
    return NextResponse.json({ error: "Solo docentes pueden calificar" }, { status: 403 });
  }

  const { id, nota, feedback_profesor, estado } = await req.json();
  if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 });

  const updateData: Record<string, unknown> = {};
  if (nota !== undefined) updateData.nota = nota;
  if (feedback_profesor !== undefined) updateData.feedback_profesor = feedback_profesor;
  if (estado !== undefined) updateData.estado = estado;
  if (nota !== undefined || estado === "calificado") updateData.calificado_at = new Date().toISOString();

  const { data, error } = await supabaseAdmin
    .from("entregas")
    .update(updateData)
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true, entrega: data });
}
