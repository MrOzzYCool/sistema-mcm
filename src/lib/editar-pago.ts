/**
 * Módulo de lógica pura para la edición completa de un pago ya registrado
 * (feature: editar-pago-registrado).
 *
 * Este archivo contiene SOLO tipos, interfaces y las firmas (signatures) de las
 * funciones puras que orquestará la acción `update-pago-completo` en
 * `src/app/api/admin/payments/route.ts`. No tiene dependencias de red: toda la
 * validación, la resolución/intercambio de archivos, la planificación de
 * escrituras y la construcción de la auditoría viven aquí para poder ser
 * verificadas con tests property-based.
 *
 * Los tipos se alinean con:
 *  - El contrato del request descrito en design.md (acción `update-pago-completo`).
 *  - Las columnas reales de `installments`, `payment_vouchers` e
 *    `historial_auditoria` (ver supabase/schema.sql).
 *
 * Tareas 1.2–1.6 implementarán el cuerpo de las funciones declaradas aquí.
 */

// ─── Discriminador de la acción ───────────────────────────────────────────────

export const UPDATE_PAGO_COMPLETO_ACTION = "update-pago-completo" as const;

export const AUDIT_ACCION_EDITAR_PAGO = "editar_pago_completo" as const;

// ─── Entrada de la acción (contrato del request body) ─────────────────────────

/**
 * Cuerpo JSON que recibe la Accion_Editar_Pago.
 *
 * Campos obligatorios: `installment_id`, `tipo_comprobante`, `comprobante_serie`,
 * `comprobante_numero`, `amount`, `fecha_pago`.
 * Campos opcionales: `nota_contabilidad`, `comprobante_url`, `voucher_url`,
 * `swap_archivos` (default `false`).
 */
export interface EditarPagoInput {
  /** Discriminador de la acción. */
  action: typeof UPDATE_PAGO_COMPLETO_ACTION;
  /** ID de la Cuota (`installments.id`). Su `status` debe ser `paid`. */
  installment_id: string;
  /** Tipo del comprobante (p. ej. `boleta`, `factura`). No vacío. */
  tipo_comprobante: string;
  /** Serie del comprobante. No vacía, ≤ 20 caracteres. */
  comprobante_serie: string;
  /** Número del comprobante. No vacío, ≤ 20 caracteres. */
  comprobante_numero: string;
  /** Monto. `0 ≤ amount ≤ 999,999,999.99`. */
  amount: number;
  /** Fecha de pago (ISO). Válida y no posterior a `now()` del servidor. */
  fecha_pago: string;
  /** Nota libre de contabilidad (opcional). */
  nota_contabilidad?: string | null;
  /** Nuevo Archivo_Boleta. 1–10 URLs separadas por coma, ≤ 2000 chars, PDF/imagen. */
  comprobante_url?: string;
  /** Nuevo Archivo_Voucher. Mismas reglas de formato que `comprobante_url`. */
  voucher_url?: string;
  /** Si `true`, intercambia boleta ↔ voucher actuales e ignora los reemplazos. */
  swap_archivos?: boolean;
}

// ─── Identidad del administrador ──────────────────────────────────────────────

/**
 * Identidad del Administrador autenticado, usada para la auditoría y la creación
 * de vouchers (`reviewed_by`).
 */
export interface AdminIdentidad {
  /** `auth.users.id` del administrador (→ `admin_id` / `reviewed_by`). */
  id: string;
  /** Correo del administrador (→ `admin_email`). */
  email: string;
}

// ─── Estado actual de la Cuota y su Voucher_Registro ──────────────────────────

/**
 * Estado leído de la base de datos antes de aplicar la edición.
 * Refleja las columnas relevantes de `installments` y del `payment_vouchers`
 * asociado (si existe).
 */
