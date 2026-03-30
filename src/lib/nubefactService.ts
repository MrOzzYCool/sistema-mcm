// ─── Nubefact — Emisión de Boletas Electrónicas ───────────────────────────────
// Documentación: https://www.nubefact.com/api-boleta-factura/

const ENDPOINT = process.env.NUBEFACT_ENDPOINT!;
const TOKEN    = process.env.NUBEFACT_TOKEN!;

export interface BoletaInput {
  dniCliente:    string;
  nombreCliente: string;
  monto:         number;
  descripcion:   string;  // descripción del trámite
}

export interface BoletaResult {
  pdfUrl:       string;
  serie:        string;
  numero:       number;
  enlaceQr:     string;
}

export async function generarBoleta(datos: BoletaInput): Promise<BoletaResult> {
  if (!ENDPOINT || !TOKEN) {
    throw new Error("Nubefact no está configurado. Verifica NUBEFACT_ENDPOINT y NUBEFACT_TOKEN.");
  }

  const igv       = Math.round(datos.monto * 0.18 * 100) / 100;
  const subtotal  = Math.round((datos.monto - igv) * 100) / 100;

  const payload = {
    operacion:              "generar_comprobante",
    tipo_de_comprobante:    2,          // 2 = Boleta de Venta
    serie:                  "B001",
    numero:                 "1",        // Nubefact lo autoincrementa
    sunat_transaction:      1,
    cliente_tipo_de_documento: 1,       // 1 = DNI
    cliente_numero_de_documento: datos.dniCliente,
    cliente_denominacion:   datos.nombreCliente,
    cliente_direccion:      "",
    cliente_email:          "",
    cliente_email_1:        "",
    cliente_email_2:        "",
    fecha_de_emision:       new Date().toLocaleDateString("es-PE", { day: "2-digit", month: "2-digit", year: "numeric" }),
    fecha_de_vencimiento:   "",
    moneda:                 1,          // 1 = Soles
    tipo_de_cambio:         "",
    porcentaje_de_igv:      18.0,
    descuento_global:       0,
    total_descuento:        0,
    total_anticipo:         0,
    total_gravada:          subtotal,
    total_inafecta:         0,
    total_exonerada:        0,
    total_igv:              igv,
    total_gratuita:         0,
    total_otros_cargos:     0,
    total:                  datos.monto,
    percepcion_tipo:        "",
    percepcion_base_imponible: 0,
    total_percepcion:       0,
    total_incluido_percepcion: 0,
    detraccion:             false,
    observaciones:          "",
    documento_que_se_modifica_tipo: "",
    documento_que_se_modifica_serie: "",
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
        valor_unitario:     subtotal,
        precio_unitario:    datos.monto,
        descuento:          "",
        subtotal:           subtotal,
        tipo_de_igv:        1,
        igv:                igv,
        total:              datos.monto,
        anticipo_regularizacion: false,
        anticipo_documento_serie: "",
        anticipo_documento_numero: "",
      },
    ],
  };

  const res = await fetch(ENDPOINT, {
    method:  "POST",
    headers: {
      "Content-Type":  "application/json",
      "Authorization": `Token token="${TOKEN}"`,
    },
    body: JSON.stringify(payload),
    cache: "no-store",
  });

  const json = await res.json();

  if (!res.ok || json.errors) {
    const msg = json.errors
      ? Object.values(json.errors).flat().join(", ")
      : `Error Nubefact: ${res.status}`;
    throw new Error(msg);
  }

  return {
    pdfUrl:   json.enlace_del_pdf ?? json.pdf_url ?? "",
    serie:    json.serie          ?? "B001",
    numero:   json.numero         ?? 0,
    enlaceQr: json.enlace_del_qr  ?? "",
  };
}
