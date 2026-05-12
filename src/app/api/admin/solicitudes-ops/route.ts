import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { supabase } from "@/lib/supabase";

async function verifyAdmin(req: NextRequest) {
  const token = (req.headers.get("authorization") ?? "").replace("Bearer ", "");
  if (!token) return null;
  const { data: { user } } = await supabase.auth.getUser(token);
  if (!user) return null;
  // Verificar que sea admin/staff
  if (user.email?.toLowerCase() === "admin@margaritacabrera.edu.pe") return user;
  const { data: profile } = await supabaseAdmin
    .from("profiles").select("rol").eq("id", user.id).single();
  if (!profile || !["super_admin", "staff_tramites", "gestor"].includes(profile.rol)) return null;
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

  const { id, estado, observacion } = await req.json();
  if (!id || !estado) return NextResponse.json({ error: "id y estado requeridos" }, { status: 400 });

  const update: Record<string, unknown> = { estado };
  if (observacion !== undefined) update.observacion = observacion;

  const { error } = await supabaseAdmin
    .from("solicitudes")
    .update(update)
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

/**
 * DELETE /api/admin/solicitudes-ops
 * Body: { action: "delete_all" } — borra todas las solicitudes
 */
export async function DELETE(req: NextRequest) {
  const admin = await verifyAdmin(req);
  if (!admin) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const { error } = await supabaseAdmin
    .from("solicitudes")
    .delete()
    .neq("id", "00000000-0000-0000-0000-000000000000");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
