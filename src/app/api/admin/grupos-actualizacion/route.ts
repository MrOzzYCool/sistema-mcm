import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { supabase } from "@/lib/supabase";
import { ACTUALIZACIONES_CATALOGO } from "@/lib/mock-data";
import { validarApertura } from "@/lib/grupos-actualizacion/logic";

const ALLOWED_ROLES = ["super_admin", "actualizacion"];

async function verifyAccess(req: NextRequest) {
  const token = (req.headers.get("authorization") ?? "").replace("Bearer ", "");
  if (!token) return null;
  const { data: { user } } = await supabase.auth.getUser(token);
  if (!user) return null;

  // Check hardcoded admin
  if (user.email?.toLowerCase() === "admin@margaritacabrera.edu.pe") return user;

  // Check profile role
  const { data: profile } = await supabaseAdmin
    .from("profiles").select("rol").eq("id", user.id).single();
  if (!profile || !ALLOWED_ROLES.includes(profile.rol)) return null;
  return user;
}

/**
 * GET /api/admin/grupos-actualizacion
 * Query opcional: ?programa_id=ac1
 */
export async function GET(req: NextRequest) {
  const admin = await verifyAccess(req);
  if (!admin) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const programaId = req.nextUrl.searchParams.get("programa_id");

  let query = supabaseAdmin
    .from("grupos_actualizacion")
    .select("*")
    .order("created_at", { ascending: false });

  if (programaId) {
    query = query.eq("programa_id", programaId);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ grupos: data ?? [] });
}

/**
 * POST /api/admin/grupos-actualizacion
 * Body: { programa_id, fecha_inicio, fecha_cierre_inscripcion }
 */
export async function POST(req: NextRequest) {
  const admin = await verifyAccess(req);
  if (!admin) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const { programa_id, fecha_inicio, fecha_cierre_inscripcion } = await req.json();

  const catalogoIds = ACTUALIZACIONES_CATALOGO.map((p) => p.id as string);

  // Traer grupos activos del programa para validar la regla de un solo activo
  const { data: existentes, error: fetchError } = await supabaseAdmin
    .from("grupos_actualizacion")
    .select("programa_id, estado")
    .eq("programa_id", programa_id)
    .eq("estado", "activo");

  if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 });

  const validation = validarApertura(
    { programa_id, fecha_inicio },
    existentes ?? [],
    catalogoIds
  );
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const programa = ACTUALIZACIONES_CATALOGO.find((p) => p.id === programa_id);
  const programa_label = programa?.label ?? "";

  const { data, error } = await supabaseAdmin
    .from("grupos_actualizacion")
    .insert({
      programa_id,
      programa_label,
      fecha_inicio,
      fecha_cierre_inscripcion: fecha_cierre_inscripcion || null,
      estado: "activo",
      created_by: admin.id,
    })
    .select()
    .single();

  if (error) {
    // Salvaguarda: violación del índice único parcial (grupo activo duplicado)
    if (error.code === "23505" || /duplicate key|unique/i.test(error.message)) {
      return NextResponse.json(
        { error: "Ya existe un grupo activo para este programa" },
        { status: 400 }
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await supabaseAdmin.from("historial_auditoria").insert({
    accion: "aperturar_grupo_actualizacion",
    admin_id: admin.id, admin_email: admin.email,
    detalle: { grupo_id: data?.id, programa_id, programa_label, fecha_inicio, fecha_cierre_inscripcion: fecha_cierre_inscripcion || null },
  });

  return NextResponse.json({ success: true, grupo: data }, { status: 201 });
}

/**
 * PATCH /api/admin/grupos-actualizacion
 * Body: { id, estado }
 */
export async function PATCH(req: NextRequest) {
  const admin = await verifyAccess(req);
  if (!admin) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const { id, estado } = await req.json();
  if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 });

  if (estado === "cerrado") {
    const { data: grupo, error: fetchError } = await supabaseAdmin
      .from("grupos_actualizacion")
      .select("estado")
      .eq("id", id)
      .single();

    if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 });
    if (!grupo) return NextResponse.json({ error: "Grupo no encontrado" }, { status: 404 });

    // Cierre idempotente (Req 2.5): si ya está cerrado, avisar sin error fatal
    if (grupo.estado === "cerrado") {
      return NextResponse.json({ success: true, message: "El grupo ya está cerrado" });
    }

    const { error } = await supabaseAdmin
      .from("grupos_actualizacion")
      .update({ estado: "cerrado" })
      .eq("id", id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    await supabaseAdmin.from("historial_auditoria").insert({
      accion: "cerrar_grupo_actualizacion",
      admin_id: admin.id, admin_email: admin.email,
      detalle: { grupo_id: id },
    });

    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Estado no soportado" }, { status: 400 });
}
