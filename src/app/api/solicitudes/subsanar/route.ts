import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { token, ...campos } = body as { token: string; [key: string]: string };

    // Buscar solicitud por token
    const { data: sol, error: fetchErr } = await supabase
      .from("solicitudes")
      .select("id")
      .eq("token_subsanacion", token)
      .single();

    if (fetchErr || !sol) {
      return NextResponse.json({ error: "Token inválido o solicitud no encontrada" }, { status: 404 });
    }

    // Actualizar solo los campos enviados + limpiar observaciones + volver a pendiente
    const { error: updateErr } = await supabase
      .from("solicitudes")
      .update({ ...campos, estado: "pendiente", observaciones: null })
      .eq("id", sol.id);

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error interno" },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  const token = new URL(req.url).searchParams.get("token");
  if (!token) return NextResponse.json({ error: "Token requerido" }, { status: 400 });

  const { data, error } = await supabase
    .from("solicitudes")
    .select("id, nombres, apellidos, tipo_tramite, observaciones, estado, voucher_url, dni_anverso_url, dni_reverso_url")
    .eq("token_subsanacion", token)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Solicitud no encontrada" }, { status: 404 });
  }

  return NextResponse.json(data);
}