export interface EstadoPago {
  /** `installments.id`. */
  installmentId: string;
  /** `installments.status`. Debe ser `paid` para permitir la edición. */
  status: string;
  /** `payment_plans.alumno_id` (vía join `payment_plans!inner(alumno_id)`). */
  alumnoId: string | null;
  /** Valor actual de `installments.comprobante_url` (Archivo_Boleta). */
  boletaActual: string | null;
  /** `payment_vouchers.id` del voucher asociado, o `null` si no existe. */
  voucherId: string | null;
  /** Valor actual de `payment_vouchers.voucher_url` (Archivo_Voucher). */
  voucherActual: string | null;
}

// ─── Resolución de archivos (boleta / voucher) ────────────────────────────────

/**
 * Entrada para resolver los valores finales de boleta y voucher, combinando el
 * estado actual con los reemplazos o la instrucción de intercambio.
 */
export interface ResolverArchivosInput {
  /** Valor actual de Archivo_Boleta (`installments.comprobante_url`). */
  boletaActual: string | null;
  /** Valor actual de Archivo_Voucher (`payment_vouchers.voucher_url`). */
  voucherActual: string | null;
  /** Nuevo Archivo_Boleta enviado (si viene). */
  comprobanteUrl?: string;
  /** Nuevo Archivo_Voucher enviado (si viene). */
  voucherUrl?: string;
  /** Instrucción de Intercambio_Archivos. */
  swap: boolean;
}

/**
 * Resultado de resolver los archivos. Si `errores` no está vacío, no debe
 * aplicarse ninguna escritura (sin cambios parciales).
 */
export interface ResolverArchivosResultado {
  /** Valor final de Archivo_Boleta a persistir. */
  boletaFinal: string;
  /** Valor final de Archivo_Voucher a persistir. */
  voucherFinal: string;
  /** Mensajes de error de validación/precondición. Vacío si la resolución es válida. */
  errores: string[];
  /** `true` si el Archivo_Boleta cambia respecto al actual. */
  boletaReemplazada: boolean;
  /** `true` si el Archivo_Voucher cambia respecto al actual. */
  voucherReemplazada: boolean;
}

// ─── Comandos de escritura ────────────────────────────────────────────────────

/**
 * Actualización de la Cuota (`installments`). Se emiten solo las columnas que
 * cambian. Nunca incluye `status` (se conserva `paid`).
 */
export interface InstallmentsUpdatePayload {
  tipo_comprobante?: string;
  comprobante_serie?: string;
  comprobante_numero?: string;
  amount?: number;
  fecha_pago?: string;
  nota_contabilidad?: string | null;
  comprobante_url?: string;
}

/**
 * Actualización del Voucher_Registro existente (`payment_vouchers`).
 */
export interface PaymentVouchersUpdatePayload {
  voucher_url?: string;
}

/**
 * Inserción de un nuevo Voucher_Registro (`payment_vouchers`) cuando la Cuota no
 * tenía uno asociado. `status` siempre `approved`; `reviewed_at` en UTC.
 */
export interface PaymentVouchersInsertPayload {
  installment_id: string;
  alumno_id: string;
  voucher_url: string;
  status: "approved";
  reviewed_by: string;
  reviewed_at: string;
}

/**
 * Comando de escritura a ejecutar contra la base de datos. El orquestador del
 * route handler los ejecuta en orden. Un plan vacío significa "no escribir nada".
 */
export type ComandoEscritura =
  | {
      tabla: "installments";
      operacion: "update";
      match: { id: string };
      datos: InstallmentsUpdatePayload;
    }
  | {
      tabla: "payment_vouchers";
      operacion: "update";
      match: { id: string };
      datos: PaymentVouchersUpdatePayload;
    }
  | {
      tabla: "payment_vouchers";
      operacion: "insert";
      datos: PaymentVouchersInsertPayload;
    };

// ─── Auditoría (`historial_auditoria`) ────────────────────────────────────────

/**
 * Banderas de lo ocurrido durante la operación, usadas para el `detalle` de la
 * auditoría.
 */
export interface OperacionFlags {
  swap: boolean;
  boletaReemplazada: boolean;
  voucherReemplazada: boolean;
}

