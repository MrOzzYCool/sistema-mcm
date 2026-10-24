# Documento de Diseño

## Overview

Esta feature añade al administrador la capacidad de **corregir por completo un pago ya registrado** (`status = paid`), algo que hoy no es posible: tras registrar el pago solo se puede editar la fecha de emisión y la nota de contabilidad.

El problema operativo más grave es el **cruce de archivos**: la boleta termina cargada en el campo del voucher y el voucher en el campo de la boleta. Como la boleta vive en `installments.comprobante_url` y el voucher en `payment_vouchers.voucher_url`, intercambiarlos implica mover valores entre dos tablas distintas.

La solución reutiliza la infraestructura existente sin introducir dependencias nuevas:

- **Backend:** una nueva acción `action === "update-pago-completo"` dentro del handler `POST /api/admin/payments` (`src/app/api/admin/payments/route.ts`), siguiendo el patrón switch-por-acción ya establecido y la autenticación `verifyAdmin`.
- **Frontend:** un nuevo modal "Editar registro completo" en `src/app/dashboard/pagos-alumno/page.tsx`, que precarga todos los campos del pago, muestra los archivos actuales de boleta y voucher, permite reemplazarlos y ofrece un toggle para intercambiarlos.

Decisiones de alcance confirmadas que este diseño respeta:

1. La boleta/factura mantiene los campos actuales (`tipo_comprobante`, `comprobante_serie`, `comprobante_numero`). **No** se añade RUC ni otros campos nuevos.
2. El Intercambio_Archivos **solo** intercambia los archivos (`comprobante_url` ↔ `voucher_url`). **No** intercambia el `tipo_comprobante`; este se edita de forma independiente por su propio campo.

## Architecture

### Encaje en el sistema actual

```mermaid
flowchart TD
    A[Panel_Pagos - pagos-alumno/page.tsx] -->|Botón "Editar registro completo"| B[Modal EditarRegistroCompleto]
    B -->|fetch POST Bearer token| C[route.ts - POST /api/admin/payments]
    C --> D{action switch}
    D -->|update-pago-completo| E[verifyAdmin]
    E -->|403 si falla| B
    E -->|ok| F[Validaciones del body]
    F -->|400 si falla| B
    F -->|ok| G[Leer installment + payment_vouchers]
    G -->|404 si no existe / 400 si no paid| B
    G --> H{swap_archivos?}
    H -->|sí| I[Intercambiar comprobante_url ↔ voucher_url]
    H -->|no| J[Aplicar reemplazos / dejar actuales]
    I --> K[Validar boleta y voucher no vacíos finales]
    J --> K
    K --> L[Update installments + upsert payment_vouchers]
    L --> M[Insert historial_auditoria]
    M -->|200 success| B
```

### Flujo backend (nueva acción)

La acción se añade como un bloque `if (action === "update-pago-completo") { ... }` dentro del `POST` existente, antes del `return` final de "Acción no reconocida". Reutiliza:

- `verifyAdmin(req)` — ya invocado al inicio del `POST`; cubre los criterios 1.1, 1.2, 4.7.
- `supabaseAdmin` (service role) para todas las lecturas/escrituras.
- El patrón de join `installments -> payment_plans!inner(alumno_id)` empleado en `manual-comprobante` para resolver `alumno_id` cuando hay que crear el voucher.
- `historial_auditoria` para la traza.

La lógica pesada (validación, resolución del swap y persistencia) se extrae a funciones puras testeables en `src/lib/` (ver Testing Strategy), de modo que las propiedades de correctitud se puedan verificar sin tocar Supabase.

### Flujo frontend (nuevo modal)

Se añade al componente `PagosAlumnoContent` un bloque de estado análogo a los modales existentes (`manualModal`, `fechaModal`, `notaModal`):

- Estado `editRegistroModal` con `show`, `installmentId`, datos precargados y el voucher asociado.
- El botón "Editar registro completo" se renderiza junto al botón de editar fecha, solo cuando `inst.status === "paid"` (criterio 2.3).
- Al abrir, se cargan `tipo_comprobante`, `comprobante_serie`, `comprobante_numero`, `amount`, `fecha_pago`, `nota_contabilidad`, `comprobante_url` y el `voucher_url` del voucher asociado (obtenido en el `GET` de planes o en una consulta puntual).
- El guardado hace `fetch` a `/api/admin/payments` con `Authorization: Bearer ${await getToken()}` y `action: "update-pago-completo"`.
- Los errores (no-200) se muestran dentro del modal y el modal permanece abierto (criterio 8.3).

