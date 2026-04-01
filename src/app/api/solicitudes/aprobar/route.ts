import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { generarBoleta } from "@/lib/nubefactService";
import { enviarCorreoAprobacion } from "@/lib/emailService";
import { NUBEFACT_MAP, TRAMITES_EXTERNOS_CATALOGO, ACTUALIZACIONES_CATALOGO } from "@/lib/mock-data";

export async function POST(req: NextRequest) {
  try {
    const { id } = await req.json();
    console.log("Iniciando aprobación para id:", id);

    if (!id) return NextResponse.json({ error: "ID requerido" }, { status: 400 });

    // ── 1. Obtener datos de la solicitud ──────────────────────────────────────
    const { data: sol, error: fetchErr } = await supabase
      .from("solicitudes")
      .select("email, nombres, apellidos, dni, tipo_tramite, monto_pagado, costo_tramite, cantidad_silabos, tipo_comprobante, ruc, razon_social, direccion_fiscal")
      .eq("id", id)
      .single();

    if (fetchErr || !sol) {
      console.error("Error obteniendo solicitud:", fetchErr);
      return NextResponse.json({ error: "Solicitud no encontrada" }, { status: 404 });
    }

    console.log("Solicitud:", sol.nombres, sol.apellidos, "| monto:", sol.monto_pagado);

    // ── 2. Resolver código Nubefact por tipo de trámite ───────────────────────
    const tramite = TRAMITES_EXTERNOS_CATALOGO.find((t) => t.nombre === sol.tipo_tramite);
    // Verificar también en catálogo de actualizaciones
    const actualizacion = !tramite
      ? ACTUALIZACIONES_CATALOGO.find((a) => a.label === sol.tipo_tramite)
      : null;

    let nubefactItem: { codigo: number; descripcion: string; monto: number } | null = null;

    if (tramite) {
      nubefactItem = NUBEFACT_MAP[tramite.id] ?? null;
    } else if (actualizacion) {
      nubefactItem = {
        codigo:      actualizacion.codigoNubefact,
        descripcion: actualizacion.descripcionNubefact,
        monto:       actualizacion.precioUnitario,
      };
    }

    if (!nubefactItem) {
      console.error("Trámite no encontrado en mapa Nubefact:", sol.tipo_tramite);
      return NextResponse.json({ error: `Trámite no mapeado: ${sol.tipo_tramite}` }, { status: 400 });
    }

    const esSilabo    = tramite?.id === "te11";
    const cantidad    = esSilabo ? 70 : 1;
    const precioUnit  = esSilabo ? 5 : nubefactItem!.monto;
    const montoTotal  = Math.round(precioUnit * cantidad * 100) / 100;

    console.log("Código Nubefact:", nubefactItem.codigo, "| Desc:", nubefactItem.descripcion);
    console.log("Cantidad:", cantidad, "| Precio unit:", precioUnit, "| Total:", montoTotal);

    // ── 3. Generar boleta en Nubefact ─────────────────────────────────────────
    let pdfUrl = "";

    if (montoTotal > 0) {
      try {
        const boleta = await generarBoleta({
          codigoProducto:  nubefactItem.codigo,
          descripcion:     nubefactItem.descripcion,
          dniCliente:      sol.dni,
          nombreCliente:   `${sol.nombres} ${sol.apellidos}`,
          cantidad,
          precioUnitario:  precioUnit,
          // Actualizaciones llevan IGV — pasar valorUnitario y tipoIgv específicos
          ...(actualizacion && {
            valorUnitario: actualizacion.valorUnitario,
            tipoIgv:       actualizacion.tipoIgv,
          }),
          codigoUnico:     id,
          tipoComprobante: (sol.tipo_comprobante as "boleta" | "factura") ?? "boleta",
          ruc:             sol.ruc ?? undefined,
          razonSocial:     sol.razon_social ?? undefined,
          direccionFiscal: sol.direccion_fiscal ?? undefined,
        });
        pdfUrl = boleta.pdfUrl;
        console.log("Boleta generada:", pdfUrl);
      } catch (nubefactErr) {
        const msg = nubefactErr instanceof Error ? nubefactErr.message : String(nubefactErr);
        console.error("Error Nubefact:", msg);
        return NextResponse.json({ error: `No se pudo generar la boleta: ${msg}` }, { status: 502 });
      }
    }

    // ── 4. Actualizar estado en Supabase ──────────────────────────────────────
    const { error: updateErr } = await supabase
      .from("solicitudes")
      .update({ estado: "aprobado", pdf_boleta_url: pdfUrl || null })
      .eq("id", id);

    if (updateErr) {
      console.error("Error actualizando Supabase:", updateErr);
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    console.log("Estado actualizado a aprobado");

    // ── 5. Enviar correo de aprobación ────────────────────────────────────────
    try {
      await enviarCorreoAprobacion({
        email:       sol.email,
        nombres:     sol.nombres,
        apellidos:   sol.apellidos,
        tipoTramite: sol.tipo_tramite,
        pdfUrl:      pdfUrl || "",
      });
      console.log("Correo enviado a:", sol.email);
    } catch (emailErr) {
      console.error("Error enviando correo (no crítico):", emailErr);
    }

    return NextResponse.json({ success: true, pdfUrl });

  } catch (err) {
    console.error("Error inesperado:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error interno" },
      { status: 500 }
    );
  }
}