/**
 * Contenido del campo `detalle` (jsonb) del registro de auditoría.
 */
export interface AuditoriaDetalle {
  installment_id: string;
  swap: boolean;
  boleta_reemplazada: boolean;
  voucher_reemplazado: boolean;
}

/**
 * Registro a insertar en `historial_auditoria` para una edición exitosa.
 */
export interface RegistroAuditoria {
  accion: typeof AUDIT_ACCION_EDITAR_PAGO;
  admin_id: string;
  admin_email: string;
  target_id: string;
  detalle: AuditoriaDetalle;
}

// ─── Visor de archivos ────────────────────────────────────────────────────────

/** Tipo de visualización de un archivo en el visor del modal. */
export type TipoVisor = "pdf" | "img";

/** Elemento del visor: una URL con su tipo de render asociado. */
export interface ElementoVisor {
  url: string;
  tipo: TipoVisor;
}

// ─── Firmas de las funciones puras (implementadas en tareas 1.2–1.6) ──────────

/** Longitud máxima permitida para `comprobante_serie` y `comprobante_numero`. */
const MAX_COMPROBANTE_LEN = 20;

/** Monto máximo permitido para una Cuota. */
const MONTO_MAX = 999999999.99;

/**
 * Valida `comprobante_serie`, `comprobante_numero` y `tipo_comprobante`.
 * Retorna un mensaje de error específico o `null` si todos son válidos.
 *
 * Reglas (criterios 4.2, 4.3, 4.5):
 *  - `comprobante_serie`: obligatoria, no solo-espacios, ≤ 20 caracteres (tras `trim`).
 *  - `comprobante_numero`: obligatorio, no solo-espacios, ≤ 20 caracteres (tras `trim`).
 *  - `tipo_comprobante`: obligatorio, no solo-espacios.
 *
 * (Tarea 1.2)
 */
export function validarCamposComprobante(input: EditarPagoInput): string | null {
  const serie = (input.comprobante_serie ?? "").trim();
  if (serie.length === 0 || serie.length > MAX_COMPROBANTE_LEN) {
    return "La serie es obligatoria y no debe exceder 20 caracteres.";
  }

  const numero = (input.comprobante_numero ?? "").trim();
  if (numero.length === 0 || numero.length > MAX_COMPROBANTE_LEN) {
    return "El número es obligatorio y no debe exceder 20 caracteres.";
  }

  const tipo = (input.tipo_comprobante ?? "").trim();
  if (tipo.length === 0) {
    return "El tipo de comprobante es obligatorio.";
  }

  return null;
}

/**
 * Valida que el monto esté en `[0, 999999999.99]`.
 * Retorna un mensaje de error o `null`.
 *
 * Rechaza valores no finitos (`NaN`, `Infinity`) y los que estén fuera de rango
 * (criterio 4.4).
 *
 * (Tarea 1.2)
 */
export function validarMonto(amount: number): string | null {
  if (!Number.isFinite(amount) || amount < 0 || amount > MONTO_MAX) {
    return "El monto debe estar entre 0 y 999,999,999.99.";
  }
  return null;
}

/**
 * Valida que `fecha` sea parseable y no posterior a `now`.
 * Retorna un mensaje de error o `null`.
 *
 * El `now` se inyecta como parámetro para que la validación sea determinista y
 * testeable (criterio 4.6).
 *
 * (Tarea 1.2)
 */
export function validarFecha(fecha: string, now: Date): string | null {
  if (typeof fecha !== "string" || fecha.trim().length === 0) {
    return "La fecha de pago es inválida.";
  }

  const parsed = new Date(fecha);
  const ms = parsed.getTime();
  if (Number.isNaN(ms) || ms > now.getTime()) {
    return "La fecha de pago es inválida.";
  }

  return null;
}

/** Cantidad máxima de URLs permitidas en una cadena de archivo. */
const MAX_ARCHIVO_URLS = 10;

/** Longitud total máxima permitida para una cadena de archivo. */
const MAX_ARCHIVO_LEN = 2000;

