import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

/**
 * GET /api/auth/me
 * Returns the authenticated user's profile using supabaseAdmin (bypasses RLS).
 */
export async function GET(req: NextRequest) {
  const token = (req.headers.get("authorization") ?? "").replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "No token" }, { status: 401 });

  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("nombre_completo, rol, estado, force_password_reset, es_profesor, genero")
    .eq("id", user.id)
    .single();

  if (!profile) {
    return NextResponse.json({ error: "Perfil no encontrado" }, { status: 404 });
  }

  return NextResponse.json({
    id: user.id,
    email: user.email,
    nombre_completo: profile.nombre_completo,
    rol: profile.rol,
    es_profesor: profile.es_profesor,
    genero: profile.genero,
    force_password_reset: profile.force_password_reset,
  });
}