## Components and Interfaces

### Backend — `update-pago-completo`

**Ubicación:** nuevo bloque en `POST` de `src/app/api/admin/payments/route.ts`.

**Contrato del Request (body JSON):**

| Campo | Tipo | Obligatorio | Descripción |
|-------|------|-------------|-------------|
| `action` | `"update-pago-completo"` | sí | Discriminador de la acción. |
| `installment_id` | `string` | sí | ID de la Cuota (`status` debe ser `paid`). |
| `tipo_comprobante` | `string` | sí | Tipo del comprobante (p. ej. `boleta`, `factura`). No vacío. |
| `comprobante_serie` | `string` | sí | Serie. No vacía, ≤ 20 caracteres. |
| `comprobante_numero` | `string` | sí | Número. No vacío, ≤ 20 caracteres. |
| `amount` | `number` | sí | Monto. `0 ≤ amount ≤ 999,999,999.99`. |
| `fecha_pago` | `string` (ISO) | sí | Fecha de pago válida, no posterior a `now()` del servidor. |
| `nota_contabilidad` | `string \| null` | no | Nota libre. |
| `comprobante_url` | `string` | no | Nuevo Archivo_Boleta. 1–10 URLs separadas por coma, ≤ 2000 chars, solo PDF/imagen. |
| `voucher_url` | `string` | no | Nuevo Archivo_Voucher. Mismas reglas de formato. |
| `swap_archivos` | `boolean` | no (default `false`) | Si `true`, intercambia boleta ↔ voucher actuales e ignora `comprobante_url`/`voucher_url`. |

**Contrato del Response:**

- `200`: `{ success: true, message: string, swap: boolean, boleta_reemplazada: boolean, voucher_reemplazado: boolean }`
- `400`: `{ error: string }` — validación fallida (serie/número/tipo/monto/fecha/formato de archivos/swap con archivo vacío/resultado final vacío).
- `403`: `{ error: "No autorizado" }` — no es el administrador (ya cubierto por `verifyAdmin`).
- `404`: `{ error: "Cuota no encontrada" }` — `installment_id` inexistente.
- `500`: `{ error: string }` — fallo al persistir en `installments` o `payment_vouchers`.

**Orden de operaciones dentro de la acción:**

1. `verifyAdmin` (ya hecho a nivel de `POST`).
2. Validar formato del body (campos obligatorios, longitudes, rango de monto, fecha). Si falla → `400` sin tocar datos.
3. Leer la Cuota: `installments.select("*, payment_plans!inner(alumno_id)").eq("id", installment_id).maybeSingle()`.
   - Si no existe → `404`.
   - Si `status !== "paid"` → `400` (solo pagos registrados).
4. Leer el Voucher_Registro asociado: `payment_vouchers.select("*").eq("installment_id", installment_id)` (tomar el más reciente/relevante).
5. Resolver los valores finales de `comprobante_url` y `voucher_url` (ver "Lógica del intercambio").
6. Validar que boleta y voucher finales sean no vacíos (criterios 5.5–5.7). Si falla → `400` sin escribir nada.
7. Persistir: `update` en `installments` y `update`/`insert` en `payment_vouchers`.
8. Insert en `historial_auditoria`.
9. Responder `200`.

### Frontend — Modal "Editar registro completo"

Estado (siguiendo el patrón de los modales existentes):

```ts
const [editRegistroModal, setEditRegistroModal] = useState<{
  show: boolean;
  installmentId: string;
  concepto: string;
}>({ show: false, installmentId: "", concepto: "" });

const [editForm, setEditForm] = useState({
  tipo: "boleta",
  serie: "",
  numero: "",
  amount: "",
  fecha: "",
  nota: "",
  comprobanteUrl: "",   // valor actual / reemplazo de boleta
  voucherUrl: "",       // valor actual / reemplazo de voucher
  swap: false,          // toggle de intercambio
});
const [editSaving, setEditSaving] = useState(false);
const [editError, setEditError] = useState("");
```

Elementos de UI:

