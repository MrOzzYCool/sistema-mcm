import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { supabase } from "@/lib/supabase";

async function verifyAdmin(req: NextRequest) {
  const token = (req.headers.get("authorization") ?? "").replace("Bearer ", "");
  if (!token) return null;
  const { data: { user } } = await supabase.auth.getUser(token);
  if (!user) return null;
  // Emails con acceso directo (fallback si profiles no tiene el rol correcto)
  const ADMIN_EMAILS = [
    "admin@margaritacabrera.edu.pe",
    "staff@margaritacabrera.edu.pe",
    "nvasquez@margaritacabrera.edu.pe",
    "milnarvaez@margaritacabrera.edu.pe",
  ];
  if (user.email && ADMIN_EMAILS.includes(user.email.toLowerCase())) return user;
  // Verificar rol en profiles
  const { data: profile } = await supabaseAdmin
    .from("profiles").select("rol").eq("id", user.id).single();
  if (!profile || !["super_admin", "staff_tramites", "gestor", "actualizacion"].includes(profile.rol)) return null;
  return user;
}

/**
 * GET /api/admin/solicitudes-ops?tipo=tramite|actualizacion
 */
export async function GET(req: NextRequest) {
  const admin = await verifyAdmin(req);
  if (!admin) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const tipo = req.nextUrl.searchParams.get("tipo") ?? "tramite";

  const { data, error } = await supabaseAdmin
    .from("solicitudes")
    .select("*")
    .eq("tipo_formulario", tipo)
    .order("created_at", { ascending: false })
    .limit(500);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

/**
 * PUT /api/admin/solicitudes-ops
 * Body: { id, estado, observacion? }
 */
export async function PUT(req: NextRequest) {
  const admin = await verifyAdmin(req);
  if (!admin) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const body = await req.json();
  const { id, estado, observacion, voucher_url, dni_anverso_url, dni_reverso_url } = body;
  if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 });

  const update: Record<string, unknown> = {};
  if (estado) update.estado = estado;
  if (observacion !== undefined) update.observacion = observacion;
  if (voucher_url) update.voucher_url = voucher_url;
  if (dni_anverso_url) update.dni_anverso_url = dni_anverso_url;
  if (dni_reverso_url) update.dni_reverso_url = dni_reverso_url;

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "Nada que actualizar" }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from("solicitudes")
    .update(update)
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

/**
 * DELETE /api/admin/solicitudes-ops
 * Body: { action: "delete_all" } — borra todas
 * Body: { action: "delete_one", id: "uuid" } — borra una
 */
export async function DELETE(req: NextRequest) {
  const admin = await verifyAdmin(req);
  if (!admin) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const body = await req.json();
  const { action, id } = body;

  if (action === "delete_one" && id) {
    const { error } = await supabaseAdmin
      .from("solicitudes")
      .delete()
      .eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  // delete_all
  const { error } = await supabaseAdmin
    .from("solicitudes")
    .delete()
    .neq("id", "00000000-0000-0000-0000-000000000000");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
