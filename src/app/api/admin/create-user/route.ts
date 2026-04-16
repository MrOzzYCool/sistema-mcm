import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { supabase } from "@/lib/supabase";
import { generatePassword } from "@/lib/password-utils";

const ADMIN_EMAILS = [
  "admin@margaritacabrera.edu.pe",
];

async function verifyAdmin(req: NextRequest) {
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.replace("Bearer ", "");
  if (!token) return null;
  const { data: { user } } = await supabase.auth.getUser(token);
  if (!user?.email || !ADMIN_EMAILS.includes(user.email.toLowerCase())) return null;
  return user;
}

export async function POST(req: NextRequest) {
  const admin = await verifyAdmin(req);
  if (!admin) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  try {
    const body = await req.json();
    const {
      tipo,             // "alumno" | "profesor"
      nombre_completo,
      email,
      dni,
      password: customPassword,
      auto_password,    // boolean
      force_change,     // boolean
      notify_email,     // boolean
    } = body;

    if (!tipo || !nombre_completo || !email) {
      return NextResponse.json({ error: "Faltan campos obligatorios" }, { status: 400 });
    }

    // Generar o usar contraseña
    const password = auto_password ? generatePassword() : customPassword;
    if (!password || password.length < 6) {
      return NextResponse.json({ error: "La contraseña debe tener al menos 6 caracteres" }, { status: 400 });
    }

    // Crear usuario en Auth con Admin API
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: nombre_completo },
    });

    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 400 });
    }

    const userId = authData.user.id;

    // Crear perfil
    await supabaseAdmin.from("profiles").upsert({
      id:              userId,
      nombre_completo,
      rol:             tipo,
      estado:          "activo",
      dni:             dni || null,
      created_by:      admin.id,
    });

    // Auditoría
    await supabaseAdmin.from("historial_auditoria").insert({
      accion:      "crear_usuario",
      detalle:     { tipo, email, nombre_completo, force_change, notify_email },
      admin_id:    admin.id,
      admin_email: admin.email,
      target_id:   userId,
    });

    // Enviar email con credenciales si corresponde
    if (notify_email) {
      try {
        const { Resend } = await import("resend");
        const resend = new Resend(process.env.RESEND_API_KEY);
        await resend.emails.send({
          from: "I.E.S. Privada Margarita Cabrera <tramites@margaritacabrera.edu.pe>",
          to:   email,
          subject: "Tu cuenta ha sido creada — I.E.S. Privada Margarita Cabrera",
          html: `
            <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#1e293b;">
              <div style="background:linear-gradient(135deg,#a93526,#8a2b1f);padding:32px 24px;border-radius:12px 12px 0 0;text-align:center;">
                <h1 style="color:#fff;margin:0;font-size:22px;">I.E.S. Privada Margarita Cabrera</h1>
              </div>
              <div style="background:#fff;padding:32px 24px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px;">
                <p>Hola <strong>${nombre_completo}</strong>,</p>
                <p>Se ha creado tu cuenta en el portal estudiantil. Aquí están tus credenciales:</p>
                <div style="background:#f8f5f5;border-left:4px solid #a93526;padding:16px;border-radius:0 8px 8px 0;margin:16px 0;">
                  <p style="margin:0;font-size:13px;color:#64748b;">Correo</p>
                  <p style="margin:4px 0 12px;font-weight:bold;">${email}</p>
                  <p style="margin:0;font-size:13px;color:#64748b;">Contraseña temporal</p>
                  <p style="margin:4px 0 0;font-family:monospace;font-weight:bold;font-size:16px;">${password}</p>
                </div>
                ${force_change ? '<p style="color:#dc2626;font-weight:600;">⚠️ Deberás cambiar tu contraseña al iniciar sesión por primera vez.</p>' : ""}
                <div style="text-align:center;margin:24px 0;">
                  <a href="${process.env.NEXT_PUBLIC_SITE_URL ?? "https://sistema-mcm.vercel.app"}"
                     style="display:inline-block;background:#a93526;color:#fff;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:600;">
                    Iniciar sesión →
                  </a>
                </div>
                <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;" />
                <p style="font-size:12px;color:#94a3b8;text-align:center;">© 2026 I.E.S. Privada Margarita Cabrera</p>
              </div>
            </div>
          `,
        });
      } catch (emailErr) {
        console.error("Error enviando email de bienvenida:", emailErr);
      }
    }

    return NextResponse.json({
      success: true,
      userId,
      email,
      // NO devolver la contraseña en la respuesta
    }, { status: 201 });

  } catch (err) {
    console.error("Error creando usuario:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error interno" },
      { status: 500 }
    );
  }
}
