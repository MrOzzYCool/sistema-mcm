// ─── Nubefact — Boletas y Facturas Electrónicas ───────────────────────────────
// Todas las operaciones son INAFECTAS - Operación Onerosa (tipo_de_igv = 9)
// BOLETA  → tipo_de_comprobante=2, serie=BBB2, cliente_tipo_doc=1 (DNI)
// FACTURA → tipo_de_comprobante=1, serie=FFF2, cliente_tipo_doc=6 (RUC)

const ENDPOINT = process.env.NUBEFACT_ENDPOINT!;
const TOKEN    = process.env.NUBEFACT_TOKEN!;

export interface BoletaInput {
  codigoProducto:  number;
  descripcion:     string;
  cantidad:        number;
  precioUnitario:  number;  // monto total que paga el alumno
  codigoUnico:     string;  // ID de la solicitud en Supabase
  tipoComprobante: "boleta" | "factura";
  dniCliente:      string;
  nombreCliente:   string;
  ruc?:            string;
  razonSocial?:    string;
  direccionFiscal?: string;
  // Ignorados — mantenidos por compatibilidad pero no se usan
  valorUnitario?:  number;
  tipoIgv?:        number;
}

export interface BoletaResult {
  pdfUrl:   string;
  serie:    string;
  numero:   number;
  enlaceQr: string;
}

function r2(n: number): number {
  return Math.round(n * 100) / 100;
}

export async function generarBoleta(datos: BoletaInput): Promise<BoletaResult> {
  if (!ENDPOINT || !TOKEN) {
    throw new Error("Nubefact no configurado. Verifica NUBEFACT_ENDPOINT y NUBEFACT_TOKEN.");
  }

  const esBoleta = datos.tipoComprobante === "boleta";

  // ── Tipo y serie ───────────────────────────────────────────────────────────
  // BOLETA  → tipo_de_comprobante=1, serie=BBB2, cliente_tipo_doc=1 (DNI)
  // FACTURA → tipo_de_comprobante=2, serie=FFF2, cliente_tipo_doc=6 (RUC)
  const tipoComprobante = esBoleta ? 1 : 2;
  const serie           = esBoleta ? "BBB2" : "FFF2";

  // ── Cliente ────────────────────────────────────────────────────────────────
  const clienteTipoDoc   = esBoleta ? 1 : 6;
  const clienteNumDoc    = esBoleta ? datos.dniCliente : (datos.ruc ?? "");
  const clienteNombre    = esBoleta ? datos.nombreCliente : (datos.razonSocial ?? datos.nombreCliente);
  const clienteDireccion = (!esBoleta && datos.direccionFiscal) ? datos.direccionFiscal : "";

  // ── Debug y validación de consistencia ────────────────────────────────────
  console.log("DEBUG NUBEFACT:", { tipo_de_comprobante: tipoComprobante, serie, cliente_tipo_de_documento: clienteTipoDoc, tipoComprobante: datos.tipoComprobante });

  if (tipoComprobante === 1 && !serie.startsWith("B")) {
    throw new Error(`Serie inválida para boleta: ${serie}`);
  }
  if (tipoComprobante === 2 && !serie.startsWith("F")) {
    throw new Error(`Serie inválida para factura: ${serie}`);
  }

  // ── Montos — INAFECTO, sin IGV ─────────────────────────────────────────────
  const cantidad    = datos.cantidad;
  const precioUnit  = r2(datos.precioUnitario);
  const totalItem   = r2(precioUnit * cantidad);
  const monto       = totalItem;  // total_inafecta = total

  // codigo_unico único por intento
  const codigoUnico = Date.now().toString();

  // ── Payload ────────────────────────────────────────────────────────────────
  const payload = {
    operacion:                         "generar_comprobante",
    tipo_de_comprobante:               tipoComprobante,
    serie,
    numero:                            "",
    sunat_transaction:                 1,
    cliente_tipo_de_documento:         clienteTipoDoc,
    cliente_numero_de_documento:       clienteNumDoc,
    cliente_denominacion:              clienteNombre,
    cliente_direccion:                 clienteDireccion,
    moneda:                            1,
    fecha_de_emision:                  new Date().toISOString().split("T")[0],
    porcentaje_de_igv:                 0,
    total_gravada:                     0,
    total_exonerada:                   0,
    total_inafecta:                    monto,
    total_gratuita:                    0,
    total_igv:                         0,
    total:                             monto,
    codigo_unico:                      codigoUnico,
    items: [
      {
        unidad_de_medida: "ZZ",
        codigo:           String(datos.codigoProducto),
        descripcion:      datos.descripcion,
        cantidad,
        valor_unitario:   precioUnit,
        precio_unitario:  precioUnit,
        descuento:        0,
        subtotal:         totalItem,
        tipo_de_igv:      9,
        igv:              0,
        total:            totalItem,
      },
    ],
  };

  console.log("[nubefact] Payload:", JSON.stringify(payload, null, 2));

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
