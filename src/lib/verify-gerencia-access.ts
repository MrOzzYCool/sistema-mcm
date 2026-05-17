import { NextRequest } from "next/server";
import { supabase } from "@/lib/supabase";
import { supabaseAdmin } from "@/lib/supabase-admin";

/**
 * Verifica que el request tenga un JWT válido y que el usuario
 * tenga rol `gerenta` o `super_admin` en la tabla profiles.
 *
 * Retorna el objeto de usuario con id, email y role, o null si no autorizado.
 */
export async function verifyGerenciaAccess(
  req: NextRequest
): Promise<{ id: string; email: string; role: string } | null> {
  const token = (req.headers.get("authorization") ?? "").replace("Bearer ", "");
  if (!token) return null;

  // Validar JWT con el cliente público (anon key)
  const {
    data: { user },
  } = await supabase.auth.getUser(token);
  if (!user) return null;

  // Consultar rol desde profiles usando el cliente admin (bypass RLS)
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("rol")
    .eq("id", user.id)
    .single();

  if (!profile || !["gerenta", "super_admin"].includes(profile.rol)) {
    return null;
  }

  return {
    id: user.id,
    email: user.email ?? "",
    role: profile.rol,
  };
}
