// ─── Nubefact — Boletas y Facturas Electrónicas ───────────────────────────────
// Series activas:
//   Inafecto  (tipo_de_igv=9)  → Boleta: BBB2 | Factura: FFF2
//   Gravado   (tipo_de_igv=10) → Boleta: BBB3 | Factura: FFF3
// Tipo de comprobante por longitud de documento:
//   8 dígitos  (DNI) → tipo=1 (Boleta)
//   11 dígitos (RUC) → tipo=2 (Factura)

const ENDPOINT = process.env.NUBEFACT_ENDPOINT!;
const TOKEN    = process.env.NUBEFACT_TOKEN!;

// Construir URL genérica usando solo el token — ignora el endpoint específico
// Formato correcto: https://api.nubefact.com/api/v1/TOKEN
function buildUrl(): string {
  const base = "https://api.nubefact.com/api/v1";
  const token = TOKEN?.trim();
  if (!token) throw new Error("NUBEFACT_TOKEN no configurado");
  // Si ENDPOINT ya tiene el formato correcto (termina en el token), usarlo
  // Si no, construir la URL genérica
  if (ENDPOINT && ENDPOINT.endsWith(token)) return ENDPOINT;
  return `${base}/${token}`;
}

export interface BoletaInput {
  codigoProducto:  number;
  descripcion:     string;
  cantidad:        number;
  precioUnitario:  number;   // precio con IGV (o total si inafecto)
  valorUnitario?:  number;   // precio sin IGV — solo para tipo_de_igv=10
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

  const url = buildUrl();
  console.log("URL NUBEFACT USADA:", url.split("/").slice(0, -1).join("/") + "/***");

  // ── IGV ────────────────────────────────────────────────────────────────────
  // Forzar tipo 10 si el monto corresponde a una actualización con IGV
  const montoTotal = r2(datos.precioUnitario * datos.cantidad);
  const tipoIgvBase = datos.tipoIgv ?? 9;
  const tipoIgv   = (montoTotal === 400 || montoTotal === 350) ? 10 : tipoIgvBase;
  const esGravado = tipoIgv === 10;
  const cantidad  = datos.cantidad;

  const precioUnit = r2(datos.precioUnitario);
  const valorUnit  = esGravado
    ? r2(datos.valorUnitario ?? precioUnit / 1.18)
    : precioUnit;

  const subtotal  = r2(valorUnit  * cantidad);
  const totalItem = r2(precioUnit * cantidad);
  const igvItem   = esGravado ? r2(totalItem - subtotal) : 0;

  const totalGravada  = esGravado ? subtotal  : 0;
  const totalInafecta = esGravado ? 0         : totalItem;
  const totalIgv      = igvItem;
  const total         = r2(totalGravada + totalInafecta + totalIgv);

  // ── Tipo de comprobante — FORZADO BBB1 para prueba ────────────────────────
  // TODO: restaurar lógica dinámica cuando Nubefact confirme las series
  const tipoComprobante = 1;
  const clienteTipoDoc  = 1;
  const clienteNumDoc   = datos.dniCliente;
  const clienteNombre   = datos.nombreCliente;
  const clienteDireccion = "";

  const serie = "BBB1";

  // ── Fecha en zona horaria Perú (UTC-5) ─────────────────────────────────────
  const fechaPeru        = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Lima" }));
  const fecha_de_emision = fechaPeru.toISOString().split("T")[0];

  // ── Log diagnóstico ────────────────────────────────────────────────────────
  console.log("FINAL NUBEFACT:", {
    tipo_de_comprobante: tipoComprobante,
    serie,
    cliente_tipo_de_documento: clienteTipoDoc,
    documento: clienteNumDoc,
    longitud: clienteNumDoc.length,
    tipoIgv, esGravado,
    valorUnit, precioUnit, subtotal, igvItem,
    totalGravada, totalInafecta, totalIgv, total,
    fecha_de_emision,
  });

  // ── Payload ────────────────────────────────────────────────────────────────
  const payload = {
    operacion:                         "generar_comprobante",
    tipo_de_comprobante:               tipoComprobante,
    serie,
    numero:                            "",
    sunat_transaction:                 1,
    tipo_de_operacion:                 1,
    cliente_tipo_de_documento:         clienteTipoDoc,
    cliente_numero_de_documento:       clienteNumDoc,
    cliente_denominacion:              clienteNombre,
    cliente_direccion:                 clienteDireccion,
    moneda:                            1,
    fecha_de_emision,
    porcentaje_de_igv:                 esGravado ? 18 : 0,
    total_gravada:                     totalGravada,
    ...(esGravado ? {
      // Gravado: SOLO total_gravada, total_igv y total — sin campos en 0
      total_igv: totalIgv,
      total,
    } : {
      // Inafecto: todos los campos
      total_exonerada: 0,
      total_inafecta:  totalInafecta,
      total_gratuita:  0,
      total_igv:       0,
      total,
    }),
    codigo_unico:                      Date.now().toString(),
    items: [
      {
        unidad_de_medida:  "ZZ",
        codigo:            String(datos.codigoProducto),
        descripcion:       datos.descripcion,
        cantidad,
        valor_unitario:    valorUnit,
        precio_unitario:   precioUnit,
        descuento:         0,
        subtotal,
        tipo_de_igv:       tipoIgv,
        afectacion_de_igv: tipoIgv,
        porcentaje_de_igv: esGravado ? 18 : 0,
        igv:               igvItem,
        total:             totalItem,
      },
    ],
  };

  console.log(">>> PAYLOAD ENVIADO A NUBEFACT:", JSON.stringify(payload, null, 2));
  console.log("ENDPOINT config:", ENDPOINT);
  console.log("TOKEN LENGTH:", TOKEN?.length ?? 0, "| TOKEN INICIO:", TOKEN?.slice(0, 8) ?? "N/A");

  const res = await fetch(url, {
    method:  "POST",
    headers: {
      "Content-Type":  "application/json",
      "Authorization": `Token token="${TOKEN}"`,
    },
    body:  JSON.stringify(payload),
    cache: "no-store",
  });

  const json = await res.json();
  console.log(">>> RESPUESTA REAL DE NUBEFACT:", JSON.stringify(json, null, 2));

  if (!res.ok || json.errors) {
    let msg: string;
    if (typeof json.errors === "string") {
      msg = json.errors;
    } else if (Array.isArray(json.errors)) {
      msg = json.errors.flat().join(", ");
    } else if (json.errors && typeof json.errors === "object") {
      msg = Object.values(json.errors).flat().join(", ");
    } else {
      msg = `Error Nubefact HTTP ${res.status}: ${JSON.stringify(json)}`;
    }
    throw new Error(msg);
  }

  return {
    pdfUrl:   json.enlace_del_pdf ?? json.pdf_url ?? "",
    serie:    json.serie ?? serie,
    numero:   json.numero         ?? 0,
    enlaceQr: json.enlace_del_qr  ?? "",
  };
}
