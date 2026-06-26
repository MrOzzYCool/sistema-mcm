import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

/**
 * GET /api/portal/chat?action=conversaciones | action=mensajes&conv_id=X | action=compañeros&curso_id=X
 */
export async function GET(req: NextRequest) {
  const token = (req.headers.get("authorization") ?? "").replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const { data: { user } } = await supabaseAdmin.auth.getUser(token);
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const action = req.nextUrl.searchParams.get("action");

  // List my conversations
  if (action === "conversaciones") {
    const { data: participaciones } = await supabaseAdmin
      .from("chat_participantes").select("conversacion_id").eq("user_id", user.id);

    if (!participaciones || participaciones.length === 0) {
      return NextResponse.json({ conversaciones: [] });
    }

    const convIds = participaciones.map(p => p.conversacion_id);
    const { data: convs } = await supabaseAdmin
      .from("chat_conversaciones").select("*").in("id", convIds).order("created_at", { ascending: false });

    // Get participants and last message for each
    const result = await Promise.all((convs ?? []).map(async (conv) => {
      const { data: parts } = await supabaseAdmin
        .from("chat_participantes").select("user_id").eq("conversacion_id", conv.id);
      
      const { data: lastMsg } = await supabaseAdmin
        .from("chat_mensajes").select("contenido, sender_name, created_at")
        .eq("conversacion_id", conv.id).order("created_at", { ascending: false }).limit(1);

      // Get the other participant's name for direct chats
      const otherUserId = parts?.find(p => p.user_id !== user.id)?.user_id;
      let otherName = conv.nombre || "Chat";
      if (otherUserId && conv.tipo === "directo") {
        const { data: profile } = await supabaseAdmin
          .from("profiles").select("nombre_completo").eq("id", otherUserId).single();
        if (profile) otherName = profile.nombre_completo;
      }

      return {
        ...conv,
        display_name: otherName,
        last_message: lastMsg?.[0] ?? null,
        unread: 0,
      };
    }));

    return NextResponse.json({ conversaciones: result });
  }

  // Get messages for a conversation
  if (action === "mensajes") {
    const convId = req.nextUrl.searchParams.get("conv_id");
    if (!convId) return NextResponse.json({ error: "conv_id requerido" }, { status: 400 });

    const { data: msgs } = await supabaseAdmin
      .from("chat_mensajes").select("*")
      .eq("conversacion_id", convId).order("created_at", { ascending: true });

    return NextResponse.json({ mensajes: msgs ?? [] });
  }

  // Get classmates for a course (to start a new chat)
  if (action === "companeros") {
    const cursoId = req.nextUrl.searchParams.get("curso_id");
    if (!cursoId) return NextResponse.json({ error: "curso_id requerido" }, { status: 400 });

    // Get all students inscribed in courses taught in this class_schedule
    const { data: schedules } = await supabaseAdmin
      .from("class_schedules").select("id").eq("curso_id", cursoId);

    if (!schedules || schedules.length === 0) {
      // Fallback: get all inscripciones for this curso's carrera
      const { data: malla } = await supabaseAdmin
        .from("malla_curricular").select("carrera_id").eq("curso_id", cursoId).limit(1);
      
      if (malla && malla.length > 0) {
        const { data: inscs } = await supabaseAdmin
          .from("inscripciones").select("alumno_id").eq("carrera_id", malla[0].carrera_id);
        const alumnoIds = (inscs ?? []).map(i => i.alumno_id).filter(id => id !== user.id);
        
        if (alumnoIds.length > 0) {
          const { data: profiles } = await supabaseAdmin
            .from("profiles").select("id, nombre_completo, genero").in("id", alumnoIds).eq("estado", "activo");
          return NextResponse.json({ companeros: profiles ?? [] });
        }
      }
      return NextResponse.json({ companeros: [] });
    }

    // Get students from inscripciones that match the course's carrera
    const { data: malla } = await supabaseAdmin
      .from("malla_curricular").select("carrera_id").eq("curso_id", cursoId).limit(1);

    if (!malla || malla.length === 0) return NextResponse.json({ companeros: [] });

    const { data: inscs } = await supabaseAdmin
      .from("inscripciones").select("alumno_id").eq("carrera_id", malla[0].carrera_id);
    const alumnoIds = (inscs ?? []).map(i => i.alumno_id).filter(id => id !== user.id);

    if (alumnoIds.length === 0) return NextResponse.json({ companeros: [] });

    const { data: profiles } = await supabaseAdmin
      .from("profiles").select("id, nombre_completo, genero").in("id", alumnoIds).eq("estado", "activo");

    return NextResponse.json({ companeros: profiles ?? [] });
  }

  return NextResponse.json({ error: "action requerido" }, { status: 400 });
}

/**
 * POST /api/portal/chat
 * Body: { action: "crear_conversacion", target_user_id, curso_id } | { action: "enviar_mensaje", conv_id, contenido }
 */
export async function POST(req: NextRequest) {
  const token = (req.headers.get("authorization") ?? "").replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const { data: { user } } = await supabaseAdmin.auth.getUser(token);
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const body = await req.json();

  if (body.action === "crear_conversacion") {
    const { target_user_id, curso_id } = body;
    if (!target_user_id) return NextResponse.json({ error: "target_user_id requerido" }, { status: 400 });

    // Check if conversation already exists between these two users
    const { data: myConvs } = await supabaseAdmin
      .from("chat_participantes").select("conversacion_id").eq("user_id", user.id);
    const { data: theirConvs } = await supabaseAdmin
      .from("chat_participantes").select("conversacion_id").eq("user_id", target_user_id);

    const myIds = new Set((myConvs ?? []).map(c => c.conversacion_id));
    const existing = (theirConvs ?? []).find(c => myIds.has(c.conversacion_id));

    if (existing) {
      return NextResponse.json({ conversacion_id: existing.conversacion_id, existing: true });
    }

    // Create new conversation
    const { data: conv, error: convErr } = await supabaseAdmin
      .from("chat_conversaciones")
      .insert({ tipo: "directo", curso_id: curso_id || null })
      .select().single();

    if (convErr) return NextResponse.json({ error: convErr.message }, { status: 500 });

    // Add participants
    await supabaseAdmin.from("chat_participantes").insert([
      { conversacion_id: conv.id, user_id: user.id },
      { conversacion_id: conv.id, user_id: target_user_id },
    ]);

    return NextResponse.json({ conversacion_id: conv.id, existing: false }, { status: 201 });
  }

  if (body.action === "enviar_mensaje") {
    const { conv_id, contenido } = body;
    if (!conv_id || !contenido?.trim()) return NextResponse.json({ error: "conv_id y contenido requeridos" }, { status: 400 });

    // Get sender name
    const { data: profile } = await supabaseAdmin
      .from("profiles").select("nombre_completo").eq("id", user.id).single();

    const { data: msg, error } = await supabaseAdmin
      .from("chat_mensajes")
      .insert({
        conversacion_id: conv_id,
        sender_id: user.id,
        sender_name: profile?.nombre_completo ?? "Usuario",
        contenido: contenido.trim(),
      })
      .select().single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ success: true, mensaje: msg }, { status: 201 });
  }

  return NextResponse.json({ error: "action no válido" }, { status: 400 });
}
