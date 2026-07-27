import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET(req: NextRequest) {
  // Verify admin auth (super_admin)
  const token = (req.headers.get("authorization") ?? "").replace("Bearer ", "");
  if (!token) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const {
    data: { user },
    error: authError,
  } = await supabaseAdmin.auth.getUser(token);

  if (authError || !user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("rol")
    .eq("id", user.id)
    .single();

  if (!profile || profile.rol !== "super_admin") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  // Count pending solicitudes
  const { count, error } = await supabaseAdmin
    .from("solicitudes_acceso_bolsa")
    .select("*", { count: "exact", head: true })
    .eq("estado", "pendiente");

  if (error) {
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }

  return NextResponse.json({ count: count ?? 0 }, { status: 200 });
}
