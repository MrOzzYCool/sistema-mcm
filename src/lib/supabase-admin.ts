import { createClient } from "@supabase/supabase-js";

// Cliente con SERVICE_ROLE_KEY — solo para server-side (API routes)
// NUNCA importar este archivo en componentes del cliente
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);