- Inputs de `tipo_comprobante`, `comprobante_serie`, `comprobante_numero`, `amount`, `fecha_pago`, `nota_contabilidad`, precargados.
- **Visor de boleta y voucher actuales:** reutiliza el patrón existente de `split(",")` por coma, con `<embed>` para PDF y `<img>` para imágenes.
- **Toggle "Intercambiar archivos cruzados"** (`swap`): cuando está activo, deshabilita los inputs de reemplazo de boleta y voucher (criterio 6.5). Al completarse con éxito, se rehabilitan y se muestra confirmación (criterio 6.6).
- Botones **Guardar** y **Cancelar**.
- Área de error que se muestra manteniendo el modal abierto (criterio 8.3).

## Data Models

No se crean tablas ni columnas nuevas. Se operan las columnas existentes:

### `installments` (Cuota)

| Columna | Uso en esta feature |
|---------|---------------------|
| `status` | Debe ser `paid` para editar; se conserva `paid` tras la edición. |
| `fecha_pago` | Editable (fecha válida ≤ now). |
| `tipo_comprobante` | Editable (no vacío). |
| `comprobante_serie` | Editable (no vacío, ≤ 20). |
| `comprobante_numero` | Editable (no vacío, ≤ 20; se guarda como `String`). |
| `comprobante_url` | Archivo_Boleta. Reemplazable o intercambiable. |
| `amount` | Editable (0–999,999,999.99). |
| `nota_contabilidad` | Editable (opcional). |

### `payment_vouchers` (Voucher_Registro)

| Columna | Uso en esta feature |
|---------|---------------------|
| `installment_id` | Liga el voucher a la Cuota. |
| `alumno_id` | Necesario al crear un voucher nuevo (resuelto vía join `payment_plans!inner(alumno_id)`). |
| `voucher_url` | Archivo_Voucher. Reemplazable o intercambiable. |
| `status` | Al crear uno nuevo se fija `approved`. |
| `tipo_comprobante` | Se mantiene; no se intercambia. |
| `reviewed_by` | Al crear se fija al `admin.id`. |
| `reviewed_at` | Al crear se fija a la fecha/hora UTC de la operación. |

### `historial_auditoria`

| Columna | Valor |
|---------|-------|
| `accion` | `"editar_pago_completo"` |
| `admin_id` | `admin.id` |
| `admin_email` | `admin.email` |
| `target_id` | `installment_id` |
| `detalle` (jsonb) | `{ installment_id, swap, boleta_reemplazada, voucher_reemplazado }` |

### Lógica del intercambio (Intercambio_Archivos)

El intercambio es la pieza más delicada porque toca dos tablas y Supabase **no ofrece transacción multi-tabla desde el cliente**. La lógica:

1. Leer `comprobante_url` actual de `installments` (boletaPrev) y `voucher_url` actual del `payment_vouchers` asociado (voucherPrev).
2. **Precondición (criterio 6.3):** si `boletaPrev` o `voucherPrev` está vacío → `400` sin modificar nada ("ambos archivos deben existir para intercambiarse").
3. Asignar `comprobante_url = voucherPrev` y `voucher_url = boletaPrev`.
4. **Caso sin voucher existente:** si la Cuota no tiene `payment_vouchers`, no puede haber intercambio válido porque `voucherPrev` estaría vacío → cae en el `400` del paso 2. (La creación de voucher aplica al reemplazo, no al swap.)
5. **Persistencia secuencial con reversión best-effort (criterio 6.4):** como no hay transacción atómica:
   - Escribir primero `installments.comprobante_url`.
   - Luego `payment_vouchers.voucher_url`.
   - Si la **segunda** escritura falla, revertir la primera restaurando `installments.comprobante_url = boletaPrev` (reversión manual best-effort) y responder `500` con mensaje de que el intercambio no se completó.
   - Si la reversión también falla, responder `500` registrando el estado inconsistente en el mensaje de error para intervención manual.

> **Nota de diseño:** se documenta explícitamente que la atomicidad es best-effort. Una alternativa 100% atómica sería una función RPC/`plpgsql` en Postgres (`SECURITY DEFINER`) que haga ambos updates en una transacción. Se descarta en esta feature para no ampliar el alcance ni introducir migraciones; el riesgo residual se mitiga con la reversión secuencial y la traza de auditoría.

### Reemplazo vs. intercambio (mutuamente excluyentes)

