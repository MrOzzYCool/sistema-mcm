import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { supabase } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  // Paso 1: Extraer token y verificar autorización
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.replace("Bearer ", "");
  const { data: { user: admin } } = await supabase.auth.getUser(token);
  if (!admin?.email || admin.email.toLowerCase() !== "admin@margaritacabrera.edu.pe") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  // Paso 2: Parsear body y validar userId
  const { userId } = await req.json();
  if (!userId || !userId.trim()) {
    return NextResponse.json({ error: "userId es requerido" }, { status: 400 });
  }

  // Paso 3: Prevenir auto-eliminación
  if (userId === admin.id) {
    return NextResponse.json({ error: "No puedes eliminar tu propia cuenta" }, { status: 400 });
  }

  // Paso 4: Consultar perfil del target
  const { data: profile, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("nombre_completo, rol")
    .eq("id", userId)
    .single();

  if (profileError || !profile) {
    return NextResponse.json({ error: "Usuario no encontrado" }, { status: 400 });
  }

  // Paso 5: Obtener email del target desde Auth
  const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(userId);
  const targetEmail = authUser?.user?.email ?? "";

  // Paso 6: Actualizar estado a eliminado
  const { error: updateError } = await supabaseAdmin
    .from("profiles")
    .update({ estado: "eliminado" })
    .eq("id", userId);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  // Paso 7: Banear cuenta Auth
  const { error: banError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
    ban_duration: "876600h",
  });

  if (banError) {
    return NextResponse.json(
      { error: "Error al banear la cuenta de autenticación" },
      { status: 500 }
    );
  }

  // Paso 8: Insertar registro de auditoría
  await supabaseAdmin.from("historial_auditoria").insert({
    accion: "eliminar_usuario",
    admin_id: admin.id,
    admin_email: admin.email,
    target_id: userId,
    detalle: {
      nombre_completo: profile.nombre_completo,
      email: targetEmail,
      rol: profile.rol,
    },
  });

  // Paso 9: Retornar éxito
  return NextResponse.json({ success: true });
}
