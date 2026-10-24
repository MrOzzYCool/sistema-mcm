import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import {
  validarCamposComprobante,
  validarMonto,
  validarFecha,
  validarArchivoUrls,
  resolverArchivos,
  planificarEscrituras,
  construirAuditoria,
  parsearVisor,
  UPDATE_PAGO_COMPLETO_ACTION,
  AUDIT_ACCION_EDITAR_PAGO,
  type EditarPagoInput,
  type EstadoPago,
  type AdminIdentidad,
  type OperacionFlags,
  type ComandoEscritura,
} from '../editar-pago'

// ─── Helpers / generadores compartidos ────────────────────────────────────────

/** Extensiones aceptadas por el validador de archivos (pdf + imágenes). */
const EXT_VALIDAS = ['pdf', 'jpg', 'jpeg', 'png', 'gif', 'webp'] as const
const EXT_INVALIDAS = ['txt', 'doc', 'exe', 'mp4', 'zip', 'html'] as const

/** Genera un nombre de archivo (segmento de path) sin punto ni coma ni barra. */
const nombreArchivo = fc
  .string({ minLength: 1, maxLength: 8 })
  .map((s) => s.replace(/[.,/?#\s]/g, 'x'))
  .filter((s) => s.length > 0)

/** Construye una URL con una extensión dada. */
const urlConExt = (ext: string) =>
  nombreArchivo.map((n) => `https://files.example.com/${n}.${ext}`)

/** URL con extensión válida (pdf/imagen). */
const urlValida = fc
  .constantFrom(...EXT_VALIDAS)
  .chain((ext) => urlConExt(ext))

/** URL con extensión inválida. */
const urlInvalida = fc
  .constantFrom(...EXT_INVALIDAS)
  .chain((ext) => urlConExt(ext))

/** Cadena de 1–10 URLs válidas separadas por coma, respetando el límite de 2000 chars. */
const cadenaUrlsValida = fc
  .array(urlValida, { minLength: 1, maxLength: 10 })
  .map((urls) => urls.join(','))
  .filter((s) => s.length <= 2000)

/** Input válido base para la acción. */
const inputValidoBase = (overrides: Partial<EditarPagoInput> = {}): EditarPagoInput => ({
  action: UPDATE_PAGO_COMPLETO_ACTION,
  installment_id: 'inst-1',
  tipo_comprobante: 'boleta',
  comprobante_serie: 'B001',
  comprobante_numero: '12345',
  amount: 100,
  fecha_pago: '2020-01-01T00:00:00.000Z',
  nota_contabilidad: null,
  ...overrides,
})

/** Estado válido base con voucher existente. */
const estadoValidoBase = (overrides: Partial<EstadoPago> = {}): EstadoPago => ({
  installmentId: 'inst-1',
  status: 'paid',
  alumnoId: 'alumno-1',
  boletaActual: 'https://files.example.com/boleta.pdf',
  voucherId: 'vch-1',
  voucherActual: 'https://files.example.com/voucher.pdf',
  ...overrides,
})

describe('editar-pago - correctness properties', () => {
  // Feature: editar-pago-registrado, Property 1: El guard de estado solo admite pagos registrados
  // El guard de status vive en el route handler (tarea 4.1/4.3). A nivel de lógica pura se
  // verifica el contrato booleano `status === 'paid'`: para todo status distinto de 'paid' el
  // guard rechaza, y `planificarEscrituras` no usa `status` para decidir las escrituras.
  it('Property 1: solo status "paid" pasa el guard; planificarEscrituras ignora status', () => {
    const esEditable = (status: string) => status === 'paid'
    fc.assert(
      fc.property(fc.string(), (status) => {
        if (status !== 'paid') {
          expect(esEditable(status)).toBe(false)
        }
        // planificarEscrituras no depende de status: mismo input/estado (salvo status)
        // produce idéntico plan con cualquier status.
        const input = inputValidoBase()
        const planPaid = planificarEscrituras(
          estadoValidoBase({ status: 'paid' }),
          input,
          { now: new Date('2021-01-01T00:00:00.000Z'), adminId: 'a1' },
        )
        const planOtro = planificarEscrituras(
          estadoValidoBase({ status }),
          input,
          { now: new Date('2021-01-01T00:00:00.000Z'), adminId: 'a1' },
        )
        expect(planOtro).toEqual(planPaid)
      }),
      { numRuns: 100 },
    )
  })

  // Feature: editar-pago-registrado, Property 2: Validación de campos de comprobante (serie, número, tipo)
  it('Property 2: rechaza serie/numero vacíos/espacios/>20 y tipo vacío; acepta válidos', () => {
    // Rama de rechazo: al menos un campo inválido.
    const campoInvalido = fc.oneof(
      fc.constant(''),
      fc.constant('   '),
      fc.string({ minLength: 21, maxLength: 40 }).map((s) => s.padEnd(21, 'x')),
    )
    fc.assert(
      fc.property(campoInvalido, (malo) => {
        const serieMala = validarCamposComprobante(inputValidoBase({ comprobante_serie: malo }))
        expect(serieMala).not.toBeNull()
        const numeroMalo = validarCamposComprobante(inputValidoBase({ comprobante_numero: malo }))
        expect(numeroMalo).not.toBeNull()
      }),
      { numRuns: 100 },
    )

    // tipo vacío/solo-espacios rechazado.
    fc.assert(
      fc.property(fc.constantFrom('', ' ', '   ', '\t'), (tipoMalo) => {
        expect(validarCamposComprobante(inputValidoBase({ tipo_comprobante: tipoMalo }))).not.toBeNull()
      }),
      { numRuns: 100 },
    )

    // Rama de aceptación: todos no vacíos y de longitud válida (<=20 tras trim).
    const validoCorto = fc
      .string({ minLength: 1, maxLength: 20 })
      .map((s) => s.trim())
      .filter((s) => s.length >= 1 && s.length <= 20)
    fc.assert(
      fc.property(validoCorto, validoCorto, validoCorto, (serie, numero, tipo) => {
        const r = validarCamposComprobante(
          inputValidoBase({ comprobante_serie: serie, comprobante_numero: numero, tipo_comprobante: tipo }),
        )
        expect(r).toBeNull()
      }),
      { numRuns: 100 },
    )
  })

  // Feature: editar-pago-registrado, Property 3: Validación de rango de monto
  it('Property 3: rechaza <0 o >999999999.99; acepta dentro de [0, 999999999.99]', () => {
    const MAX = 999999999.99
    // Dentro de rango -> acepta.
    fc.assert(
      fc.property(fc.double({ min: 0, max: MAX, noNaN: true }), (amount) => {
        expect(validarMonto(amount)).toBeNull()
      }),
      { numRuns: 100 },
    )
    // Fuera de rango -> rechaza.
    const fuera = fc.oneof(
      fc.double({ min: -1e12, max: -0.01, noNaN: true }),
      fc.double({ min: MAX + 0.01, max: 1e12, noNaN: true }),
    )
    fc.assert(
      fc.property(fuera, (amount) => {
        expect(validarMonto(amount)).not.toBeNull()
      }),
      { numRuns: 100 },
    )
  })

  // Feature: editar-pago-registrado, Property 4: Validación de fecha de pago
  it('Property 4: rechaza fecha no parseable o > now; acepta fecha válida <= now', () => {
    const now = new Date('2022-06-15T12:00:00.000Z')
    // Fecha válida <= now.
    fc.assert(
      fc.property(
        fc.date({ min: new Date('2000-01-01T00:00:00.000Z'), max: now, noInvalidDate: true }),
        (fecha) => {
          expect(validarFecha(fecha.toISOString(), now)).toBeNull()
        },
      ),
      { numRuns: 100 },
    )
    // Fecha futura (> now) rechazada.
    fc.assert(
      fc.property(
        fc.date({
          min: new Date(now.getTime() + 1000),
          max: new Date('2100-01-01T00:00:00.000Z'),
          noInvalidDate: true,
        }),
        (fecha) => {
          expect(validarFecha(fecha.toISOString(), now)).not.toBeNull()
        },
      ),
      { numRuns: 100 },
    )
    // Cadena no parseable rechazada.
    fc.assert(
      fc.property(fc.constantFrom('', '   ', 'no-es-fecha', 'xx/yy/zzzz'), (mala) => {
        expect(validarFecha(mala, now)).not.toBeNull()
      }),
      { numRuns: 100 },
    )
  })

  // Feature: editar-pago-registrado, Property 5: Round-trip de los campos editados
  it('Property 5: el update a installments contiene exactamente los campos enviados', () => {
    const campoCorto = fc
      .string({ minLength: 1, maxLength: 20 })
      .map((s) => s.trim())
      .filter((s) => s.length >= 1 && s.length <= 20)
    fc.assert(
      fc.property(
        fc.constantFrom('boleta', 'factura', 'ticket'),
        campoCorto,
        campoCorto,
        fc.double({ min: 0, max: 999999999.99, noNaN: true }),
        fc.date({ min: new Date('2000-01-01T00:00:00.000Z'), max: new Date('2022-01-01T00:00:00.000Z'), noInvalidDate: true }),
        fc.option(fc.string({ maxLength: 50 }), { nil: null }),
        (tipo, serie, numero, amount, fecha, nota) => {
          const input = inputValidoBase({
            tipo_comprobante: tipo,
            comprobante_serie: serie,
            comprobante_numero: numero,
            amount,
            fecha_pago: fecha.toISOString(),
            nota_contabilidad: nota,
          })
          const plan = planificarEscrituras(estadoValidoBase(), input, {
            now: new Date('2023-01-01T00:00:00.000Z'),
            adminId: 'a1',
          })
          const upd = plan.find(
            (c): c is Extract<ComandoEscritura, { tabla: 'installments' }> =>
              c.tabla === 'installments' && c.operacion === 'update',
          )
          expect(upd).toBeDefined()
          expect(upd!.datos.tipo_comprobante).toBe(tipo)
          expect(upd!.datos.comprobante_serie).toBe(serie)
          expect(upd!.datos.comprobante_numero).toBe(numero)
          expect(upd!.datos.amount).toBe(amount)
          expect(upd!.datos.fecha_pago).toBe(fecha.toISOString())
          expect(upd!.datos.nota_contabilidad).toBe(nota ?? null)
        },
      ),
      { numRuns: 100 },
    )
  })

  // Feature: editar-pago-registrado, Property 6: Conservación del estado pagado
  it('Property 6: ningún comando emitido incluye la clave status', () => {
    fc.assert(
      fc.property(
        fc.boolean(),
        fc.option(cadenaUrlsValida, { nil: undefined }),
        fc.option(cadenaUrlsValida, { nil: undefined }),
        (swap, comprobanteUrl, voucherUrl) => {
          const input = inputValidoBase({
            swap_archivos: swap,
            comprobante_url: swap ? undefined : comprobanteUrl,
            voucher_url: swap ? undefined : voucherUrl,
          })
          const plan = planificarEscrituras(estadoValidoBase(), input, {
            now: new Date('2023-01-01T00:00:00.000Z'),
            adminId: 'a1',
          })
          for (const cmd of plan) {
            expect(Object.prototype.hasOwnProperty.call(cmd.datos, 'status' as string) &&
              cmd.tabla === 'installments').toBe(false)
            if (cmd.tabla === 'installments') {
              expect('status' in cmd.datos).toBe(false)
            }
          }
        },
      ),
      { numRuns: 100 },
    )
  })

  // Feature: editar-pago-registrado, Property 7: Validación de archivos (formato, cantidad y longitud)
  it('Property 7: acepta 1-10 URLs pdf/imagen <=2000 chars; rechaza fuera de esos límites', () => {
    // Aceptación.
    fc.assert(
      fc.property(cadenaUrlsValida, (valor) => {
        expect(validarArchivoUrls(valor)).toBeNull()
      }),
      { numRuns: 100 },
    )
    // Rechazo: > 10 URLs.
    fc.assert(
      fc.property(fc.array(urlValida, { minLength: 11, maxLength: 20 }), (urls) => {
        const valor = urls.join(',')
        // Si excede 2000 chars también se rechaza; en ambos casos esperamos rechazo.
        expect(validarArchivoUrls(valor)).not.toBeNull()
      }),
      { numRuns: 100 },
    )
    // Rechazo: alguna URL con formato inválido.
    fc.assert(
      fc.property(
        fc.array(urlValida, { minLength: 0, maxLength: 4 }),
        urlInvalida,
        fc.array(urlValida, { minLength: 0, maxLength: 4 }),
        (pre, mala, post) => {
          const valor = [...pre, mala, ...post].join(',')
          expect(validarArchivoUrls(valor)).not.toBeNull()
        },
      ),
      { numRuns: 100 },
    )
    // Rechazo: longitud total > 2000 chars.
    fc.assert(
      fc.property(fc.constant(null), () => {
        const larga = 'https://files.example.com/' + 'a'.repeat(2500) + '.pdf'
        expect(validarArchivoUrls(larga)).not.toBeNull()
      }),
      { numRuns: 100 },
    )
  })

  // Feature: editar-pago-registrado, Property 8: Creación de Voucher_Registro cuando no existe
  it('Property 8: asignar voucher a cuota sin voucher inserta payment_vouchers approved con datos del admin', () => {
    fc.assert(
      fc.property(cadenaUrlsValida, (voucherUrl) => {
        const reviewedAt = '2023-05-05T10:00:00.000Z'
        const adminId = 'admin-xyz'
        const estado = estadoValidoBase({ voucherId: null, voucherActual: null })
        const input = inputValidoBase({ voucher_url: voucherUrl })
        const plan = planificarEscrituras(estado, input, {
          now: new Date('2023-06-01T00:00:00.000Z'),
          adminId,
          reviewedAt,
        })
        const ins = plan.find(
          (c): c is Extract<ComandoEscritura, { tabla: 'payment_vouchers'; operacion: 'insert' }> =>
            c.tabla === 'payment_vouchers' && c.operacion === 'insert',
        )
        expect(ins).toBeDefined()
        expect(ins!.datos.status).toBe('approved')
        expect(ins!.datos.reviewed_by).toBe(adminId)
        expect(ins!.datos.reviewed_at).toBe(reviewedAt)
        expect(ins!.datos.alumno_id).toBe(estado.alumnoId)
        expect(ins!.datos.installment_id).toBe(estado.installmentId)
        expect(ins!.datos.voucher_url).toBe(voucherUrl.trim())
      }),
      { numRuns: 100 },
    )
  })

  // Feature: editar-pago-registrado, Property 9: Conservación cuando no se envían archivos
  it('Property 9: sin comprobante_url ni voucher_url y swap=false conserva los valores actuales', () => {
    fc.assert(
      fc.property(cadenaUrlsValida, cadenaUrlsValida, (boleta, voucher) => {
        const r = resolverArchivos({
          boletaActual: boleta,
          voucherActual: voucher,
          comprobanteUrl: undefined,
          voucherUrl: undefined,
          swap: false,
        })
        expect(r.errores).toEqual([])
        expect(r.boletaFinal).toBe(boleta)
        expect(r.voucherFinal).toBe(voucher)
        expect(r.boletaReemplazada).toBe(false)
        expect(r.voucherReemplazada).toBe(false)
      }),
      { numRuns: 100 },
    )
  })

  // Feature: editar-pago-registrado, Property 10: Invariante de no-vacío tras edición exitosa
  it('Property 10: cuando resolverArchivos no da errores, boleta y voucher finales son no vacíos', () => {
    const quizasReemplazo = fc.option(cadenaUrlsValida, { nil: undefined })
    fc.assert(
      fc.property(
        cadenaUrlsValida,
        cadenaUrlsValida,
        fc.boolean(),
        quizasReemplazo,
        quizasReemplazo,
        (boleta, voucher, swap, comprobanteUrl, voucherUrl) => {
          const r = resolverArchivos({
            boletaActual: boleta,
            voucherActual: voucher,
            comprobanteUrl: swap ? undefined : comprobanteUrl,
            voucherUrl: swap ? undefined : voucherUrl,
            swap,
          })
          if (r.errores.length === 0) {
            expect(r.boletaFinal.trim().length).toBeGreaterThan(0)
            expect(r.voucherFinal.trim().length).toBeGreaterThan(0)
          }
        },
      ),
      { numRuns: 100 },
    )
  })

  // Feature: editar-pago-registrado, Property 11: Rechazo cuando el resultado dejaría un archivo vacío
  it('Property 11: si el resultado dejaría boleta o voucher vacío, hay errores y no hay cambios', () => {
    const vacio = fc.constantFrom('', '   ', '\t')
    // Reemplazo de voucher con valor vacío sobre estado con boleta válida: el formato inválido
    // (vacío) produce error y conserva los actuales sin reemplazar.
    fc.assert(
      fc.property(cadenaUrlsValida, cadenaUrlsValida, vacio, (boleta, voucher, vacia) => {
        const r = resolverArchivos({
          boletaActual: boleta,
          voucherActual: voucher,
          comprobanteUrl: vacia,
          voucherUrl: undefined,
          swap: false,
        })
        expect(r.errores.length).toBeGreaterThan(0)
        expect(r.boletaFinal).toBe(boleta)
        expect(r.voucherFinal).toBe(voucher)
        expect(r.boletaReemplazada).toBe(false)
        expect(r.voucherReemplazada).toBe(false)
      }),
      { numRuns: 100 },
    )
    // Estado con boleta actual vacía, sin reemplazos: el no-vacío final falla.
    fc.assert(
      fc.property(cadenaUrlsValida, (voucher) => {
        const r = resolverArchivos({
          boletaActual: '   ',
          voucherActual: voucher,
          comprobanteUrl: undefined,
          voucherUrl: undefined,
          swap: false,
        })
        expect(r.errores.length).toBeGreaterThan(0)
        expect(r.boletaReemplazada).toBe(false)
        expect(r.voucherReemplazada).toBe(false)
      }),
      { numRuns: 100 },
    )
  })

  // Feature: editar-pago-registrado, Property 12: Entrada inválida no produce escrituras parciales
  it('Property 12: si cualquier validación falla, planificarEscrituras retorna []', () => {
    const now = new Date('2022-01-01T00:00:00.000Z')
    const entradasInvalidas = fc.oneof(
      // serie inválida
      fc.record({ kind: fc.constant('serie'), val: fc.constantFrom('', '   ') }),
      // monto fuera de rango
      fc.record({ kind: fc.constant('monto'), val: fc.constant('x') }),
      // fecha futura/invalida
      fc.record({ kind: fc.constant('fecha'), val: fc.constant('x') }),
      // archivo con formato inválido
      fc.record({ kind: fc.constant('archivo'), val: fc.constant('x') }),
    )
    fc.assert(
      fc.property(entradasInvalidas, urlInvalida, (caso, urlMala) => {
        let input = inputValidoBase()
        if (caso.kind === 'serie') input = inputValidoBase({ comprobante_serie: caso.val })
        if (caso.kind === 'monto') input = inputValidoBase({ amount: -5 })
        if (caso.kind === 'fecha') input = inputValidoBase({ fecha_pago: 'no-fecha' })
        if (caso.kind === 'archivo') input = inputValidoBase({ comprobante_url: urlMala })
        const plan = planificarEscrituras(estadoValidoBase(), input, { now, adminId: 'a1' })
        expect(plan).toEqual([])
      }),
      { numRuns: 100 },
    )
  })

  // Feature: editar-pago-registrado, Property 13: El intercambio es involutivo y no pierde archivos
  it('Property 13: swap intercambia; aplicarlo dos veces restaura; conserva el conjunto {boleta,voucher}', () => {
    fc.assert(
      fc.property(cadenaUrlsValida, cadenaUrlsValida, (boleta, voucher) => {
        const r1 = resolverArchivos({
          boletaActual: boleta,
          voucherActual: voucher,
          swap: true,
        })
        expect(r1.errores).toEqual([])
        expect(r1.boletaFinal).toBe(voucher)
        expect(r1.voucherFinal).toBe(boleta)
        // Conjunto preservado.
        expect(new Set([r1.boletaFinal, r1.voucherFinal])).toEqual(new Set([boleta, voucher]))
        // Involución: aplicar swap otra vez vuelve al original.
        const r2 = resolverArchivos({
          boletaActual: r1.boletaFinal,
          voucherActual: r1.voucherFinal,
          swap: true,
        })
        expect(r2.boletaFinal).toBe(boleta)
        expect(r2.voucherFinal).toBe(voucher)
      }),
      { numRuns: 100 },
    )
  })

  // Feature: editar-pago-registrado, Property 14: Precondición del intercambio
  it('Property 14: swap con boleta o voucher vacío se rechaza con el mensaje de precondición sin cambios', () => {
    const vacio = fc.constantFrom('', '   ', '\t', null)
    fc.assert(
      fc.property(fc.oneof(cadenaUrlsValida, vacio), fc.oneof(cadenaUrlsValida, vacio), (boleta, voucher) => {
        const boletaVacia = (boleta ?? '').trim().length === 0
        const voucherVacio = (voucher ?? '').trim().length === 0
        fc.pre(boletaVacia || voucherVacio)
        const r = resolverArchivos({
          boletaActual: boleta,
          voucherActual: voucher,
          swap: true,
        })
        expect(r.errores).toContain('Ambos archivos deben existir para intercambiarse.')
        expect(r.boletaFinal).toBe(boleta ?? '')
        expect(r.voucherFinal).toBe(voucher ?? '')
        expect(r.boletaReemplazada).toBe(false)
        expect(r.voucherReemplazada).toBe(false)
      }),
      { numRuns: 100 },
    )
  })

  // Feature: editar-pago-registrado, Property 15: Construcción del registro de auditoría
  it('Property 15: construirAuditoria produce accion, admin, target_id y detalle coherentes con las flags', () => {
    fc.assert(
      fc.property(
        fc.boolean(),
        fc.boolean(),
        fc.boolean(),
        fc.string({ minLength: 1, maxLength: 12 }),
        fc.string({ minLength: 1, maxLength: 12 }),
        fc.emailAddress(),
        (swap, boletaReemplazada, voucherReemplazada, installmentId, adminId, email) => {
          const input = inputValidoBase({ installment_id: installmentId })
          const flags: OperacionFlags = { swap, boletaReemplazada, voucherReemplazada }
          const admin: AdminIdentidad = { id: adminId, email }
          const reg = construirAuditoria(input, flags, admin)
          expect(reg.accion).toBe(AUDIT_ACCION_EDITAR_PAGO)
          expect(reg.admin_id).toBe(adminId)
          expect(reg.admin_email).toBe(email)
          expect(reg.target_id).toBe(installmentId)
          expect(reg.detalle.installment_id).toBe(installmentId)
          expect(reg.detalle.swap).toBe(swap)
          expect(reg.detalle.boleta_reemplazada).toBe(boletaReemplazada)
          expect(reg.detalle.voucher_reemplazado).toBe(voucherReemplazada)
        },
      ),
      { numRuns: 100 },
    )
  })

  // Feature: editar-pago-registrado, Property 16: El visor divide por coma y asigna el tipo correcto
  it('Property 16: parsearVisor da un elemento por URL no vacía, pdf->pdf e imagen->img, en orden', () => {
    const urlPdf = nombreArchivo.map((n) => ({ url: `https://f.example.com/${n}.pdf`, tipo: 'pdf' as const }))
    const urlImg = fc
      .constantFrom('jpg', 'jpeg', 'png', 'gif', 'webp')
      .chain((ext) => nombreArchivo.map((n) => ({ url: `https://f.example.com/${n}.${ext}`, tipo: 'img' as const })))
    fc.assert(
      fc.property(fc.array(fc.oneof(urlPdf, urlImg), { minLength: 1, maxLength: 10 }), (items) => {
        const valor = items.map((i) => i.url).join(',')
        const parsed = parsearVisor(valor)
        expect(parsed.length).toBe(items.length)
        for (let i = 0; i < items.length; i++) {
          expect(parsed[i].url).toBe(items[i].url)
          expect(parsed[i].tipo).toBe(items[i].tipo)
        }
      }),
      { numRuns: 100 },
    )
    // Las URLs vacías (entre comas) se descartan, conservando el orden del resto.
    fc.assert(
      fc.property(fc.array(urlValida, { minLength: 1, maxLength: 5 }), (urls) => {
        const valor = urls.join(',,') // comas dobles => segmentos vacíos intercalados
        const parsed = parsearVisor(valor)
        expect(parsed.map((p) => p.url)).toEqual(urls)
      }),
      { numRuns: 100 },
    )
  })
})