/** Mensaje de rechazo para archivos que no cumplen formato o límites (ver design.md). */
const MSG_ARCHIVO_INVALIDO =
  "El archivo enviado no cumple el formato o los límites permitidos.";

/**
 * Determina el tipo de visor de una URL inspeccionando su extensión final,
 * ignorando querystring (`?`) y fragmento (`#`).
 *
 * Acorde al visor del modal, que usa `<embed>` para PDF e `<img>` para imágenes:
 *  - PDF: `.pdf`.
 *  - Imagen: `.jpg`, `.jpeg`, `.png`, `.gif`, `.webp`.
 *
 * Retorna `"pdf"`, `"img"` o `null` si la extensión no es ninguna de las
 * soportadas. Helper interno reutilizable por `parsearVisor` (tarea 1.6).
 */
function detectarTipoVisor(url: string): TipoVisor | null {
  // Descartar querystring y fragmento antes de inspeccionar la extensión.
  const sinQuery = url.split("?")[0].split("#")[0];
  // Quedarse con el último segmento de ruta para no confundir puntos previos.
  const segmento = sinQuery.split("/").pop() ?? sinQuery;
  const punto = segmento.lastIndexOf(".");
  if (punto === -1) {
    return null;
  }
  const ext = segmento.slice(punto + 1).toLowerCase();

  if (ext === "pdf") {
    return "pdf";
  }
  if (
    ext === "jpg" ||
    ext === "jpeg" ||
    ext === "png" ||
    ext === "gif" ||
    ext === "webp"
  ) {
    return "img";
  }
  return null;
}

/**
 * Valida una cadena de URLs de archivo (boleta o voucher): 1–10 URLs separadas
 * por coma, longitud total ≤ 2000 chars y cada elemento en formato PDF o imagen.
 * Retorna un mensaje de error o `null`.
 *
 * Reglas (criterios 5.1, 5.2, 5.8):
 *  - Longitud total de la cadena ≤ 2000 caracteres.
 *  - Entre 1 y 10 URLs no vacías (tras `trim`) separadas por coma.
 *  - Cada URL debe apuntar a un archivo PDF o imagen.
 *
 * (Tarea 1.3)
 */
export function validarArchivoUrls(valor: string): string | null {
  if (typeof valor !== "string" || valor.length > MAX_ARCHIVO_LEN) {
    return MSG_ARCHIVO_INVALIDO;
  }

  const urls = valor
    .split(",")
    .map((u) => u.trim())
    .filter((u) => u.length > 0);

  if (urls.length < 1 || urls.length > MAX_ARCHIVO_URLS) {
    return MSG_ARCHIVO_INVALIDO;
  }

  for (const url of urls) {
    if (detectarTipoVisor(url) === null) {
      return MSG_ARCHIVO_INVALIDO;
    }
  }

  return null;
}

/** Mensaje de precondición fallida del Intercambio_Archivos (criterio 6.3 / Property 14). */
const MSG_SWAP_PRECONDICION = "Ambos archivos deben existir para intercambiarse.";

/** Mensaje de boleta final vacía (criterios 5.5–5.6 / Property 11). */
const MSG_BOLETA_OBLIGATORIA = "La boleta es obligatoria.";

/** Mensaje de voucher final vacío (criterios 5.5–5.7 / Property 11). */
const MSG_VOUCHER_OBLIGATORIO = "El voucher es obligatorio.";

