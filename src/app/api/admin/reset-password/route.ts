import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { supabase } from "@/lib/supabase";

const DEFAULT_PASSWORD = "Margarita2026*";

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.replace("Bearer ", "");
  const { data: { user: admin } } = await supabase.auth.getUser(token);
  if (!admin?.email || admin.email.toLowerCase() !== "admin@margaritacabrera.edu.pe") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { userId } = await req.json();
  if (!userId) return NextResponse.json({ error: "userId requerido" }, { status: 400 });

  // Reset password to default
  const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
    password: DEFAULT_PASSWORD,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Mark force_password_reset so user must change it on next login
  await supabaseAdmin.from("profiles").update({ force_password_reset: true }).eq("id", userId);

  // Auditoría
  await supabaseAdmin.from("historial_auditoria").insert({
    accion: "reset_password", admin_id: admin.id, admin_email: admin.email, target_id: userId,
  });

  return NextResponse.json({
    success: true,
    message: `Contraseña restablecida a: ${DEFAULT_PASSWORD}. El usuario deberá cambiarla al iniciar sesión.`,
  });
}
