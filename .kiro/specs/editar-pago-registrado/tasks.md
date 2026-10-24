# Implementation Plan: Editar Pago Registrado

## Overview

Este plan implementa la edición completa de un pago ya registrado (`status = paid`) en el
sistema de pagos (Next.js 15 + TypeScript). El enfoque sigue el diseño:

1. Extraer toda la lógica pura (validación, resolución de archivos/intercambio, auditoría y
   parser del visor) a un módulo testeable `src/lib/editar-pago.ts`.
2. Verificar esa lógica con tests property-based (`fast-check` + Vitest) para las 16 correctness
   properties del diseño.
3. Añadir la acción `update-pago-completo` al handler `POST /api/admin/payments`, orquestando las
   funciones puras con las escrituras a `installments`, `payment_vouchers` e `historial_auditoria`,
   incluyendo la reversión best-effort del intercambio.
4. Cubrir autenticación, I/O y casos de error con tests por ejemplo/integración (mocks de Supabase).
5. Añadir el modal "Editar registro completo" en `src/app/dashboard/pagos-alumno/page.tsx`.
6. Verificar con `npx tsc --noEmit` y `npm run build`.

No se requieren migraciones SQL: no hay columnas ni tablas nuevas, solo se operan columnas existentes.

Cada tarea construye sobre las anteriores y termina integrándose; no queda código huérfano.

## Tasks

- [x] 1. Crear el módulo de lógica pura `src/lib/editar-pago.ts`
  - [x] 1.1 Definir tipos e interfaces del módulo
    - Crear `src/lib/editar-pago.ts` con los tipos de entrada (`EditarPagoInput`), estado de la cuota/voucher (`EstadoPago`), identidad del admin, resultado de resolución de archivos y comandos de escritura (`ComandoEscritura`).
    - Definir el tipo del elemento del visor `{ url: string; tipo: "pdf" | "img" }`.
    - _Requirements: 4.1, 5.1, 5.2, 7.1_

  - [x] 1.2 Implementar `validarCamposComprobante`, `validarMonto` y `validarFecha`
    - `validarCamposComprobante(input)`: rechaza `comprobante_serie`/`comprobante_numero` vacíos, solo-espacios o > 20 chars, y `tipo_comprobante` vacío/solo-espacios; retorna mensaje de error específico o `null`.
    - `validarMonto(amount)`: acepta `[0, 999999999.99]`, rechaza fuera de rango.
    - `validarFecha(fecha, now)`: rechaza fechas no parseables o posteriores al `now` inyectado; acepta fechas válidas ≤ `now`.
    - _Requirements: 4.2, 4.3, 4.5, 4.4, 4.6_

  - [x] 1.3 Implementar `validarArchivoUrls`
    - Divide por coma, acepta 1–10 URLs, longitud total ≤ 2000 chars y cada elemento con formato PDF o imagen; rechaza (con mensaje) si excede cantidad/longitud o incluye un formato no permitido.
    - _Requirements: 5.1, 5.2, 5.8_

  - [x] 1.4 Implementar `resolverArchivos`
    - `resolverArchivos({ boletaActual, voucherActual, comprobanteUrl, voucherUrl, swap })` → `{ boletaFinal, voucherFinal, errores, boletaReemplazada, voucherReemplazada }`.
    - Modo swap: exige ambos actuales no vacíos (precondición), intercambia boleta ↔ voucher e ignora los reemplazos; el intercambio es involutivo y conserva el conjunto `{boleta, voucher}`.
    - Modo reemplazo: aplica `comprobante_url`/`voucher_url` cuando vienen (validando formato), conserva actuales cuando no vienen.
    - Valida no-vacío de los valores finales (boleta y voucher) y reporta error sin producir cambios si alguno quedaría vacío.
    - _Requirements: 5.1, 5.2, 5.4, 5.5, 5.6, 5.7, 6.2, 6.3_

  - [x] 1.5 Implementar `planificarEscrituras`
    - `planificarEscrituras(estado, input)` → lista de comandos de escritura (update `installments`, update/insert `payment_vouchers`); retorna lista vacía si hay errores de validación (sin escrituras parciales).
    - Incluye el `insert` de `payment_vouchers` (con `status = approved`, `reviewed_by`, `reviewed_at` UTC) cuando se asigna un voucher y no existe Voucher_Registro.
    - Garantiza que una edición exitosa nunca emite un cambio de `status` (se conserva `paid`).
    - _Requirements: 4.1, 4.8, 4.9, 5.3_

  - [x] 1.6 Implementar `construirAuditoria` y `parsearVisor`
    - `construirAuditoria(input, { swap, boletaReemplazada, voucherReemplazada }, admin)` → registro con `accion = "editar_pago_completo"`, `admin_id`/`admin_email`, `target_id = installment_id` y `detalle` con `installment_id`, swap y reemplazos.
    - `parsearVisor(valor)` → un elemento por URL no vacía, `tipo: "pdf"` para PDF y `"img"` para imagen, conservando el orden.
    - _Requirements: 7.1, 7.2, 3.3_

