// ─── Nubefact — Boletas y Facturas Electrónicas ───────────────────────────────

const ENDPOINT = process.env.NUBEFACT_ENDPOINT!;
const TOKEN    = process.env.NUBEFACT_TOKEN!;

export interface BoletaInput {
  codigoProducto:  number;
  descripcion:     string;
  cantidad:        number;
  precioUnitario:  number;   // precio con IGV (o total si inafecto)
  valorUnitario?:  number;   // precio sin IGV — solo para gravados
  tipoIgv?:        number;   // 9=Inafecto (default), 10=Gravado
  codigoUnico:     string;
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

// ─── Helper: redondear a 2 decimales ─────────────────────────────────────────
function r2(n: number): number {
  return Math.round(n * 100) / 100;
}

export async function generarBoleta(datos: BoletaInput): Promise<BoletaResult> {
  if (!ENDPOINT || !TOKEN) {
    throw new Error("Nubefact no configurado. Verifica NUBEFACT_ENDPOINT y NUBEFACT_TOKEN.");
  }

  const esBoleta  = datos.tipoComprobante === "boleta";
  const tipoIgv   = datos.tipoIgv ?? 9;
  const esGravado = tipoIgv === 10;
  const cantidad  = datos.cantidad;

  // ── Valores unitarios ──────────────────────────────────────────────────────
  // precio_unitario = precio con IGV (lo que paga el cliente)
  // valor_unitario  = precio sin IGV (base imponible)
  const precioUnit = r2(datos.precioUnitario);
  const valorUnit  = esGravado
    ? r2(datos.valorUnitario ?? precioUnit / 1.18)
    : precioUnit;  // inafecto: valor = precio

  // ── Totales del ítem ───────────────────────────────────────────────────────
  // subtotal = valor_unitario × cantidad  (base imponible total)
  // total    = precio_unitario × cantidad (total con IGV)
  // igv      = total - subtotal
  const subtotal   = r2(valorUnit  * cantidad);
  const totalItem  = r2(precioUnit * cantidad);
  const igvItem    = esGravado ? r2(totalItem - subtotal) : 0;

  // ── Totales del comprobante ────────────────────────────────────────────────
  const totalGravada  = esGravado ? subtotal  : 0;
  const totalInafecta = esGravado ? 0         : totalItem;
  const totalIgv      = esGravado ? igvItem   : 0;
  const total         = r2(totalGravada + totalInafecta + totalIgv);

  // ── Cliente ────────────────────────────────────────────────────────────────
  const tipoComprobante  = esBoleta ? 2 : 1;
  const serie            = esBoleta ? "BBB2" : "FFF2";
  const clienteTipoDoc   = esBoleta ? 1 : 6;
  const clienteNumDoc    = esBoleta ? datos.dniCliente : (datos.ruc ?? "");
  const clienteNombre    = esBoleta ? datos.nombreCliente : (datos.razonSocial ?? datos.nombreCliente);
  const clienteDireccion = esBoleta ? "" : (datos.direccionFiscal ?? "");

  // ── Log de diagnóstico ─────────────────────────────────────────────────────
  console.log("[nubefact] Tipo:", esBoleta ? "BOLETA" : "FACTURA", "| Serie:", serie);
  console.log("[nubefact] tipoIgv:", tipoIgv, "| esGravado:", esGravado);
  console.log("[nubefact] valorUnit:", valorUnit, "| precioUnit:", precioUnit);
  console.log("[nubefact] subtotal:", subtotal, "| igvItem:", igvItem, "| totalItem:", totalItem);
  console.log("[nubefact] total_gravada:", totalGravada, "| total_inafecta:", totalInafecta, "| total_igv:", totalIgv, "| total:", total);

  // ── Payload ────────────────────────────────────────────────────────────────
  const payload = {
    operacion:                         "generar_comprobante",
    tipo_de_comprobante:               tipoComprobante,
    serie,
    // numero omitido — Nubefact asigna correlativo automáticamente
    sunat_transaction:                 1,
    cliente_tipo_de_documento:         clienteTipoDoc,
    cliente_numero_de_documento:       clienteNumDoc,
    cliente_denominacion:              clienteNombre,
    cliente_direccion:                 clienteDireccion,
    cliente_email:                     "",
    cliente_email_1:                   "",
    cliente_email_2:                   "",
    fecha_de_emision:                  new Date().toLocaleDateString("es-PE", {
      day: "2-digit", month: "2-digit", year: "numeric",
    }),
    fecha_de_vencimiento:              "",
    moneda:                            1,
    tipo_de_cambio:                    "",
    porcentaje_de_igv:                 esGravado ? 18.00 : 0.00,
    descuento_global:                  0,
    total_descuento:                   0,
    total_anticipo:                    0,
    total_gravada:                     totalGravada,
    total_inafecta:                    totalInafecta,
    total_exonerada:                   0,
    total_igv:                         totalIgv,
    total_gratuita:                    0,
    total_otros_cargos:                0,
    total,
    percepcion_tipo:                   "",
    percepcion_base_imponible:         0,
    total_percepcion:                  0,
    total_incluido_percepcion:         0,
    detraccion:                        false,
    observaciones:                     "",
    documento_que_se_modifica_tipo:    "",
    documento_que_se_modifica_serie:   "",
    documento_que_se_modifica_numero:  "",
    tipo_de_nota_de_credito:           "",
    tipo_de_nota_de_debito:            "",
    enviar_automaticamente_a_la_sunat: true,
    enviar_automaticamente_al_cliente: false,
    codigo_unico:                      datos.codigoUnico,
    condiciones_de_pago:               "",
    medio_de_pago:                     "Transferencia",
    placa_vehiculo:                    "",
    orden_compra_servicio:             "",
    tabla_personalizada_codigo:        "",
    formato_de_pdf:                    "",
    items: [
      {
        unidad_de_medida:          "ZZ",
        codigo:                    String(datos.codigoProducto),
        descripcion:               datos.descripcion,
        cantidad,
        valor_unitario:            valorUnit,
        precio_unitario:           precioUnit,
        descuento:                 "",
        subtotal,
        tipo_de_igv:               tipoIgv,
        igv:                       igvItem,
        total:                     totalItem,
        anticipo_regularizacion:   false,
        anticipo_documento_serie:  "",
        anticipo_documento_numero: "",
      },
    ],
  };

  console.log("[nubefact] Payload JSON:", JSON.stringify(payload, null, 2));

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