- Si `swap_archivos === true`: se ejecuta la lógica de intercambio y se ignoran `comprobante_url`/`voucher_url` del body. El frontend además deshabilita esos inputs (criterio 6.5).
- Si `swap_archivos !== true`:
  - Si viene `comprobante_url` → reemplaza boleta (validando formato).
  - Si viene `voucher_url` → reemplaza voucher (validando formato); si no hay Voucher_Registro, se **crea** uno con `status = approved`, `reviewed_by = admin.id`, `reviewed_at = now()` (criterio 5.3).
  - Si no viene ninguno → se conservan los valores actuales (criterio 5.4).

## Correctness Properties

*Una propiedad es una característica o comportamiento que debe cumplirse en todas las ejecuciones válidas del sistema: es un enunciado formal sobre lo que el sistema debe hacer. Las propiedades son el puente entre las especificaciones legibles por humanos y las garantías de correctitud verificables por máquina.*

Estas propiedades aplican a la **capa de lógica pura** extraída de la acción (validación, resolución de archivos/intercambio y construcción del registro de auditoría), que es donde el comportamiento varía de forma significativa con la entrada. Los caminos de autenticación, I/O y renderizado UI se cubren con ejemplos/integración (ver Testing Strategy).

### Property 1: El guard de estado solo admite pagos registrados

*Para toda* Cuota cuyo `status` sea distinto de `paid`, la Accion_Editar_Pago SHALL ser rechazada (400) sin emitir ninguna escritura.

**Validates: Requirements 2.2**

### Property 2: Validación de campos de comprobante (serie, número, tipo)

*Para toda* cadena que esté vacía, compuesta solo por espacios o que exceda 20 caracteres (en el caso de `comprobante_serie` y `comprobante_numero`) o que esté vacía/solo-espacios (en el caso de `tipo_comprobante`), la validación SHALL rechazar la operación (400); y *para toda* combinación de serie, número y tipo no vacíos y de longitud válida, la validación de estos campos SHALL pasar.

**Validates: Requirements 4.2, 4.3, 4.5**

### Property 3: Validación de rango de monto

*Para todo* número menor que 0 o mayor que 999,999,999.99, la validación SHALL rechazar la operación (400); y *para todo* número dentro de `[0, 999999999.99]`, la validación de monto SHALL pasar.

**Validates: Requirements 4.4**

### Property 4: Validación de fecha de pago

*Para toda* `fecha_pago` no parseable o posterior al `now()` inyectado del servidor, la validación SHALL rechazar la operación (400); y *para toda* fecha válida anterior o igual a `now()`, la validación de fecha SHALL pasar.

**Validates: Requirements 4.6**

### Property 5: Round-trip de los campos editados

*Para todo* conjunto de campos de entrada válidos, el objeto de actualización construido para `installments` SHALL contener exactamente los valores enviados de `tipo_comprobante`, `comprobante_serie`, `comprobante_numero`, `amount`, `fecha_pago` y `nota_contabilidad`.

**Validates: Requirements 4.1**

### Property 6: Conservación del estado pagado

*Para toda* edición exitosa sobre una Cuota con `status = paid`, el estado resultante SHALL seguir siendo `paid` (la operación nunca emite un cambio de `status`).

**Validates: Requirements 4.9**

### Property 7: Validación de archivos (formato, cantidad y longitud)

*Para toda* cadena de Archivo_Boleta o Archivo_Voucher que contenga entre 1 y 10 URLs separadas por coma, con longitud total ≤ 2000 caracteres y en la que cada elemento apunte a un PDF o a una imagen, el validador de archivos SHALL aceptarla; y *para toda* cadena con más de 10 URLs, longitud total > 2000 caracteres o algún elemento de formato distinto de PDF/imagen, el validador SHALL rechazarla (400) sin modificar los valores actuales.

**Validates: Requirements 5.1, 5.2, 5.8**

### Property 8: Creación de Voucher_Registro cuando no existe

*Para toda* operación que asigne un Archivo_Voucher válido a una Cuota que no tiene Voucher_Registro asociado, el plan de escritura SHALL incluir un `insert` en `payment_vouchers` con `installment_id` y `alumno_id` de la Cuota, el `voucher_url` enviado, `status = approved`, `reviewed_by` igual al identificador del Administrador y `reviewed_at` igual a la fecha/hora UTC de la operación.

