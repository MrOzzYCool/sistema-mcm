import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { enviarCorreoRechazo, ObservacionesCampos } from "@/lib/emailService";

export async function POST(req: NextRequest) {
  try {
    const { id, observaciones }: { id: string; observaciones: ObservacionesCampos } = await req.json();

    // 1. Obtener datos de la solicitud
    const { data: sol, error: fetchErr } = await supabase
      .from("solicitudes")
      .select("email, nombres, apellidos, tipo_tramite, token_subsanacion")
      .eq("id", id)
      .single();

    if (fetchErr || !sol) {
      return NextResponse.json({ error: "Solicitud no encontrada" }, { status: 404 });
    }

    // 2. Actualizar estado y guardar observaciones en JSONB
    const { error: updateErr } = await supabase
      .from("solicitudes")
      .update({ estado: "rechazado", observaciones })
      .eq("id", id);

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    // 3. Enviar correo de rechazo
    const baseUrl = req.headers.get("origin") ?? process.env.NEXT_PUBLIC_SITE_URL ?? "";
    try {
      await enviarCorreoRechazo({
        email:         sol.email,
        nombres:       sol.nombres,
        apellidos:     sol.apellidos,
        tipoTramite:   sol.tipo_tramite,
        token:         sol.token_subsanacion,
        observaciones,
        baseUrl,
      });
    } catch (emailErr) {
      console.error("Error enviando correo de rechazo:", emailErr);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error interno" },
      { status: 500 }
    );
  }
}
