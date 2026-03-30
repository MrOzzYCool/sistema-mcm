import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { generarBoleta } from "@/lib/nubefactService";
import { enviarCorreoAprobacion } from "@/lib/emailService";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { id } = body;

    console.log("Iniciando aprobación para id:", id);

    if (!id) {
      return NextResponse.json({ error: "ID requerido" }, { status: 400 });
    }

    // ── 1. Obtener datos completos de la solicitud ──────────────────────────
    const { data: sol, error: fetchErr } = await supabase
      .from("solicitudes")
      .select("email, nombres, apellidos, dni, tipo_tramite, monto_pagado, costo_tramite")
      .eq("id", id)
      .single();

    if (fetchErr || !sol) {
      console.error("Error obteniendo solicitud:", fetchErr);
      return NextResponse.json({ error: "Solicitud no encontrada" }, { status: 404 });
    }

    console.log("Solicitud encontrada:", sol.nombres, sol.apellidos, "monto:", sol.monto_pagado);

    // ── 2. Generar boleta en Nubefact ───────────────────────────────────────
    // Usar costo_tramite si monto_pagado es 0 (trámites sin pago previo)
    const montoFinal = Number(sol.monto_pagado) > 0
      ? Number(sol.monto_pagado)
      : Number(sol.costo_tramite);

    let pdfUrl = "";

    if (montoFinal > 0) {
      console.log("Llamando a Nubefact con monto:", montoFinal);

      let response;
      try {
        response = await generarBoleta({
          dniCliente:    sol.dni,
          nombreCliente: `${sol.nombres} ${sol.apellidos}`,
          monto:         montoFinal,
          descripcion:   sol.tipo_tramite,
        });
        console.log("Respuesta Nubefact:", response);
        pdfUrl = response.pdfUrl;
      } catch (nubefactErr) {
        const msg = nubefactErr instanceof Error ? nubefactErr.message : String(nubefactErr);
        console.error("Error Nubefact:", msg);
        // NO aprobar si Nubefact falla
        return NextResponse.json(
          { error: `No se pudo generar la boleta: ${msg}` },
          { status: 502 }
        );
      }
    } else {
      console.log("Trámite sin costo — omitiendo Nubefact");
    }

    // ── 3. Guardar pdf_boleta_url y cambiar estado a 'aprobado' ────────────
    console.log("Guardando en Supabase — estado: aprobado, pdfUrl:", pdfUrl);

    const { error: updateErr } = await supabase
      .from("solicitudes")
      .update({
        estado:        "aprobado",
        pdf_boleta_url: pdfUrl || null,
      })
      .eq("id", id);

    if (updateErr) {
      console.error("Error actualizando Supabase:", updateErr);
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    console.log("Estado actualizado a aprobado correctamente");

    // ── 4. Enviar correo de aprobación ──────────────────────────────────────
    try {
      await enviarCorreoAprobacion({
        email:       sol.email,
        nombres:     sol.nombres,
        apellidos:   sol.apellidos,
        tipoTramite: sol.tipo_tramite,
        pdfUrl:      pdfUrl || "",
      });
      console.log("Correo de aprobación enviado a:", sol.email);
    } catch (emailErr) {
      // El correo falla silenciosamente — la aprobación ya está guardada
      console.error("Error enviando correo (no crítico):", emailErr);
    }

    return NextResponse.json({ success: true, pdfUrl });

  } catch (err) {
    console.error("Error inesperado en /api/solicitudes/aprobar:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error interno" },
      { status: 500 }
    );
  }
}
