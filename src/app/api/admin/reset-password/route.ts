import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { supabase } from "@/lib/supabase";
import { generatePassword } from "@/lib/password-utils";

export async function POST(req: NextRequest) {
  // Verificar admin
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.replace("Bearer ", "");
  const { data: { user: admin } } = await supabase.auth.getUser(token);
  if (!admin?.email || admin.email.toLowerCase() !== "admin@margaritacabrera.edu.pe") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { userId, notify_email } = await req.json();
  if (!userId) return NextResponse.json({ error: "userId requerido" }, { status: 400 });

  const tempPassword = generatePassword();

  const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
    password: tempPassword,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Auditoría
  await supabaseAdmin.from("historial_auditoria").insert({
    accion: "reset_password", admin_id: admin.id, admin_email: admin.email, target_id: userId,
  });

  // Obtener email del usuario para notificar
  if (notify_email) {
    const { data: profile } = await supabaseAdmin.from("profiles").select("nombre_completo").eq("id", userId).single();
    const { data: { user: targetUser } } = await supabaseAdmin.auth.admin.getUserById(userId);
    if (targetUser?.email) {
      try {
        const { Resend } = await import("resend");
        const resend = new Resend(process.env.RESEND_API_KEY);
        await resend.emails.send({
          from: "I.E.S. Privada Margarita Cabrera <tramites@margaritacabrera.edu.pe>",
          to: targetUser.email,
          subject: "Tu contraseña ha sido restablecida",
          html: `<p>Hola ${profile?.nombre_completo ?? ""},</p><p>Tu nueva contraseña temporal es: <strong style="font-family:monospace;font-size:16px;">${tempPassword}</strong></p><p>Cámbiala al iniciar sesión.</p>`,
        });
      } catch (e) { console.error("Error email reset:", e); }
    }
  }

  return NextResponse.json({ success: true });
}
