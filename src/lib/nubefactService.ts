// ─── Nubefact — Boletas y Facturas Electrónicas ───────────────────────────────
// Todos los trámites son INAFECTOS de IGV (tipo_de_igv = 9)

const ENDPOINT = process.env.NUBEFACT_ENDPOINT!;
const TOKEN    = process.env.NUBEFACT_TOKEN!;

export interface BoletaInput {
  // Producto
  codigoProducto:  number;
  descripcion:     string;
  cantidad:        number;
  precioUnitario:  number;   // precio con IGV (o total si inafecto)
  valorUnitario?:  number;   // precio sin IGV — omitir si inafecto (se asume = precioUnitario)
  tipoIgv?:        number;   // 9=Inafecto (default), 10=Gravado
  codigoUnico:     string;
  // Comprobante
  tipoComprobante: "boleta" | "factura";
  dniCliente:      string;
  nombreCliente:   string;
  ruc?:            string;
  razonSocial?:    string;
  direccionFiscal?: string;
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

  const esBoleta    = datos.tipoComprobante === "boleta";
  const tipoIgv     = datos.tipoIgv ?? 9;
  const esGravado   = tipoIgv === 10;
  const cantidad    = datos.cantidad;

  // Para gravados: usar los valores exactos del catálogo sin recalcular
  // Para inafectos: valor = precio (sin IGV)
  const precioUnit  = Math.round(datos.precioUnitario * 100) / 100;
  const valorUnit   = esGravado
    ? Math.round((datos.valorUnitario ?? precioUnit / 1.18) * 100) / 100
    : precioUnit;

  // Calcular totales con los valores exactos
  const subtotal    = Math.round(valorUnit  * cantidad * 100) / 100;
  const total       = Math.round(precioUnit * cantidad * 100) / 100;
  // IGV = total - subtotal (evita errores de redondeo acumulado)
  const igv         = esGravado ? Math.round((total - subtotal) * 100) / 100 : 0;

  console.log("[nubefact] Cálculos:", {
    tipoIgv, esGravado, cantidad,
    precioUnit, valorUnit, subtotal, igv, total,
    total_gravada: esGravado ? subtotal : 0,
    total_inafecta: esGravado ? 0 : total,
    total_igv: igv,
  });

  // ── Configuración según tipo de comprobante ──────────────────────────────
  const tipoComprobante = esBoleta ? 2 : 1;
  const serie           = esBoleta ? "BBB2" : "FFF2";

  const clienteTipoDoc   = esBoleta ? 1 : 6;
  const clienteNumDoc    = esBoleta ? datos.dniCliente : (datos.ruc ?? "");
  const clienteNombre    = esBoleta ? datos.nombreCliente : (datos.razonSocial ?? datos.nombreCliente);
  const clienteDireccion = esBoleta ? "" : (datos.direccionFiscal ?? "");

  const payload = {
    operacion:              "generar_comprobante",
    tipo_de_comprobante:    tipoComprobante,
    serie,
    sunat_transaction:      1,
    cliente_tipo_de_documento:       clienteTipoDoc,
    cliente_numero_de_documento:     clienteNumDoc,
    cliente_denominacion:            clienteNombre,
    cliente_direccion:               clienteDireccion,
    cliente_email:                   "",
    cliente_email_1:                 "",
    cliente_email_2:                 "",
    fecha_de_emision:       new Date().toLocaleDateString("es-PE", {
      day: "2-digit", month: "2-digit", year: "numeric",
    }),
    fecha_de_vencimiento:   "",
    moneda:                 1,
    tipo_de_cambio:         "",
    porcentaje_de_igv:      esGravado ? 18.00 : 0.00,
    descuento_global:       0,
    total_descuento:        0,
    total_anticipo:         0,
    total_gravada:          esGravado ? subtotal : 0,
    total_inafecta:         esGravado ? 0 : total,
    total_exonerada:        0,
    total_igv:              igv,
    total_gratuita:         0,
    total_otros_cargos:     0,
    total,
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
    codigo_unico:           datos.codigoUnico,
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
        valor_unitario:     valorUnit,
        precio_unitario:    precioUnit,
        descuento:          "",
        subtotal,
        tipo_de_igv:        tipoIgv,
        igv,
        total,
        anticipo_regularizacion:   false,
        anticipo_documento_serie:  "",
        anticipo_documento_numero: "",
      },
    ],
  };

  console.log("[nubefact] Tipo:", esBoleta ? "BOLETA" : "FACTURA", "| Serie:", serie);
  console.log("[nubefact] Cliente:", clienteNombre, "| Doc:", clienteNumDoc);
  console.log("[nubefact] Payload items[0]:", JSON.stringify(payload.items[0]));
  console.log("[nubefact] Totales payload:", { total_gravada: payload.total_gravada, total_inafecta: payload.total_inafecta, total_igv: payload.total_igv, total: payload.total });

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
    serie:    json.serie          ?? serie,
    numero:   json.numero         ?? 0,
    enlaceQr: json.enlace_del_qr  ?? "",
  };
}