**Validates: Requirements 5.3**

### Property 9: Conservación cuando no se envían archivos

*Para todo* par (Archivo_Boleta actual, Archivo_Voucher actual) cuando la operación no envía ni `comprobante_url` ni `voucher_url` y `swap_archivos` es falso, los valores finales de boleta y voucher SHALL ser idénticos a los actuales.

**Validates: Requirements 5.4**

### Property 10: Invariante de no-vacío tras edición exitosa

*Para toda* operación que supere todas las validaciones, los valores finales de Archivo_Boleta y Archivo_Voucher SHALL ser cadenas no vacías (al menos un carácter distinto de espacio tras `trim`).

**Validates: Requirements 5.5**

### Property 11: Rechazo cuando el resultado dejaría un archivo vacío

*Para toda* operación cuyo resultado dejaría el Archivo_Boleta o el Archivo_Voucher vacío o compuesto solo por espacios, la operación SHALL ser rechazada (400) sin modificar ninguno de los valores actuales.

**Validates: Requirements 5.6, 5.7**

### Property 12: Entrada inválida no produce escrituras parciales

*Para toda* entrada que falle cualquier validación, el planificador de escrituras SHALL producir cero comandos de escritura (ninguna tabla se modifica), ya que toda la validación precede a la persistencia.

**Validates: Requirements 4.8**

### Property 13: El intercambio es involutivo y no pierde archivos

*Para todo* par (Archivo_Boleta, Archivo_Voucher) ambos no vacíos, aplicar el Intercambio_Archivos SHALL producir boleta = voucher previo y voucher = boleta previa; aplicarlo dos veces SHALL devolver el par original (involución); y el conjunto de archivos `{boleta, voucher}` SHALL conservarse íntegro (ningún archivo se pierde ni se duplica).

**Validates: Requirements 6.2**

### Property 14: Precondición del intercambio

*Para todo* par en el que el Archivo_Boleta o el Archivo_Voucher esté vacío, la instrucción de Intercambio_Archivos SHALL ser rechazada (400) sin modificar ninguno de los dos valores.

**Validates: Requirements 6.3**

### Property 15: Construcción del registro de auditoría

*Para toda* edición exitosa, el registro de Historial_Auditoria construido SHALL tener `accion = "editar_pago_completo"`, `admin_id`/`admin_email` del Administrador, `target_id` igual al `installment_id`, y un `detalle` que incluya `installment_id`, la indicación de si se realizó Intercambio_Archivos y la indicación de si se reemplazó Archivo_Boleta y/o Archivo_Voucher, coherentes con la operación realizada.

**Validates: Requirements 7.1, 7.2**

### Property 16: El visor divide por coma y asigna el tipo correcto

*Para toda* cadena de URLs separadas por coma (PDF o imagen), el parser del visor SHALL producir un elemento de visualización por cada URL no vacía, asignando `<embed>` a cada PDF y `<img>` a cada imagen, conservando el orden.

**Validates: Requirements 3.3**

## Error Handling

| Situación | Código | Comportamiento |
|-----------|--------|----------------|
| Sin token / token inválido | 403 | `verifyAdmin` retorna `null`; respuesta `{ error: "No autorizado" }`. Ninguna escritura. |
| Email distinto de admin | 403 | Igual que arriba. |
| `installment_id` inexistente | 404 | `{ error: "Cuota no encontrada" }`. |
| Cuota con `status != paid` | 400 | `{ error: "Solo se pueden editar pagos ya registrados." }`. |
| Serie/número/tipo inválidos | 400 | Mensaje específico por campo. Sin escrituras. |
| Monto fuera de rango | 400 | `{ error: "El monto debe estar entre 0 y 999,999,999.99." }`. |
| Fecha inválida o futura | 400 | `{ error: "La fecha de pago es inválida." }`. |
| Archivo con formato/cantidad/longitud inválidos | 400 | `{ error: "El archivo enviado no cumple el formato o los límites permitidos." }`. Sin escrituras. |
| Resultado dejaría boleta/voucher vacío | 400 | `{ error: "La boleta es obligatoria." }` / `{ error: "El voucher es obligatorio." }`. Sin escrituras. |
| Swap con algún archivo vacío | 400 | `{ error: "Ambos archivos deben existir para intercambiarse." }`. Sin escrituras. |
| Fallo al persistir (1.ª o 2.ª escritura) | 500 | Reversión best-effort de la primera escritura; `{ error: "El intercambio/guardado no se completó." }`. |
| Reversión también falla | 500 | Mensaje que marca estado inconsistente para intervención manual. |

