import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { supabase } from "@/lib/supabase";
import { generatePassword } from "@/lib/password-utils";

const ADMIN_EMAILS = ["admin@margaritacabrera.edu.pe"];

async function verifyAdmin(req: NextRequest) {
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.replace("Bearer ", "");
  if (!token) return null;
  const { data: { user } } = await supabase.auth.getUser(token);
  if (!user?.email || !ADMIN_EMAILS.includes(user.email.toLowerCase())) return null;
  return user;
}

export async function POST(req: NextRequest) {
  try {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error("SUPABASE_SERVICE_ROLE_KEY no configurada");
      return NextResponse.json({ error: "Llave de servicio no configurada. Agrega SUPABASE_SERVICE_ROLE_KEY en Vercel." }, { status: 500 });
    }

    const admin = await verifyAdmin(req);
    if (!admin) {
      console.log("create-user: admin no verificado");
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    console.log("create-user: admin verificado:", admin.email);

    const body = await req.json();
    const { tipo, nombre_completo, email, dni, password: customPassword, auto_password, force_change, notify_email, carrera_id, ciclo_inicial } = body;

    if (!tipo || !nombre_completo || !email) {
      return NextResponse.json({ error: "Faltan campos obligatorios" }, { status: 400 });
    }

    // Validar carrera y ciclo para alumnos
    if (tipo === "alumno" && (!carrera_id || !ciclo_inicial)) {
      return NextResponse.json({ error: "Para alumnos, carrera y ciclo inicial son obligatorios" }, { status: 400 });
    }

    const password = auto_password ? generatePassword() : customPassword;
    if (!password || password.length < 6) {
      return NextResponse.json({ error: "La contraseña debe tener al menos 6 caracteres" }, { status: 400 });
    }

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
    console.log("create-user: Auth OK, userId:", userId);

    // Insertar en profiles — upsert para evitar duplicados
    const { data: profileData, error: profileError } = await supabaseAdmin
      .from("profiles")
      .upsert({
        id: userId,
        nombre_completo,
        rol: tipo,
        estado: "activo",
        dni: dni || null,
        created_by: admin.id,
      }, { onConflict: "id" })
      .select()
      .single();

    if (profileError) {
      console.error("create-user: ERROR en profiles:", profileError.message, profileError.details, profileError.hint);
      // Auth se creó pero profiles falló — informar al admin
      return NextResponse.json({
        success: false,
        warning: "Usuario creado en Auth pero NO en profiles",
        error: profileError.message,
        userId,
        email,
      }, { status: 207 }); // 207 Multi-Status
    }

    console.log("create-user: Profile creado OK:", profileData);

    // Crear inscripción para alumnos
    if (tipo === "alumno" && carrera_id) {
      const ciclo = parseInt(ciclo_inicial) || 1;
      const { error: inscError } = await supabaseAdmin.from("inscripciones").insert({
        alumno_id: userId,
        carrera_id,
        ciclo_actual: ciclo,
        fecha_inicio_ciclo: new Date().toISOString(),
        estado: "activo",
      });
      if (inscError) {
        console.error("create-user: Error inscripción:", inscError.message);
      } else {
        // Registrar en historial de ciclos
        await supabaseAdmin.from("historial_ciclos").insert({
          alumno_id: userId,
          carrera_id,
          ciclo,
          fecha_inicio: new Date().toISOString(),
          estado: "activo",
        });

        // Generar cursos del ciclo desde la malla curricular
        const { generarCursosCiclo } = await import("@/lib/generar-cursos-ciclo");
        const { creados, error: cursosErr } = await generarCursosCiclo(userId, carrera_id, ciclo);
        if (cursosErr) {
          console.error("create-user: Error generando cursos:", cursosErr);
        } else {
          console.log("create-user: Cursos generados:", creados);
        }

        console.log("create-user: Inscripción creada — carrera:", carrera_id, "ciclo:", ciclo);
      }
    }

    const { error: auditError } = await supabaseAdmin.from("historial_auditoria").insert({
      accion: "crear_usuario",
      detalle: { tipo, email, nombre_completo, force_change, notify_email },
      admin_id: admin.id,
      admin_email: admin.email,
      target_id: userId,
    });
    if (auditError) console.error("create-user: Error auditoría:", auditError.message);

    if (notify_email) {
      try {
        const { Resend } = await import("resend");
        const resend = new Resend(process.env.RESEND_API_KEY);
        const loginUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://sistema-mcm.vercel.app";
        await resend.emails.send({
          from: "I.E.S. Privada Margarita Cabrera <tramites@margaritacabrera.edu.pe>",
          to: email,
          subject: "Tu cuenta ha sido creada — I.E.S. Privada Margarita Cabrera",
          html: `
            <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#1e293b;">
              <div style="background:linear-gradient(135deg,#a93526,#8a2b1f);padding:32px 24px;border-radius:12px 12px 0 0;text-align:center;">
                <h1 style="color:#fff;margin:0;font-size:22px;">I.E.S. Privada Margarita Cabrera</h1>
              </div>
              <div style="background:#fff;padding:32px 24px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px;">
                <p>Hola <strong>${nombre_completo}</strong>,</p>
                <p>Se ha creado tu cuenta. Aquí están tus credenciales:</p>
                <div style="background:#f8f5f5;border-left:4px solid #a93526;padding:16px;border-radius:0 8px 8px 0;margin:16px 0;">
                  <p style="margin:0;font-size:13px;color:#64748b;">Correo</p>
                  <p style="margin:4px 0 12px;font-weight:bold;">${email}</p>
                  <p style="margin:0;font-size:13px;color:#64748b;">Contraseña temporal</p>
                  <p style="margin:4px 0 0;font-family:monospace;font-weight:bold;font-size:16px;">${password}</p>
                </div>
                ${force_change ? '<p style="color:#dc2626;font-weight:600;">Deberás cambiar tu contraseña al iniciar sesión.</p>' : ""}
                <div style="text-align:center;margin:24px 0;">
                  <a href="${loginUrl}" style="display:inline-block;background:#a93526;color:#fff;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:600;">Iniciar sesión</a>
                </div>
                <p style="font-size:12px;color:#94a3b8;text-align:center;">© 2026 I.E.S. Privada Margarita Cabrera</p>
              </div>
            </div>
          `,
        });
      } catch (emailErr) {
        console.error("Error enviando email de bienvenida:", emailErr);
      }
    }

    return NextResponse.json({ success: true, userId, email, profileCreated: true }, { status: 201 });

  } catch (err) {
    console.error("Error creando usuario:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error interno" },
      { status: 500 }
    );
  }
}