/**
 * Resuelve los valores finales de boleta y voucher a partir del estado actual y
 * de los reemplazos o la instrucción de intercambio.
 *
 * Reglas (design.md "Lógica del intercambio" y "Reemplazo vs. intercambio"):
 *  - Modo intercambio (`swap === true`): requiere boleta y voucher actuales no
 *    vacíos (Property 14 / criterio 6.3); de cumplirse, intercambia ambos
 *    valores (Property 13, involutivo y conservador del conjunto) ignorando los
 *    reemplazos enviados.
 *  - Modo reemplazo (`swap !== true`): valida el formato de `comprobanteUrl` y
 *    `voucherUrl` con `validarArchivoUrls`; aplica solo los que vengan válidos.
 *    Si no viene ninguno, conserva los valores actuales (Property 9 / criterio 5.4).
 *  - Validación final de no-vacío sobre los valores resultantes (Properties 10 y
 *    11 / criterios 5.5–5.7).
 *
 * Si `errores` no está vacío, el resultado NO representa un cambio aplicable:
 * `boletaFinal`/`voucherFinal` se devuelven iguales a los valores actuales y
 * `boletaReemplazada`/`voucherReemplazada` quedan en `false`, de modo que la capa
 * superior no emita escrituras parciales.
 *
 * (Tarea 1.4)
 */
export function resolverArchivos(input: ResolverArchivosInput): ResolverArchivosResultado {
  const boletaActual = input.boletaActual ?? "";
  const voucherActual = input.voucherActual ?? "";

  const noVacio = (valor: string): boolean => valor.trim().length > 0;

  /**
   * Resultado "sin cambios": conserva los valores actuales tal cual y marca
   * ambos reemplazos como `false`. Se usa cuando hay errores de validación o
   * precondición para evitar que la capa superior escriba.
   */
  const sinCambios = (errores: string[]): ResolverArchivosResultado => ({
    boletaFinal: boletaActual,
    voucherFinal: voucherActual,
    errores,
    boletaReemplazada: false,
    voucherReemplazada: false,
  });

  // ─── Modo intercambio ───────────────────────────────────────────────────
  if (input.swap === true) {
    // Precondición (Property 14 / criterio 6.3): ambos deben existir.
    if (!noVacio(boletaActual) || !noVacio(voucherActual)) {
      return sinCambios([MSG_SWAP_PRECONDICION]);
    }

    // Intercambio involutivo (Property 13): boleta ↔ voucher.
    return {
      boletaFinal: voucherActual,
      voucherFinal: boletaActual,
      errores: [],
      boletaReemplazada: true,
      voucherReemplazada: true,
    };
  }

  // ─── Modo reemplazo ─────────────────────────────────────────────────────
  const erroresFormato: string[] = [];

  const traeComprobante = input.comprobanteUrl !== undefined;
  const traeVoucher = input.voucherUrl !== undefined;

  if (traeComprobante) {
    const error = validarArchivoUrls(input.comprobanteUrl as string);
    if (error !== null) {
      erroresFormato.push(error);
    }
  }

  if (traeVoucher) {
    const error = validarArchivoUrls(input.voucherUrl as string);
    if (error !== null) {
      erroresFormato.push(error);
    }
  }

  // Si algún reemplazo enviado es inválido de formato, no se escribe nada.
  if (erroresFormato.length > 0) {
    return sinCambios(erroresFormato);
  }

  // Aplicar reemplazos válidos; en su defecto conservar los valores actuales.
  const boletaFinal = traeComprobante
    ? (input.comprobanteUrl as string).trim()
    : boletaActual;
  const boletaReemplazada = traeComprobante && boletaFinal !== boletaActual;

  const voucherFinal = traeVoucher
    ? (input.voucherUrl as string).trim()
    : voucherActual;
  const voucherReemplazada = traeVoucher && voucherFinal !== voucherActual;

  // ─── Validación final de no-vacío (Properties 10, 11 / criterios 5.5–5.7) ──
  const erroresNoVacio: string[] = [];
  if (!noVacio(boletaFinal)) {
    erroresNoVacio.push(MSG_BOLETA_OBLIGATORIA);
  }
  if (!noVacio(voucherFinal)) {
    erroresNoVacio.push(MSG_VOUCHER_OBLIGATORIO);
  }

  if (erroresNoVacio.length > 0) {
    return sinCambios(erroresNoVacio);
  }

  return {
    boletaFinal,
    voucherFinal,
    errores: [],
    boletaReemplazada,
    voucherReemplazada,
  };
}

