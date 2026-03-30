import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { generarBoleta } from "@/lib/nubefactService";
import { enviarCorreoAprobacion } from "@/lib/emailService";

export async function POST(req: NextRequest) {
  try {
    const { id }: { id: string } = await req.json();

    // 1. Obtener datos de la solicitud
    const { data: sol, error: fetchErr } = await supabase
      .from("solicitudes")
      .select("email, nombres, apellidos, dni, tipo_tramite, monto_pagado")
      .eq("id", id)
      .single();

    if (fetchErr || !sol) {
      return NextResponse.json({ error: "Solicitud no encontrada" }, { status: 404 });
    }

    // 2. Generar boleta en Nubefact — si falla, devuelve error sin cambiar estado
    let pdfUrl = "";
    try {
      const boleta = await generarBoleta({
        dniCliente:    sol.dni,
        nombreCliente: `${sol.nombres} ${sol.apellidos}`,
        monto:         Number(sol.monto_pagado),
        descripcion:   sol.tipo_tramite,
      });
      pdfUrl = boleta.pdfUrl;
    } catch (nubefactErr) {
      const msg = nubefactErr instanceof Error ? nubefactErr.message : "Error generando boleta";
      return NextResponse.json({ error: `Nubefact: ${msg}` }, { status: 502 });
    }

    // 3. Actualizar estado + guardar URL del PDF
    const { error: updateErr } = await supabase
      .from("solicitudes")
      .update({ estado: "aprobado", pdf_boleta_url: pdfUrl })
      .eq("id", id);

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    // 4. Enviar correo de aprobación (no bloqueante)
    try {
      await enviarCorreoAprobacion({
        email:       sol.email,
        nombres:     sol.nombres,
        apellidos:   sol.apellidos,
        tipoTramite: sol.tipo_tramite,
        pdfUrl,
      });
    } catch (emailErr) {
      console.error("Error enviando correo de aprobación:", emailErr);
    }

    return NextResponse.json({ success: true, pdfUrl });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error interno" },
      { status: 500 }
    );
  }
}