- [x] 2. Escribir property-based tests para la lógica pura
  - [x]* 2.1 Property 1 — guard de estado solo admite pagos registrados
    - **Property 1: El guard de estado solo admite pagos registrados**
    - **Validates: Requirements 2.2**
    - `// Feature: editar-pago-registrado, Property 1: ...`, `numRuns >= 100` en `src/lib/__tests__/editar-pago.property.test.ts`.

  - [x]* 2.2 Property 2 — validación de serie, número y tipo
    - **Property 2: Validación de campos de comprobante (serie, número, tipo)**
    - **Validates: Requirements 4.2, 4.3, 4.5**

  - [x]* 2.3 Property 3 — validación de rango de monto
    - **Property 3: Validación de rango de monto**
    - **Validates: Requirements 4.4**

  - [x]* 2.4 Property 4 — validación de fecha de pago
    - **Property 4: Validación de fecha de pago**
    - **Validates: Requirements 4.6**

  - [x]* 2.5 Property 5 — round-trip de los campos editados
    - **Property 5: Round-trip de los campos editados**
    - **Validates: Requirements 4.1**

  - [x]* 2.6 Property 6 — conservación del estado pagado
    - **Property 6: Conservación del estado pagado**
    - **Validates: Requirements 4.9**

  - [x]* 2.7 Property 7 — validación de archivos (formato, cantidad y longitud)
    - **Property 7: Validación de archivos (formato, cantidad y longitud)**
    - **Validates: Requirements 5.1, 5.2, 5.8**

  - [x]* 2.8 Property 8 — creación de Voucher_Registro cuando no existe
    - **Property 8: Creación de Voucher_Registro cuando no existe**
    - **Validates: Requirements 5.3**

  - [x]* 2.9 Property 9 — conservación cuando no se envían archivos
    - **Property 9: Conservación cuando no se envían archivos**
    - **Validates: Requirements 5.4**

  - [x]* 2.10 Property 10 — invariante de no-vacío tras edición exitosa
    - **Property 10: Invariante de no-vacío tras edición exitosa**
    - **Validates: Requirements 5.5**

  - [x]* 2.11 Property 11 — rechazo cuando el resultado dejaría un archivo vacío
    - **Property 11: Rechazo cuando el resultado dejaría un archivo vacío**
    - **Validates: Requirements 5.6, 5.7**

  - [x]* 2.12 Property 12 — entrada inválida no produce escrituras parciales
    - **Property 12: Entrada inválida no produce escrituras parciales**
    - **Validates: Requirements 4.8**

  - [x]* 2.13 Property 13 — el intercambio es involutivo y no pierde archivos
    - **Property 13: El intercambio es involutivo y no pierde archivos**
    - **Validates: Requirements 6.2**
    - Aplicar `resolverArchivos` dos veces y comprobar igualdad con el estado original; verificar preservación del conjunto `{boleta, voucher}`.

  - [x]* 2.14 Property 14 — precondición del intercambio
    - **Property 14: Precondición del intercambio**
    - **Validates: Requirements 6.3**

  - [x]* 2.15 Property 15 — construcción del registro de auditoría
    - **Property 15: Construcción del registro de auditoría**
    - **Validates: Requirements 7.1, 7.2**

  - [x]* 2.16 Property 16 — el visor divide por coma y asigna el tipo correcto
    - **Property 16: El visor divide por coma y asigna el tipo correcto**
    - **Validates: Requirements 3.3**

