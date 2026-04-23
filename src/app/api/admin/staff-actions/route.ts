import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { supabase } from "@/lib/supabase";

async function verifyAdmin(req: NextRequest) {
  const token = (req.headers.get("authorization") ?? "").replace("Bearer ", "");
  if (!token) return null;
  const { data: { user } } = await supabase.auth.getUser(token);
  if (!user) return null;
  if (user.email?.toLowerCase() === "admin@margaritacabrera.edu.pe") return user;
  const { data: profile } = await supabaseAdmin
    .from("profiles").select("rol").eq("id", user.id).single();
  if (!profile || profile.rol !== "super_admin") return null;
  return user;
}

function generateTempPassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$";
  let pw = "";
  for (let i = 0; i < 12; i++) pw += chars[Math.floor(Math.random() * chars.length)];
  return pw;
}

async function logAction(staffId: string, action: string, performedBy: string, payload?: Record<string, unknown>) {
  await supabaseAdmin.from("staff_actions_log").insert({
    staff_id: staffId, action, performed_by: performedBy, payload: payload ?? {},
  });
}

/**
 * POST /api/admin/staff-actions
 * Body: { action, staffId, ...params }
 */
export async function POST(req: NextRequest) {
  const admin = await verifyAdmin(req);
  if (!admin) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const body = await req.json();
  const { action, staffId } = body;

  if (!action || !staffId) {
    return NextResponse.json({ error: "action y staffId requeridos" }, { status: 400 });
  }

  // Get staff profile
  const { data: staff } = await supabaseAdmin
    .from("profiles").select("id, nombre_completo, rol, estado").eq("id", staffId).single();
  if (!staff) return NextResponse.json({ error: "Personal no encontrado" }, { status: 404 });

  // Get staff email from Auth
  const { data: { user: staffUser } } = await supabaseAdmin.auth.admin.getUserById(staffId);
  const staffEmail = staffUser?.email ?? "";

  // ── RESET PASSWORD ──────────────────────────────────────────────────────
  if (action === "reset-password") {
    const tempPw = "123456";

    const { error: authErr } = await supabaseAdmin.auth.admin.updateUserById(staffId, {
      password: tempPw,
    });
    if (authErr) return NextResponse.json({ error: `Error Auth: ${authErr.message}` }, { status: 500 });

    await supabaseAdmin.from("profiles").update({ force_password_reset: true }).eq("id", staffId);
    await logAction(staffId, "reset_password", admin.id, { email: staffEmail });

    return NextResponse.json({ success: true, message: `Contraseña de ${staff.nombre_completo} restablecida a: 123456` });
  }

  // ── SET PASSWORD ────────────────────────────────────────────────────────
  if (action === "set-password") {
    const { password } = body;
    if (!password || password.length < 6) {
      return NextResponse.json({ error: "La contraseña debe tener al menos 6 caracteres" }, { status: 400 });
    }

    const { error: authErr } = await supabaseAdmin.auth.admin.updateUserById(staffId, { password });
    if (authErr) return NextResponse.json({ error: `Error Auth: ${authErr.message}` }, { status: 500 });

    await supabaseAdmin.from("profiles").update({ force_password_reset: false }).eq("id", staffId);
    await logAction(staffId, "set_password", admin.id, { email: staffEmail });

    return NextResponse.json({ success: true, message: "Contraseña actualizada" });
  }

  // ── TOGGLE FORCE PASSWORD RESET ─────────────────────────────────────────
  if (action === "toggle-force-reset") {
    const { value } = body; // boolean
    await supabaseAdmin.from("profiles").update({ force_password_reset: !!value }).eq("id", staffId);
    await logAction(staffId, "toggle_force_reset", admin.id, { value: !!value });
    return NextResponse.json({ success: true });
  }

  // ── SOFT DELETE (deactivate) ────────────────────────────────────────────
  if (action === "deactivate") {
    await supabaseAdmin.from("profiles").update({ estado: "inactivo" }).eq("id", staffId);
    await logAction(staffId, "deactivate", admin.id, { nombre: staff.nombre_completo });
    return NextResponse.json({ success: true, message: `${staff.nombre_completo} desactivado` });
  }

  // ── PERMANENT DELETE ────────────────────────────────────────────────────
  if (action === "permanent-delete") {
    // Delete from Auth (cascades to profiles via FK)
    const { error: authErr } = await supabaseAdmin.auth.admin.deleteUser(staffId);
    if (authErr) return NextResponse.json({ error: `Error eliminando: ${authErr.message}` }, { status: 500 });

    await logAction(staffId, "permanent_delete", admin.id, {
      nombre: staff.nombre_completo, email: staffEmail, rol: staff.rol,
    });

    return NextResponse.json({ success: true, message: `${staff.nombre_completo} eliminado permanentemente` });
  }

  return NextResponse.json({ error: "Acción no reconocida" }, { status: 400 });
}
