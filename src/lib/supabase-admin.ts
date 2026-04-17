import { createClient, SupabaseClient } from "@supabase/supabase-js";

// Cliente con SERVICE_ROLE_KEY — solo para server-side (API routes)
// NUNCA importar este archivo en componentes del cliente
// Se inicializa de forma lazy para evitar errores durante el build de Next.js

let _admin: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
  if (!_admin) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      throw new Error("Faltan variables de entorno SUPABASE para admin (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)");
    }
    _admin = createClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }
  return _admin;
}

// Mantener export por compatibilidad — se evalúa solo cuando se accede en runtime
export const supabaseAdmin = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    return (getSupabaseAdmin() as unknown as Record<string | symbol, unknown>)[prop];
  },
});