/**
 * Opciones de `planificarEscrituras`.
 *
 * Todas son opcionales para mantener la función pura y testeable: cuando no se
 * proveen, se derivan valores por defecto deterministas (el `now` por defecto es
 * `new Date()`). La capa superior (route handler) siempre debe proveer `adminId`
 * y, cuando corresponda, `reviewedAt`, de modo que el `insert` de un nuevo
 * Voucher_Registro quede trazado correctamente.
 */
export interface PlanificarEscriturasOpts {
  /** Instante de referencia para `validarFecha`. Por defecto `new Date()`. */
  now?: Date;
  /**
   * Identificador del Administrador (`auth.users.id`) usado como `reviewed_by`
   * al crear un Voucher_Registro. La capa superior siempre lo provee; si falta,
   * se usa `""` como fallback para no romper la pureza de la función.
   */
  adminId?: string;
  /**
   * Fecha/hora UTC (ISO) usada como `reviewed_at` al crear un Voucher_Registro.
   * Si no se provee, se deriva de `now` (`now.toISOString()`).
   */
  reviewedAt?: string;
}

/**
 * Construye la lista de comandos de escritura para una edición. Retorna una
 * lista vacía si hay errores de validación (sin escrituras parciales) y nunca
 * emite cambios de `status`.
 *
 * Firma final (requerida por la tarea 4 del route handler):
 *
 * ```ts
 * planificarEscrituras(
 *   estado: EstadoPago,
 *   input: EditarPagoInput,
 *   opts?: PlanificarEscriturasOpts, // { now?; adminId?; reviewedAt? }
 * ): ComandoEscritura[]
 * ```
 *
 * Orquestación (design.md "Reemplazo vs. intercambio", "Lógica del intercambio"
 * y Correctness Properties 5, 6, 8, 12):
 *
 *  1. Validaciones de campos y de fecha. Cualquier error ⇒ `[]` (Property 12 /
 *     criterio 4.8): no se emite ninguna escritura parcial.
 *       - `validarCamposComprobante(input)`.
 *       - `validarMonto(input.amount)`.
 *       - `validarFecha(input.fecha_pago, now)` con `now = opts.now ?? new Date()`.
 *  2. `resolverArchivos(...)` con el estado actual y los reemplazos/instrucción de
 *     intercambio del `input`. Si `resultado.errores` no está vacío ⇒ `[]`.
 *  3. Construcción de comandos:
 *       a. SIEMPRE un `update` a `installments` (match por `estado.installmentId`)
 *          con los campos editables y `comprobante_url = resultado.boletaFinal`.
 *          NUNCA incluye `status` (Property 6 / criterio 4.9: se conserva `paid`).
 *       b. Voucher:
 *          - Si `estado.voucherId` existe ⇒ `update` a `payment_vouchers`
 *            (match por `estado.voucherId`) con `voucher_url = resultado.voucherFinal`.
 *          - Si `estado.voucherId` es `null` ⇒ `insert` en `payment_vouchers`
 *            con `installment_id`, `alumno_id`, `voucher_url = resultado.voucherFinal`,
 *            `status = "approved"`, `reviewed_by = opts.adminId ?? ""` y
 *            `reviewed_at = opts.reviewedAt ?? now.toISOString()` (Property 8 /
 *            criterio 5.3). Al llegar aquí `resultado.voucherFinal` siempre es no
 *            vacío, porque `resolverArchivos` ya habría reportado error (y habríamos
 *            retornado `[]`) si no hubiese voucher.
 *
 * (Tarea 1.5)
 */
