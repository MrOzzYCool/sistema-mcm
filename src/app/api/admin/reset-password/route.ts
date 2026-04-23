import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { supabase } from "@/lib/supabase";

const TEMP_PASSWORD = "123456";

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.replace("Bearer ", "");
  const { data: { user: admin } } = await supabase.auth.getUser(token);
  if (!admin?.email || admin.email.toLowerCase() !== "admin@margaritacabrera.edu.pe") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { userId } = await req.json();
  if (!userId) return NextResponse.json({ error: "userId requerido" }, { status: 400 });

  const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
    password: TEMP_PASSWORD,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Auditoría
  await supabaseAdmin.from("historial_auditoria").insert({
    accion: "reset_password", admin_id: admin.id, admin_email: admin.email, target_id: userId,
  });

  return NextResponse.json({ success: true, message: `Contraseña restablecida a: ${TEMP_PASSWORD}` });
}
