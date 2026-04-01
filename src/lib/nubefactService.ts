// ─── Nubefact — Boletas y Facturas Electrónicas ───────────────────────────────

const ENDPOINT = process.env.NUBEFACT_ENDPOINT!;
const TOKEN    = process.env.NUBEFACT_TOKEN!;

export interface BoletaInput {
  codigoProducto:  number;
  descripcion:     string;
  cantidad:        number;
  precioUnitario:  number;   // precio con IGV (o total si inafecto)
  valorUnitario?:  number;   // precio sin IGV — solo para gravados (tipo_de_igv=10)
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
  const precioUnit = r2(datos.precioUnitario);
  const valorUnit  = esGravado
    ? r2(datos.valorUnitario ?? precioUnit / 1.18)
    : precioUnit;

  // ── Totales ────────────────────────────────────────────────────────────────
  // subtotal = valor_unitario × cantidad  (base imponible)
  // totalItem = precio_unitario × cantidad (con IGV)
  // igv = totalItem - subtotal
  const subtotal   = r2(valorUnit  * cantidad);
  const totalItem  = r2(precioUnit * cantidad);
  const igvItem    = esGravado ? r2(totalItem - subtotal) : 0;

  const totalGravada  = esGravado ? subtotal  : 0;
  const totalInafecta = esGravado ? 0         : totalItem;
  const totalIgv      = igvItem;
  const total         = r2(totalGravada + totalInafecta + totalIgv);

  // ── Comprobante ────────────────────────────────────────────────────────────
  // Nubefact: 1=Boleta, 2=Factura
  const tipoComprobante  = esBoleta ? 1 : 2;
  const serie            = esBoleta ? "BBB2" : "FFF2";
  const clienteTipoDoc   = esBoleta ? 1 : 6;   // 1=DNI, 6=RUC
  const clienteNumDoc    = esBoleta ? datos.dniCliente : (datos.ruc ?? "");
  const clienteNombre    = esBoleta ? datos.nombreCliente : (datos.razonSocial ?? datos.nombreCliente);

  // ── Payload mínimo obligatorio ─────────────────────────────────────────────
  const payload: Record<string, unknown> = {
    operacion:                         "generar_comprobante",
    tipo_de_comprobante:               tipoComprobante,
    serie,
    numero:                            "",
    sunat_transaction:                 1,
    cliente_tipo_de_documento:         clienteTipoDoc,
    cliente_numero_de_documento:       clienteNumDoc,
    cliente_denominacion:              clienteNombre,
    moneda:                            1,
    fecha_de_emision:                  new Date().toISOString().split("T")[0],
    total_gravada:                     totalGravada,
    total_inafecta:                    totalInafecta,
    total_exonerada:                   0,
    total_igv:                         totalIgv,
    total,
    items: [
      {
        unidad_de_medida: "ZZ",
        codigo:           String(datos.codigoProducto),
        descripcion:      datos.descripcion,
        cantidad,
        valor_unitario:   valorUnit,
        precio_unitario:  precioUnit,
        subtotal,
        tipo_de_igv:      tipoIgv,
        igv:              igvItem,
        total:            totalItem,
      },
    ],
  };

  // Campos opcionales solo si tienen valor
  if (!esBoleta && datos.direccionFiscal) {
    payload.cliente_direccion = datos.direccionFiscal;
  }

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
