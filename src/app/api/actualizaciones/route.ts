import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

const EMAILS_PERMITIDOS = [
  "admin@margaritacabrera.edu.pe",
  "milnarvaez@margaritacabrera.edu.pe",
];

async function verificarAcceso(req: NextRequest): Promise<string | null> {
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.replace("Bearer ", "");
  if (!token) return null;

  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user?.email) return null;

  const email = user.email.toLowerCase();
  return EMAILS_PERMITIDOS.includes(email) ? email : null;
}

export async function GET(req: NextRequest) {
  const email = await verificarAcceso(req);
  if (!email) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { data, error } = await supabase
    .from("solicitudes")
    .select("*")
    .eq("tipo_formulario", "actualizacion")
    .order("created_at", { ascending: false })
    .limit(500);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}