**Principio transversal:** toda la validación (formato, rangos, precondiciones del swap y no-vacío del resultado) se ejecuta **antes** de cualquier escritura. Esto garantiza la ausencia de cambios parciales (criterio 4.8) para todos los errores de validación. El único punto donde puede quedar un estado intermedio es el fallo de I/O entre las dos escrituras del intercambio, mitigado con reversión secuencial best-effort y registrado para intervención manual.

En el frontend, cualquier respuesta distinta de 200 se traduce en un mensaje mostrado dentro del modal, que permanece abierto (criterio 8.3).

## Testing Strategy

El proyecto ya usa **Vitest** (`npm test` → `vitest --run`) y tiene **`fast-check`** instalado como dependencia de desarrollo, con tests existentes en `src/lib/__tests__`. La estrategia aprovecha ambos sin introducir librerías nuevas.

### Separación para testabilidad

La lógica pura se extrae de `route.ts` a un módulo nuevo, por ejemplo `src/lib/editar-pago.ts`, con funciones sin dependencias de red:

- `validarCamposComprobante(input)` → errores o `null`.
- `validarMonto(amount)`, `validarFecha(fecha, now)`.
- `validarArchivoUrls(valor)` → acepta/rechaza según formato, cantidad y longitud.
- `resolverArchivos({ boletaActual, voucherActual, comprobanteUrl, voucherUrl, swap })` → `{ boletaFinal, voucherFinal, errores }`.
- `planificarEscrituras(estado, input)` → lista de comandos de escritura (vacía si hay errores).
- `construirAuditoria(input, { swap, boletaReemplazada, voucherReemplazada }, admin)` → registro para `historial_auditoria`.
- `parsearVisor(valor)` → lista de `{ url, tipo: "pdf" | "img" }`.

El bloque `update-pago-completo` del route handler orquesta estas funciones y hace las llamadas a `supabaseAdmin`.

### Pruebas basadas en propiedades (property-based)

- Se usa **`fast-check`** con **mínimo 100 iteraciones** por propiedad (`fc.assert(fc.property(...), { numRuns: 100 })`).
- Cada test de propiedad se etiqueta con un comentario que referencia la propiedad del diseño, con el formato:
  `// Feature: editar-pago-registrado, Property {número}: {texto}`.
- Cada propiedad de la sección Correctness Properties se implementa con **un único** test de propiedad.
- Generadores clave: cadenas de URLs PDF/imagen (para 7, 13, 16), strings arbitrarios y de longitud controlada (para 2), números dentro y fuera de rango (para 3), fechas relativas a un `now` inyectado (para 4), pares (boleta, voucher) no vacíos/vacíos (para 9, 10, 11, 13, 14), y estados con/sin Voucher_Registro (para 8).
- La involución del intercambio (Property 13) se verifica aplicando `resolverArchivos` dos veces y comprobando igualdad con el estado original, además de la preservación del conjunto `{boleta, voucher}`.

### Pruebas por ejemplo e integración

Para los criterios que dependen de autenticación, I/O o UI (no aptos para PBT), se usan tests por ejemplo con mocks de `supabase`/`supabaseAdmin`:

- Autorización (1.1, 1.2, 1.3, 4.7): token ausente → 403; email no-admin → 403; admin → procesa.
- Cuota inexistente (2.1): lectura mockeada devuelve `null` → 404.
- Fallo de persistencia (6.4, 8.2): se mockea que la segunda escritura del swap falla → se invoca la reversión de la primera y responde 500.
- Render del panel (2.3, 3.1, 3.2, 6.1, 6.5, 6.6, 8.3): tests por ejemplo del componente — botón visible solo si `paid`, precarga de campos, toggle que deshabilita inputs de reemplazo, rehabilitación y confirmación tras éxito, y persistencia del modal abierto ante error.

### Balance

Las propiedades cubren la lógica de validación, intercambio, resolución de archivos y auditoría con amplia variación de entradas; los ejemplos/integración cubren puntos de integración, control de acceso y comportamiento de UI. Juntos dan cobertura completa de los criterios de aceptación.