export function planificarEscrituras(
  estado: EstadoPago,
  input: EditarPagoInput,
  opts: PlanificarEscriturasOpts = {},
): ComandoEscritura[] {
  const now = opts.now ?? new Date();

  // ─── 1. Validaciones de campos y fecha (Property 12 / criterio 4.8) ───────
  if (validarCamposComprobante(input) !== null) {
    return [];
  }
  if (validarMonto(input.amount) !== null) {
    return [];
  }
  if (validarFecha(input.fecha_pago, now) !== null) {
    return [];
  }

  // ─── 2. Resolución de archivos (boleta / voucher) ─────────────────────────
  const resultado = resolverArchivos({
    boletaActual: estado.boletaActual,
    voucherActual: estado.voucherActual,
    comprobanteUrl: input.comprobante_url,
    voucherUrl: input.voucher_url,
    swap: input.swap_archivos === true,
  });

  // Errores de resolución/precondición ⇒ sin escrituras parciales.
  if (resultado.errores.length > 0) {
    return [];
  }

  const comandos: ComandoEscritura[] = [];

  // ─── 3a. Update de installments (NUNCA toca `status`; Property 6 / 4.9) ───
  comandos.push({
    tabla: "installments",
    operacion: "update",
    match: { id: estado.installmentId },
    datos: {
      tipo_comprobante: input.tipo_comprobante,
      comprobante_serie: input.comprobante_serie,
      comprobante_numero: input.comprobante_numero,
      amount: input.amount,
      fecha_pago: input.fecha_pago,
      nota_contabilidad: input.nota_contabilidad ?? null,
      comprobante_url: resultado.boletaFinal,
    },
  });

  // ─── 3b. Update o insert del Voucher_Registro ─────────────────────────────
  if (estado.voucherId !== null) {
    comandos.push({
      tabla: "payment_vouchers",
      operacion: "update",
      match: { id: estado.voucherId },
      datos: { voucher_url: resultado.voucherFinal },
    });
  } else {
    // No existe Voucher_Registro: se crea uno (Property 8 / criterio 5.3).
    const reviewedAt = opts.reviewedAt ?? now.toISOString();
    comandos.push({
      tabla: "payment_vouchers",
      operacion: "insert",
      datos: {
        installment_id: estado.installmentId,
        alumno_id: estado.alumnoId ?? "",
        voucher_url: resultado.voucherFinal,
        status: "approved",
        reviewed_by: opts.adminId ?? "",
        reviewed_at: reviewedAt,
      },
    });
  }

  return comandos;
}

/**
 * Construye el registro de `historial_auditoria` para una edición exitosa.
 *
 * Fija `accion = "editar_pago_completo"`, la identidad del Administrador
 * (`admin_id`/`admin_email`), `target_id = installment_id` y un `detalle` con el
 * `installment_id` y las banderas de la operación (intercambio y reemplazos)
 * (criterios 7.1, 7.2).
 *
 * (Tarea 1.6)
 */
export function construirAuditoria(
  input: EditarPagoInput,
  flags: OperacionFlags,
  admin: AdminIdentidad,
): RegistroAuditoria {
  return {
    accion: AUDIT_ACCION_EDITAR_PAGO,
    admin_id: admin.id,
    admin_email: admin.email,
    target_id: input.installment_id,
    detalle: {
      installment_id: input.installment_id,
      swap: flags.swap,
      boleta_reemplazada: flags.boletaReemplazada,
      voucher_reemplazado: flags.voucherReemplazada,
    },
  };
}

/**
 * Divide una cadena de URLs separadas por coma y asigna el tipo de visor a cada
 * URL no vacía, conservando el orden.
 *
 * Descarta las URLs vacías (tras `trim`). Para cada URL no vacía reutiliza el
 * helper `detectarTipoVisor`: usa `"pdf"` si la URL apunta a un PDF y `"img"`
 * en caso contrario (fallback del visor, que renderiza `<img>`) (criterio 3.3,
 * Property 16). Si `valor` no es una cadena, retorna una lista vacía.
 *
 * (Tarea 1.6)
 */
export function parsearVisor(valor: string): ElementoVisor[] {
  if (typeof valor !== "string") {
    return [];
  }

  return valor
    .split(",")
    .map((u) => u.trim())
    .filter((u) => u.length > 0)
    .map((url) => ({
      url,
      tipo: detectarTipoVisor(url) === "pdf" ? "pdf" : "img",
    }));
}
