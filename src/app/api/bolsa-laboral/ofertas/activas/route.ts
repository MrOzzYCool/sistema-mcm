import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { verifyAlumnaBolsa } from "@/lib/bolsa-laboral/verify-alumna-bolsa";

export async function GET(req: NextRequest) {
  const user = await verifyAlumnaBolsa(req);
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { data, error } = await supabaseAdmin
    .from("ofertas_laborales")
    .select("*")
    .eq("estado", "activa")
    .order("fecha_publicacion", { ascending: false });

  if (error) {
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }

  return NextResponse.json(data, { status: 200 });
}
