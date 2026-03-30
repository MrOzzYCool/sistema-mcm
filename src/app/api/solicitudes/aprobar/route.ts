import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { generarBoleta } from "@/lib/nubefactService";
import { enviarCorreoAprobacion } from "@/lib/emailService";

export async function POST(req: NextRequest) {
  let id: string | undefined;

  try {
    const body = await req.json();
    id = body.id;

    if (!id) {
      return NextResponse.json({ error: "ID de solicitud requerido" }, { status: 400 });
    }

    // 1. Obtener datos de la solicitud
    const { data: sol, error: fetchErr } = await supabase
      .from("solicitudes")
      .select("email, nombres, apellidos, dni, tipo_tramite, monto_pagado")
      .eq("id", id)
      .single();

    if (fetchErr || !sol) {
      console.error("[aprobar] fetch error:", fetchErr);
      return NextResponse.json({ error: "Solicitud no encontrada" }, { status: 404 });
    }

    // 2. Intentar generar boleta en Nubefact
    let pdfUrl = "";
    const nubefactConfigurado =
      process.env.NUBEFACT_ENDPOINT &&
      !process.env.NUBEFACT_ENDPOINT.includes("TU_RUC") &&
      process.env.NUBEFACT_TOKEN &&
      !process.env.NUBEFACT_TOKEN.includes("TU_TOKEN");

    if (nubefactConfigurado) {
      try {
        const boleta = await generarBoleta({
          dniCliente:    sol.dni,
          nombreCliente: `${sol.nombres} ${sol.apellidos}`,
          monto:         Number(sol.monto_pagado),
          descripcion:   sol.tipo_tramite,
        });
        pdfUrl = boleta.pdfUrl;
        console.log("[aprobar] Boleta generada:", pdfUrl);
      } catch (nubefactErr) {
        const msg = nubefactErr instanceof Error ? nubefactErr.message : "Error Nubefact";
        console.error("[aprobar] Nubefact error:", msg);
        return NextResponse.json({ error: `Error al generar boleta: ${msg}` }, { status: 502 });
      }
    } else {
      console.warn("[aprobar] Nubefact no configurado — aprobando sin boleta");
    }

    // 3. Actualizar estado en Supabase
    const updateData: Record<string, unknown> = { estado: "aprobado" };
    if (pdfUrl) updateData.pdf_boleta_url = pdfUrl;

    const { error: updateErr } = await supabase
      .from("solicitudes")
      .update(updateData)
      .eq("id", id);

    if (updateErr) {
      console.error("[aprobar] update error:", updateErr);
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    // 4. Enviar correo de aprobación (no bloqueante)
    try {
      await enviarCorreoAprobacion({
        email:       sol.email,
        nombres:     sol.nombres,
        apellidos:   sol.apellidos,
        tipoTramite: sol.tipo_tramite,
        pdfUrl:      pdfUrl || "#",
      });
    } catch (emailErr) {
      console.error("[aprobar] email error:", emailErr);
      // No falla — la aprobación ya se guardó
    }

    return NextResponse.json({ success: true, pdfUrl });

  } catch (err) {
    console.error("[aprobar] unexpected error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error interno del servidor" },
      { status: 500 }
    );
  }
}
