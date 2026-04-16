import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { supabase } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.replace("Bearer ", "");
  const { data: { user: admin } } = await supabase.auth.getUser(token);
  if (!admin?.email || admin.email.toLowerCase() !== "admin@margaritacabrera.edu.pe") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { userId, estado } = await req.json();
  if (!userId || !estado) return NextResponse.json({ error: "Datos incompletos" }, { status: 400 });

  const { error } = await supabaseAdmin.from("profiles").update({ estado }).eq("id", userId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Auditoría
  await supabaseAdmin.from("historial_auditoria").insert({
    accion: estado === "activo" ? "activar_usuario" : "desactivar_usuario",
    admin_id: admin.id, admin_email: admin.email, target_id: userId,
  });

  return NextResponse.json({ success: true });
}
