// ─── Nubefact — Emisión de Boletas Electrónicas ───────────────────────────────
// Todos los trámites son INAFECTOS de IGV (tipo_de_igv = 9)

const ENDPOINT = process.env.NUBEFACT_ENDPOINT!;
const TOKEN    = process.env.NUBEFACT_TOKEN!;

export interface BoletaInput {
  codigoProducto: number;   // código oficial del catálogo Nubefact
  descripcion:    string;   // descripción oficial del catálogo
  dniCliente:     string;
  nombreCliente:  string;
  cantidad:       number;   // 1 para trámites normales, N para sílabos
  precioUnitario: number;   // precio por unidad (5 para sílabos, monto total para el resto)
  codigoUnico:    string;   // ID de la solicitud en Supabase
}

export interface BoletaResult {
  pdfUrl:   string;
  serie:    string;
  numero:   number;
  enlaceQr: string;
}

export async function generarBoleta(datos: BoletaInput): Promise<BoletaResult> {
  if (!ENDPOINT || !TOKEN) {
    throw new Error("Nubefact no configurado. Verifica NUBEFACT_ENDPOINT y NUBEFACT_TOKEN.");
  }

  const precioUnit = Math.round(datos.precioUnitario * 100) / 100;
  const cantidad   = datos.cantidad;
  const total      = Math.round(precioUnit * cantidad * 100) / 100;

  const payload = {
    operacion:              "generar_comprobante",
    tipo_de_comprobante:    2,        // 2 = Boleta de Venta
    serie:                  "BBB2",
    // numero omitido — Nubefact asigna el correlativo automáticamente
    sunat_transaction:      1,
    cliente_tipo_de_documento:       1,   // 1 = DNI
    cliente_numero_de_documento:     datos.dniCliente,
    cliente_denominacion:            datos.nombreCliente,
    cliente_direccion:               "",
    cliente_email:                   "",
    cliente_email_1:                 "",
    cliente_email_2:                 "",
    fecha_de_emision:       new Date().toLocaleDateString("es-PE", {
      day: "2-digit", month: "2-digit", year: "numeric",
    }),
    fecha_de_vencimiento:   "",
    moneda:                 1,        // 1 = PEN (Soles)
    tipo_de_cambio:         "",
    porcentaje_de_igv:      0.00,     // Inafecto
    descuento_global:       0,
    total_descuento:        0,
    total_anticipo:         0,
    total_gravada:          0,
    total_inafecta:         total,    // todo el monto es inafecto
    total_exonerada:        0,
    total_igv:              0,
    total_gratuita:         0,
    total_otros_cargos:     0,
    total:                  total,
    percepcion_tipo:        "",
    percepcion_base_imponible:       0,
    total_percepcion:       0,
    total_incluido_percepcion:       0,
    detraccion:             false,
    observaciones:          "",
    documento_que_se_modifica_tipo:   "",
    documento_que_se_modifica_serie:  "",
    documento_que_se_modifica_numero: "",
    tipo_de_nota_de_credito: "",
    tipo_de_nota_de_debito:  "",
    enviar_automaticamente_a_la_sunat: true,
    enviar_automaticamente_al_cliente: false,
    codigo_unico:           datos.codigoUnico,   // ID de la solicitud
    condiciones_de_pago:    "",
    medio_de_pago:          "Transferencia",
    placa_vehiculo:         "",
    orden_compra_servicio:  "",
    tabla_personalizada_codigo: "",
    formato_de_pdf:         "",
    items: [
      {
        unidad_de_medida:   "ZZ",
        codigo:             String(datos.codigoProducto),
        descripcion:        datos.descripcion,
        cantidad,
        valor_unitario:     precioUnit,   // inafecto: valor = precio
        precio_unitario:    precioUnit,
        descuento:          "",
        subtotal:           total,
        tipo_de_igv:        9,            // 9 = Inafecto - Operación Onerosa
        igv:                0,
        total,
        anticipo_regularizacion:  false,
        anticipo_documento_serie:  "",
        anticipo_documento_numero: "",
      },
    ],
  };

  console.log("[nubefact] Endpoint:", ENDPOINT);
  console.log("[nubefact] Serie: BBB2 | Correlativo: automático");
  console.log("[nubefact] Código producto:", datos.codigoProducto, "| Desc:", datos.descripcion);
  console.log("[nubefact] Cantidad:", cantidad, "| Precio unit:", precioUnit, "| Total:", total);
  console.log("[nubefact] codigo_unico:", datos.codigoUnico);

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
