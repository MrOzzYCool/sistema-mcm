import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

/** Roles que pueden acceder al portal de bolsa laboral */
const BOLSA_LABORAL_ROLES = ["alumna_bolsa", "alumno"];

/**
 * Verifica que el request tenga un JWT válido y que el usuario
 * tenga rol `alumna_bolsa` o `alumno` en la tabla profiles.
 *
 * Retorna el objeto de usuario de Supabase Auth con su rol, o null si no autorizado.
 */
export async function verifyAlumnaBolsa(
  req: NextRequest
): Promise<{ id: string; email: string; rol: string } | null> {
  const token = (req.headers.get("authorization") ?? "").replace("Bearer ", "");
  if (!token) return null;

  // Validar JWT usando el cliente admin (funciona server-side sin localStorage)
  const {
    data: { user },
    error: authError,
  } = await supabaseAdmin.auth.getUser(token);

  if (authError || !user) return null;

  // Consultar rol desde profiles usando el cliente admin (bypass RLS)
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("rol")
    .eq("id", user.id)
    .single();

  if (!profile || !BOLSA_LABORAL_ROLES.includes(profile.rol)) return null;

  return {
    id: user.id,
    email: user.email ?? "",
    rol: profile.rol,
  };
}
