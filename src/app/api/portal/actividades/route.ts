import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

/**
 * GET /api/portal/actividades?curso_id=xxx&semana=N (optional)
 */
export async function GET(req: NextRequest) {
  const token = (req.headers.get("authorization") ?? "").replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { data: { user } } = await supabaseAdmin.auth.getUser(token);
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const cursoId = req.nextUrl.searchParams.get("curso_id");
  if (!cursoId) return NextResponse.json({ error: "curso_id requerido" }, { status: 400 });

  const semana = req.nextUrl.searchParams.get("semana");

  let query = supabaseAdmin
    .from("actividades")
    .select("*")
    .eq("curso_id", cursoId)
    .order("semana")
    .order("created_at", { ascending: false });

  if (semana) query = query.eq("semana", Number(semana));

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ actividades: data ?? [] });
}

/**
 * POST /api/portal/actividades
 * Body: { curso_id, semana, titulo, tipo, indicaciones, fecha_inicio, fecha_limite, intentos_permitidos, nota_maxima, rubrica, tipos_entrega, visible }
 */
export async function POST(req: NextRequest) {
  const token = (req.headers.get("authorization") ?? "").replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { data: { user } } = await supabaseAdmin.auth.getUser(token);
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  // Verify role
  const { data: profile } = await supabaseAdmin
    .from("profiles").select("rol, es_profesor").eq("id", user.id).single();

  if (!profile || (profile.rol !== "profesor" && !profile.es_profesor && profile.rol !== "super_admin")) {
    return NextResponse.json({ error: "Solo docentes pueden crear actividades" }, { status: 403 });
  }

  const body = await req.json();
  const { curso_id, semana, titulo, tipo, indicaciones, fecha_inicio, fecha_limite, intentos_permitidos, nota_maxima, rubrica, tipos_entrega, visible } = body;

  if (!curso_id || !semana || !titulo || !fecha_limite) {
    return NextResponse.json({ error: "curso_id, semana, titulo y fecha_limite son requeridos" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("actividades")
    .insert({
      curso_id,
      semana: Number(semana),
      titulo,
      tipo: tipo || "tarea",
      indicaciones: indicaciones || null,
      fecha_inicio: fecha_inicio || null,
      fecha_limite,
      intentos_permitidos: intentos_permitidos || 1,
      nota_maxima: nota_maxima || 20,
      rubrica: rubrica || null,
      tipos_entrega: tipos_entrega || ["pdf", "docx", "xlsx", "pptx", "jpg", "mp4", "zip"],
      visible: visible !== false,
      created_by: user.id,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true, actividad: data }, { status: 201 });
}

/**
 * PUT /api/portal/actividades
 * Body: { id, ...fields }
 */
export async function PUT(req: NextRequest) {
  const token = (req.headers.get("authorization") ?? "").replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { data: { user } } = await supabaseAdmin.auth.getUser(token);
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const body = await req.json();
  const { id, ...updates } = body;

  if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from("actividades")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true, actividad: data });
}

/**
 * DELETE /api/portal/actividades
 * Body: { id }
 */
export async function DELETE(req: NextRequest) {
  const token = (req.headers.get("authorization") ?? "").replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { data: { user } } = await supabaseAdmin.auth.getUser(token);
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 });

  const { error } = await supabaseAdmin.from("actividades").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
