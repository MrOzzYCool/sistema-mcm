import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { supabase } from "@/lib/supabase";

/**
 * POST /api/admin/purge-test-user
 * Elimina COMPLETAMENTE un usuario de prueba del sistema:
 * - Borra alumno_cursos, historial_ciclos, inscripciones (manual por seguridad)
 * - Borra profile
 * - Borra usuario de Supabase Auth
 * Esto permite recrear el usuario con el mismo email/DNI después.
 * Solo super_admin puede usar esta acción.
 */
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.replace("Bearer ", "");
  const { data: { user: admin } } = await supabase.auth.getUser(token);

  if (!admin?.email || admin.email.toLowerCase() !== "admin@margaritacabrera.edu.pe") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { userId } = await req.json();
  if (!userId) {
    return NextResponse.json({ error: "userId es requerido" }, { status: 400 });
  }

  // No permitir autoeliminación
  if (userId === admin.id) {
    return NextResponse.json({ error: "No puedes eliminar tu propia cuenta" }, { status: 400 });
  }

  try {
    // Obtener datos del usuario antes de borrar (para auditoría)
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("nombre_completo, rol, dni")
      .eq("id", userId)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
    }

    // Obtener email del auth
    const { data: { user: targetUser } } = await supabaseAdmin.auth.admin.getUserById(userId);
    const targetEmail = targetUser?.email ?? "desconocido";

    // 1. Borrar alumno_cursos (FK a profiles con CASCADE, pero lo hacemos explícito)
    await supabaseAdmin.from("alumno_cursos").delete().eq("alumno_id", userId);

    // 2. Borrar historial_ciclos
    await supabaseAdmin.from("historial_ciclos").delete().eq("alumno_id", userId);

    // 3. Borrar inscripciones
    await supabaseAdmin.from("inscripciones").delete().eq("alumno_id", userId);

    // 4. Borrar profile
    await supabaseAdmin.from("profiles").delete().eq("id", userId);

    // 5. Borrar usuario de Supabase Auth (esto también dispara CASCADE en profiles si aún existe)
    const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (authError) {
      return NextResponse.json({
        error: `Datos borrados pero error al eliminar Auth: ${authError.message}. El usuario puede necesitar limpieza manual en Supabase Auth.`,
      }, { status: 500 });
    }

    // 6. Auditoría
    await supabaseAdmin.from("historial_auditoria").insert({
      accion: "purgar_usuario_prueba",
      admin_id: admin.id,
      admin_email: admin.email,
      target_id: userId,
      detalle: {
        nombre_completo: profile.nombre_completo,
        email: targetEmail,
        rol: profile.rol,
        dni: profile.dni,
      },
    });

    return NextResponse.json({
      success: true,
      message: `Usuario de prueba "${profile.nombre_completo}" (${targetEmail}) eliminado completamente.`,
    });

  } catch (err) {
    console.error("Error purgando usuario de prueba:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error interno" },
      { status: 500 },
    );
  }
}
