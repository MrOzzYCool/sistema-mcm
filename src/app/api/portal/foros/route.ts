import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

/**
 * GET /api/portal/foros?curso_id=xxx&semana=N
 * Obtiene los comentarios del foro de una semana específica
 */
export async function GET(req: NextRequest) {
  const token = (req.headers.get("authorization") ?? "").replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { data: { user } } = await supabaseAdmin.auth.getUser(token);
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const cursoId = req.nextUrl.searchParams.get("curso_id");
  const semana = req.nextUrl.searchParams.get("semana");

  if (!cursoId || !semana) {
    return NextResponse.json({ error: "curso_id y semana son requeridos" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("foro_comentarios")
    .select("*")
    .eq("curso_id", cursoId)
    .eq("semana", Number(semana))
    .is("parent_id", null)
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Fetch replies for each comment
  const commentIds = (data ?? []).map(c => c.id);
  let replies: typeof data = [];

  if (commentIds.length > 0) {
    const { data: repliesData } = await supabaseAdmin
      .from("foro_comentarios")
      .select("*")
      .in("parent_id", commentIds)
      .order("created_at", { ascending: true });
    replies = repliesData ?? [];
  }

  // Build tree
  const comments = (data ?? []).map(comment => ({
    ...comment,
    replies: replies.filter(r => r.parent_id === comment.id),
  }));

  return NextResponse.json({ comments });
}

/**
 * POST /api/portal/foros
 * Body: { curso_id, semana, mensaje, parent_id? }
 * Crea un comentario en el foro
 */
export async function POST(req: NextRequest) {
  const token = (req.headers.get("authorization") ?? "").replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { data: { user } } = await supabaseAdmin.auth.getUser(token);
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { curso_id, semana, mensaje, parent_id } = await req.json();

  if (!curso_id || !semana || !mensaje?.trim()) {
    return NextResponse.json({ error: "curso_id, semana y mensaje son requeridos" }, { status: 400 });
  }

  // Get user profile for name and role
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("nombre, apellidos, rol, es_profesor")
    .eq("id", user.id)
    .single();

  const userName = profile
    ? `${profile.nombre ?? ""} ${profile.apellidos ?? ""}`.trim() || "Usuario"
    : "Usuario";
  const userRol = profile?.es_profesor ? "profesor" : (profile?.rol ?? "alumno");

  const { data, error } = await supabaseAdmin
    .from("foro_comentarios")
    .insert({
      curso_id,
      semana: Number(semana),
      user_id: user.id,
      user_name: userName,
      user_rol: userRol,
      mensaje: mensaje.trim(),
      parent_id: parent_id || null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true, comment: data }, { status: 201 });
}
