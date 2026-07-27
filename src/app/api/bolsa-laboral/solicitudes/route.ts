import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { supabase } from "@/lib/supabase";
import { validateSolicitud } from "@/lib/bolsa-laboral/validations";
import { generatePassword } from "@/lib/password-utils";

// ─── Admin Verification ──────────────────────────────────────────────────────

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

// ─── POST: Crear solicitud de acceso (público) ───────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const data = body as Record<string, unknown>;

    // Validate solicitud fields
    const errors = validateSolicitud(data as Partial<{
      alumna_nombre: string;
      alumna_dni: string;
      alumna_email: string;
      alumna_telefono?: string;
      carrera: string;
      anio_ingreso: number;
      anio_egreso: number;
    }>);

    if (Object.keys(errors).length > 0) {
      const campos = Object.keys(errors).join(", ");
      return NextResponse.json(
        { error: `Campos requeridos faltantes: ${campos}` },
        { status: 400 }
      );
    }

    // Check for existing pending/approved solicitud with same DNI
    const { data: existing } = await supabaseAdmin
      .from("solicitudes_acceso_bolsa")
      .select("id")
      .eq("alumna_dni", data.alumna_dni)
      .in("estado", ["pendiente", "aprobada"])
      .limit(1);

    if (existing && existing.length > 0) {
      return NextResponse.json(
        { error: "Ya existe una solicitud para este DNI" },
        { status: 409 }
      );
    }

    // Insert solicitud with estado 'pendiente'
    const { data: solicitud, error: insertError } = await supabaseAdmin
      .from("solicitudes_acceso_bolsa")
      .insert({
        alumna_nombre: (data.alumna_nombre as string).trim(),
        alumna_dni: (data.alumna_dni as string).trim(),
        alumna_email: (data.alumna_email as string).trim().toLowerCase(),
        alumna_telefono: data.alumna_telefono ? (data.alumna_telefono as string).trim() : null,
        carrera: (data.carrera as string).trim(),
        anio_ingreso: Number(data.anio_ingreso),
        anio_egreso: Number(data.anio_egreso),
        estado: "pendiente",
      })
      .select()
      .single();

    if (insertError) {
      console.error("solicitudes POST: Error inserting:", insertError.message);
      return NextResponse.json(
        { error: "Error interno del servidor" },
        { status: 500 }
      );
    }

    return NextResponse.json(solicitud, { status: 201 });
  } catch (err) {
    console.error("solicitudes POST: Error:", err);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

// ─── GET: Listar solicitudes (super_admin) ───────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const admin = await verifyAdmin(req);
    if (!admin) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const { data: solicitudes, error } = await supabaseAdmin
      .from("solicitudes_acceso_bolsa")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("solicitudes GET: Error:", error.message);
      return NextResponse.json(
        { error: "Error interno del servidor" },
        { status: 500 }
      );
    }

    return NextResponse.json(solicitudes, { status: 200 });
  } catch (err) {
    console.error("solicitudes GET: Error:", err);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

// ─── PATCH: Aprobar/Rechazar solicitud (super_admin) ─────────────────────────

export async function PATCH(req: NextRequest) {
  try {
    const admin = await verifyAdmin(req);
    if (!admin) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const body = await req.json();
    const { id, action, motivo_rechazo } = body as {
      id: string;
      action: "aprobar" | "rechazar";
      motivo_rechazo?: string;
    };

    if (!id || !action) {
      return NextResponse.json(
        { error: "Campos requeridos faltantes: id, action" },
        { status: 400 }
      );
    }

    // Fetch the solicitud
    const { data: solicitud, error: fetchError } = await supabaseAdmin
      .from("solicitudes_acceso_bolsa")
      .select("*")
      .eq("id", id)
      .single();

    if (fetchError || !solicitud) {
      return NextResponse.json(
        { error: "Solicitud no encontrada" },
        { status: 404 }
      );
    }

    // ─── APROBAR ─────────────────────────────────────────────────────────────

    if (action === "aprobar") {
      const alumnaEmail = solicitud.alumna_email;
      const alumnaNombre = solicitud.alumna_nombre;

      // Check if email already exists in auth.users
      const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
      const emailExists = existingUsers?.users?.some(
        (u) => u.email?.toLowerCase() === alumnaEmail.toLowerCase()
      );

      if (emailExists) {
        return NextResponse.json(
          { error: "El email ya está registrado en el sistema" },
          { status: 409 }
        );
      }

      // Generate temp password and create auth user
      const tempPassword = generatePassword();

      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: alumnaEmail,
        password: tempPassword,
        email_confirm: true,
        user_metadata: { full_name: alumnaNombre },
      });

      if (authError) {
        // Could be duplicate email at auth level
        if (authError.message.includes("already") || authError.message.includes("existe")) {
          return NextResponse.json(
            { error: "El email ya está registrado en el sistema" },
            { status: 409 }
          );
        }
        console.error("solicitudes PATCH: Auth error:", authError.message);
        return NextResponse.json(
          { error: "Error interno del servidor" },
          { status: 500 }
        );
      }

      const userId = authData.user.id;

      // Create profile with rol='alumna_bolsa' and force_password_reset=true
      const { error: profileError } = await supabaseAdmin
        .from("profiles")
        .upsert({
          id: userId,
          nombre_completo: alumnaNombre,
          rol: "alumna_bolsa",
          estado: "activo",
          force_password_reset: true,
          created_by: admin.id,
        }, { onConflict: "id" });

      if (profileError) {
        console.error("solicitudes PATCH: Profile error:", profileError.message);
      }

      // Update solicitud estado to 'aprobada' and set aprobada_por
      const { error: updateError } = await supabaseAdmin
        .from("solicitudes_acceso_bolsa")
        .update({
          estado: "aprobada",
          aprobada_por: admin.id,
        })
        .eq("id", id);

      if (updateError) {
        console.error("solicitudes PATCH: Update error:", updateError.message);
        return NextResponse.json(
          { error: "Error interno del servidor" },
          { status: 500 }
        );
      }

      // Send email via Resend — if it fails, still complete approval
      let emailSent = true;
      try {
        const { Resend } = await import("resend");
        const resend = new Resend(process.env.RESEND_API_KEY);
        const loginUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://sistema-mcm.vercel.app";

        await resend.emails.send({
          from: "I.E.S. Privada Margarita Cabrera <tramites@margaritacabrera.edu.pe>",
          to: alumnaEmail,
          subject: "Acceso aprobado - Bolsa Laboral MCM",
          html: `
            <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#1e293b;">
              <div style="background:linear-gradient(135deg,#a93526,#8a2b1f);padding:32px 24px;border-radius:12px 12px 0 0;text-align:center;">
                <h1 style="color:#fff;margin:0;font-size:22px;">I.E.S. Privada Margarita Cabrera</h1>
                <p style="color:#fecaca;margin:8px 0 0;font-size:14px;">Bolsa Laboral</p>
              </div>
              <div style="background:#fff;padding:32px 24px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px;">
                <p>Hola <strong>${alumnaNombre}</strong>,</p>
                <p>Tu solicitud de acceso a la Bolsa Laboral ha sido aprobada. Aquí están tus credenciales de ingreso:</p>
                <div style="background:#f8f5f5;border-left:4px solid #a93526;padding:16px;border-radius:0 8px 8px 0;margin:16px 0;">
                  <p style="margin:0;font-size:13px;color:#64748b;">Correo</p>
                  <p style="margin:4px 0 12px;font-weight:bold;">${alumnaEmail}</p>
                  <p style="margin:0;font-size:13px;color:#64748b;">Contraseña temporal</p>
                  <p style="margin:4px 0 0;font-family:monospace;font-weight:bold;font-size:16px;">${tempPassword}</p>
                </div>
                <p style="color:#dc2626;font-weight:600;">Deberás cambiar tu contraseña al iniciar sesión por primera vez.</p>
                <div style="text-align:center;margin:24px 0;">
                  <a href="${loginUrl}" style="display:inline-block;background:#a93526;color:#fff;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:600;">Iniciar sesión</a>
                </div>
                <p style="font-size:12px;color:#94a3b8;text-align:center;">© 2026 I.E.S. Privada Margarita Cabrera</p>
              </div>
            </div>
          `,
        });
      } catch (emailErr) {
        console.error("solicitudes PATCH: Email send error:", emailErr);
        emailSent = false;
      }

      if (!emailSent) {
        return NextResponse.json({
          success: true,
          warning: "Email no enviado",
          tempPassword,
          userId,
        }, { status: 200 });
      }

      return NextResponse.json({
        success: true,
        userId,
        email: alumnaEmail,
      }, { status: 200 });
    }

    // ─── RECHAZAR ────────────────────────────────────────────────────────────

    if (action === "rechazar") {
      if (!motivo_rechazo || motivo_rechazo.trim() === "") {
        return NextResponse.json(
          { error: "Se requiere motivo de rechazo" },
          { status: 400 }
        );
      }

      const { error: updateError } = await supabaseAdmin
        .from("solicitudes_acceso_bolsa")
        .update({
          estado: "rechazada",
          motivo_rechazo: motivo_rechazo.trim(),
        })
        .eq("id", id);

      if (updateError) {
        console.error("solicitudes PATCH: Reject update error:", updateError.message);
        return NextResponse.json(
          { error: "Error interno del servidor" },
          { status: 500 }
        );
      }

      return NextResponse.json({ success: true }, { status: 200 });
    }

    return NextResponse.json(
      { error: "Acción no válida. Use 'aprobar' o 'rechazar'" },
      { status: 400 }
    );
  } catch (err) {
    console.error("solicitudes PATCH: Error:", err);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