- [x] 3. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Añadir la acción `update-pago-completo` en el route handler
  - [x] 4.1 Añadir el bloque de la acción y orquestar validación + lectura de estado
    - En `src/app/api/admin/payments/route.ts`, añadir el bloque `if (action === "update-pago-completo")` antes del return de "Acción no reconocida", reutilizando `verifyAdmin`.
    - Validar el body con las funciones puras (400 sin tocar datos si falla); leer la Cuota con join `payment_plans!inner(alumno_id)` (404 si no existe, 400 si `status !== "paid"`); leer el Voucher_Registro asociado.
    - _Requirements: 1.1, 1.2, 1.3, 2.1, 2.2, 4.7_

  - [x] 4.2 Orquestar resolución de archivos y persistencia con reversión best-effort
    - Invocar `resolverArchivos` y `planificarEscrituras`; ejecutar `update` en `installments` y `update`/`insert` en `payment_vouchers` en el orden del diseño.
    - Intercambio: escribir primero `installments.comprobante_url`, luego `payment_vouchers.voucher_url`; si la segunda escritura falla, revertir la primera (best-effort) y responder 500; si la reversión falla, 500 marcando estado inconsistente.
    - Insertar en `historial_auditoria` vía `construirAuditoria`; responder 200 con el payload de éxito.
    - _Requirements: 4.1, 4.9, 5.1, 5.2, 5.3, 5.4, 6.2, 6.3, 6.4, 7.1, 7.2, 8.1, 8.2_

  - [ ]* 4.3 Tests por ejemplo/integración del route handler
    - Mocks de `supabase`/`supabaseAdmin`: token ausente/no-admin → 403; cuota inexistente → 404; cuota `status != paid` → 400; fallo de la segunda escritura del swap → reversión de la primera + 500.
    - _Requirements: 1.1, 1.2, 2.1, 2.2, 6.4, 8.2_

- [x] 5. Añadir el modal "Editar registro completo" en el panel
  - [x] 5.1 Añadir estado, botón de apertura y precarga de campos
    - En `src/app/dashboard/pagos-alumno/page.tsx`, añadir estado `editRegistroModal`/`editForm`/`editSaving`/`editError` siguiendo el patrón de los modales existentes.
    - Renderizar el botón "Editar registro completo" junto al de editar fecha, visible solo si `inst.status === "paid"`; al abrir, precargar `tipo_comprobante`, `comprobante_serie`, `comprobante_numero`, `amount`, `fecha_pago`, `nota_contabilidad`, `comprobante_url` y el `voucher_url` del voucher asociado.
    - _Requirements: 2.3, 3.1, 3.2_

  - [x] 5.2 Añadir visor de archivos, toggle de intercambio y guardado/cancelar
    - Visor de boleta y voucher actuales: `split(",")` por coma, `<embed>` para PDF e `<img>` para imágenes.
    - Toggle "Intercambiar archivos cruzados": cuando está activo deshabilita los inputs de reemplazo; al éxito los rehabilita y muestra confirmación.
    - Guardar: `fetch` a `/api/admin/payments` con `Authorization: Bearer ${await getToken()}` y `action: "update-pago-completo"`; errores (no-200) mostrados dentro del modal manteniéndolo abierto; cancelar cierra el modal.
    - _Requirements: 3.3, 6.1, 6.5, 6.6, 8.3_

  - [ ]* 5.3 Tests por ejemplo del componente del panel
    - Botón visible solo si `paid`; precarga de campos; toggle que deshabilita inputs de reemplazo; rehabilitación y confirmación tras éxito; persistencia del modal abierto ante error.
    - _Requirements: 2.3, 3.1, 3.2, 6.5, 6.6, 8.3_

- [x] 6. Checkpoint final — verificación de tipos y build
  - [x] 6.1 Ejecutar verificación de tipos y build
    - Ejecutar `npx tsc --noEmit` y `npm run build`; corregir cualquier error de tipos o de compilación hasta que ambos pasen.
    - Ensure all tests pass, ask the user if questions arise.

## Notes

- Las tareas marcadas con `*` son opcionales (tests) y pueden omitirse para un MVP más rápido; el resto son implementación central y deben ejecutarse.
- Cada tarea referencia los requirements que cubre para trazabilidad.
- No hay migraciones SQL: solo se operan columnas existentes de `installments`, `payment_vouchers` e `historial_auditoria`.
- Los property tests (tarea 2) validan la lógica pura; los tests por ejemplo/integración (4.3, 5.3) cubren autenticación, I/O y UI.
- `src/lib/editar-pago.ts` y `src/lib/__tests__/editar-pago.property.test.ts` son archivos nuevos; `route.ts` y `pagos-alumno/page.tsx` se modifican.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "1.3", "1.6"] },
    { "id": 2, "tasks": ["1.4"] },
    { "id": 3, "tasks": ["1.5"] },
    { "id": 4, "tasks": ["2.1", "2.2", "2.3", "2.4", "2.5", "2.6", "2.7", "2.8", "2.9", "2.10", "2.11", "2.12", "2.13", "2.14", "2.15", "2.16"] },
    { "id": 5, "tasks": ["4.1"] },
    { "id": 6, "tasks": ["4.2"] },
    { "id": 7, "tasks": ["4.3", "5.1"] },
    { "id": 8, "tasks": ["5.2"] },
    { "id": 9, "tasks": ["5.3", "6.1"] }
  ]
}
```
