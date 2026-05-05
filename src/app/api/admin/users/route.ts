import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { supabase } from "@/lib/supabase";

const ALLOWED_ROLES = ["super_admin", "staff_tramites", "gestor"];

async function checkAdmin(req: NextRequest) {
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.replace("Bearer ", "");
  const { data: { user } } = await supabase.auth.getUser(token);
  if (!user) return null;

  // Verificar rol en la tabla profiles
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("rol")
    .eq("id", user.id)
    .single();

  if (!profile || !ALLOWED_ROLES.includes(profile.rol)) {
    return null;
  }
  return user;
}

export async function GET(req: NextRequest) {
  const admin = await checkAdmin(req);
  if (!admin) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const { data, error } = await supabaseAdmin.from("profiles")
    .select("id, nombre_completo, rol, estado, dni, created_at")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Enriquecer con email de Auth
  const { data: { users: authUsers } } = await supabaseAdmin.auth.admin.listUsers();
  const emailMap = new Map(authUsers?.map((u) => [u.id, u.email]) ?? []);

  const enriched = (data ?? []).map((p) => ({
    ...p,
    email: emailMap.get(p.id) ?? "—",
  }));

  return NextResponse.json(enriched);
}

export async function PUT(req: NextRequest) {
  const admin = await checkAdmin(req);
  if (!admin) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const { userId, nombre_completo, email, rol, estado, dni } = await req.json();

  if (!userId) return NextResponse.json({ error: "userId requerido" }, { status: 400 });

  // Actualizar profile en Supabase
  const updateData: Record<string, string | null> = {};
  if (nombre_completo !== undefined) updateData.nombre_completo = nombre_completo.trim();
  if (rol !== undefined) updateData.rol = rol;
  if (estado !== undefined) updateData.estado = estado;
  if (dni !== undefined) updateData.dni = dni?.trim() || null;

  if (Object.keys(updateData).length > 0) {
    const { error } = await supabaseAdmin.from("profiles").update(updateData).eq("id", userId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Actualizar email en Auth si cambió
  if (email) {
    const { error: authErr } = await supabaseAdmin.auth.admin.updateUserById(userId, { email });
    if (authErr) return NextResponse.json({ error: `Error actualizando email: ${authErr.message}` }, { status: 500 });
  }

  // Auditoría
  await supabaseAdmin.from("historial_auditoria").insert({
    accion: "editar_usuario",
    admin_id: admin.id,
    admin_email: admin.email,
    target_id: userId,
  }).then(() => {});

  return NextResponse.json({ success: true });
}
