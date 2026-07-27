import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

/**
 * Verifica que el request tenga un JWT válido y que el usuario
 * tenga rol `alumna_bolsa` en la tabla profiles.
 *
 * Retorna el objeto de usuario de Supabase Auth, o null si no autorizado.
 */
export async function verifyAlumnaBolsa(
  req: NextRequest
): Promise<{ id: string; email: string } | null> {
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

  if (!profile || profile.rol !== "alumna_bolsa") return null;

  return {
    id: user.id,
    email: user.email ?? "",
  };
}
