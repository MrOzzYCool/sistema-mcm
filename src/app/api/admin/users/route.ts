import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { supabase } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.replace("Bearer ", "");
  const { data: { user } } = await supabase.auth.getUser(token);
  if (!user?.email || user.email.toLowerCase() !== "admin@margaritacabrera.edu.pe") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { data, error } = await supabaseAdmin.from("profiles")
    .select("id, nombre_completo, rol, estado, dni, created_at")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Enriquecer con email de Auth
  const { data: { users: authUsers } } = await supabaseAdmin.auth.admin.listUsers();
  const emailMap = new Map(authUsers?.map((u) => [u.id, u.email]) ?? []);

  const enriched = (data ?? []).map((p) => ({
    ...p,
    email: emailMap.get(p.id) ?? "—",
  }));

  return NextResponse.json(enriched);
}
