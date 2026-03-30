// ─── Nubefact — Emisión de Boletas Electrónicas ───────────────────────────────
// Documentación: https://www.nubefact.com/api-boleta-factura/
// Los trámites del Instituto están INAFECTOS de IGV (tipo_de_igv = 9)

const ENDPOINT = process.env.NUBEFACT_ENDPOINT!;
const TOKEN    = process.env.NUBEFACT_TOKEN!;

export interface BoletaInput {
  dniCliente:    string;
  nombreCliente: string;
  monto:         number;   // monto total inafecto (sin IGV)
  descripcion:   string;
}

export interface BoletaResult {
  pdfUrl:   string;
  serie:    string;
  numero:   number;
  enlaceQr: string;
}

export async function generarBoleta(datos: BoletaInput): Promise<BoletaResult> {
  if (!ENDPOINT || !TOKEN) {
    throw new Error("Nubefact no está configurado. Verifica NUBEFACT_ENDPOINT y NUBEFACT_TOKEN.");
  }

  const monto = Math.round(datos.monto * 100) / 100;

  // Número único basado en timestamp para evitar duplicados
  const numeroUnico = Date.now().toString().slice(-6); // últimos 6 dígitos del timestamp

  const payload = {
    operacion:              "generar_comprobante",
    tipo_de_comprobante:    2,
    serie:                  "BBB2",
    numero:                 numeroUnico,
    sunat_transaction:      1,
    cliente_tipo_de_documento: 1,       // 1 = DNI
    cliente_numero_de_documento: datos.dniCliente,
    cliente_denominacion:   datos.nombreCliente,
    cliente_direccion:      "",
    cliente_email:          "",
    cliente_email_1:        "",
    cliente_email_2:        "",
    fecha_de_emision:       new Date().toLocaleDateString("es-PE", {
      day: "2-digit", month: "2-digit", year: "numeric",
    }),
    fecha_de_vencimiento:   "",
    moneda:                 1,          // 1 = Soles (PEN)
    tipo_de_cambio:         "",
    porcentaje_de_igv:      0.00,       // Inafecto: sin IGV
    descuento_global:       0,
    total_descuento:        0,
    total_anticipo:         0,
    total_gravada:          0,          // No hay base gravada
    total_inafecta:         monto,      // Todo el monto es inafecto
    total_exonerada:        0,
    total_igv:              0,          // IGV = 0
    total_gratuita:         0,
    total_otros_cargos:     0,
    total:                  monto,      // Total = monto inafecto
    percepcion_tipo:        "",
    percepcion_base_imponible: 0,
    total_percepcion:       0,
    total_incluido_percepcion: 0,
    detraccion:             false,
    observaciones:          "",
    documento_que_se_modifica_tipo:   "",
    documento_que_se_modifica_serie:  "",
    documento_que_se_modifica_numero: "",
    tipo_de_nota_de_credito: "",
    tipo_de_nota_de_debito:  "",
    enviar_automaticamente_a_la_sunat: true,
    enviar_automaticamente_al_cliente: false,
    codigo_unico:           "",
    condiciones_de_pago:    "",
    medio_de_pago:          "Transferencia",
    placa_vehiculo:         "",
    orden_compra_servicio:  "",
    tabla_personalizada_codigo: "",
    formato_de_pdf:         "",
    items: [
      {
        unidad_de_medida:   "ZZ",
        codigo:             "TRAM001",
        descripcion:        datos.descripcion,
        cantidad:           1,
        valor_unitario:     monto,      // Inafecto: valor_unitario = precio_unitario
        precio_unitario:    monto,
        descuento:          "",
        subtotal:           monto,
        tipo_de_igv:        9,          // 9 = Inafecto - Operación Onerosa
        igv:                0,          // IGV = 0
        total:              monto,
        anticipo_regularizacion: false,
        anticipo_documento_serie:  "",
        anticipo_documento_numero: "",
      },
    ],
  };

  // ── Logs de diagnóstico ──────────────────────────────────────────────────
  const endpointSafe = ENDPOINT.replace(/\/[^/]+$/, "/***"); // oculta el RUC del endpoint
  console.log("[nubefact] Endpoint:", ENDPOINT);             // URL completa para diagnóstico
  console.log("[nubefact] Endpoint (safe):", endpointSafe);
  console.log("[nubefact] Serie:", "BBB2", "| Número:", numeroUnico);
  console.log("[nubefact] Payload completo:", JSON.stringify({
    ...payload,
    // El token va en el header, no en el payload — no hay nada que ocultar aquí
  }, null, 2));

  const res = await fetch(ENDPOINT, {
    method:  "POST",
    headers: {
      "Content-Type":  "application/json",
      "Authorization": `Token token="${TOKEN}"`,
    },
    body:  JSON.stringify(payload),
    cache: "no-store",
  });

  const json = await res.json();
  console.log("[nubefact] Respuesta:", JSON.stringify(json));

  if (!res.ok || json.errors) {
    const msg = json.errors
      ? Object.values(json.errors).flat().join(", ")
      : `Error Nubefact HTTP ${res.status}: ${JSON.stringify(json)}`;
    throw new Error(msg);
  }

  return {
    pdfUrl:   json.enlace_del_pdf ?? json.pdf_url ?? "",
    serie:    json.serie          ?? "BBB2",
    numero:   json.numero         ?? 0,
    enlaceQr: json.enlace_del_qr  ?? "",
  };
}
