// ─── Nubefact — Boletas y Facturas Electrónicas ───────────────────────────────

const ENDPOINT = process.env.NUBEFACT_ENDPOINT!;
const TOKEN    = process.env.NUBEFACT_TOKEN!;

export interface BoletaInput {
  codigoProducto:  number;
  descripcion:     string;
  cantidad:        number;
  precioUnitario:  number;
  valorUnitario?:  number;
  tipoIgv?:        number;
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

  // ── IGV ────────────────────────────────────────────────────────────────────
  const montoTotal   = r2(datos.precioUnitario * datos.cantidad);
  const tipoIgvBase  = datos.tipoIgv ?? 9;
  // Forzar tipo 10 si monto es 400 o 350 (actualizaciones con IGV)
  const tipoIgv      = (montoTotal === 400 || montoTotal === 350) ? 10 : tipoIgvBase;
  const esGravado    = tipoIgv === 10;
  const cantidad     = datos.cantidad;

  const precioUnit    = r2(datos.precioUnitario);
  const valorUnit     = esGravado
    ? r2(datos.valorUnitario ?? precioUnit / 1.18)
    : precioUnit;

  const subtotal      = r2(valorUnit  * cantidad);
  const totalItem     = r2(precioUnit * cantidad);
  const igvItem       = esGravado ? r2(totalItem - subtotal) : 0;
  const totalGravada  = esGravado ? subtotal  : 0;
  const totalInafecta = esGravado ? 0         : totalItem;
  const totalIgv      = igvItem;
  const total         = r2(totalGravada + totalInafecta + totalIgv);

  // ── Comprobante ────────────────────────────────────────────────────────────
  // Nubefact: 2=Boleta, 1=Factura | por longitud del documento
  const clienteNumDoc   = (datos.tipoComprobante === "factura" && datos.ruc)
    ? datos.ruc : datos.dniCliente;
  const esBoleta        = clienteNumDoc.length !== 11;
  const tipoComprobante = esBoleta ? 2 : 1;
  const clienteTipoDoc  = esBoleta ? 1 : 6;
  const clienteNombre   = esBoleta
    ? datos.nombreCliente
    : (datos.razonSocial ?? datos.nombreCliente);
  const clienteDireccion = (!esBoleta && datos.direccionFiscal)
    ? datos.direccionFiscal : "";

  // Series: Gravado(10)→BBB3/FFF3 | Inafecto(9)→BBB2/FFF2
  const serie = esGravado
    ? (esBoleta ? "BBB3" : "FFF3")
    : (esBoleta ? "BBB2" : "FFF2");

  // Fecha en zona horaria Perú
  const fechaPeru        = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Lima" }));
  const fecha_de_emision = fechaPeru.toISOString().split("T")[0];

  console.log("ENDPOINT:", ENDPOINT);
  console.log("tipoIgv:", tipoIgv, "| esGravado:", esGravado, "| serie:", serie, "| tipo:", tipoComprobante);

  // ── Payload ────────────────────────────────────────────────────────────────
  const payload = {
    operacion:                   "generar_comprobante",
    tipo_de_comprobante:         tipoComprobante,
    serie,
    codigo_tipo_operacion:       esGravado ? "0101" : "0200",
    numero:                      "",
    sunat_transaction:           1,
    tipo_de_operacion:           1,
    cliente_tipo_de_documento:   clienteTipoDoc,
    cliente_numero_de_documento: clienteNumDoc,
    cliente_denominacion:        clienteNombre,
    cliente_direccion:           clienteDireccion,
    moneda:                      1,
    fecha_de_emision,
    porcentaje_de_igv:           esGravado ? 18 : 0,
    ...(esGravado ? {
      total_gravada: totalGravada,
      total_igv:     totalIgv,
      total,
    } : {
      total_gravada:   0,
      total_exonerada: 0,
      total_inafecta:  totalInafecta,
      total_gratuita:  0,
      total_igv:       0,
      total,
    }),
    codigo_unico: Date.now().toString(),
    items: [
      {
        unidad_de_medida:  "ZZ",
        codigo:            String(datos.codigoProducto),
        descripcion:       datos.descripcion,
        cantidad,
        valor_unitario:    esGravado ? valorUnit : precioUnit,
        precio_unitario:   precioUnit,
        descuento:         0,
        subtotal:          esGravado ? subtotal : totalItem,
        tipo_de_igv:       tipoIgv,
        afectacion_de_igv: tipoIgv,
        porcentaje_de_igv: esGravado ? 18 : 0,
        igv:               esGravado ? igvItem : 0,
        total:             totalItem,
      },
    ],
  };

  console.log(">>> PAYLOAD:", JSON.stringify(payload, null, 2));

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
  console.log(">>> RESPUESTA NUBEFACT:", JSON.stringify(json, null, 2));

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
    serie:    json.serie          ?? serie,
    numero:   json.numero         ?? 0,
    enlaceQr: json.enlace_del_qr  ?? "",
  };
}
