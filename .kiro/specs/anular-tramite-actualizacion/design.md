# Documento de Diseño

## Overview

Este diseño describe cómo añadir la capacidad de **anular** un trámite de actualización ya aprobado en el sistema I.E.S. Margarita Cabrera. La anulación marca el registro con estado `"anulado"` (sin borrarlo), exige un motivo obligatorio y registra quién anuló y cuándo. El objetivo de negocio es excluir el trámite del módulo de Contabilidad conservando el historial, cuando la boleta correspondiente ya fue anulada manualmente en Nubefact.

El cambio toca tres capas:
1. **Base de datos**: nuevas columnas de auditoría en la tabla `solicitudes`.
2. **Backend**: una acción dedicada de anulación en el endpoint `src/app/api/admin/solicitudes-ops/route.ts`.
3. **Frontend**: un botón "Anular" condicional y un modal de motivo en `src/app/dashboard/actualizacion/page.tsx`.

Lenguaje de implementación: **TypeScript** (Next.js 15 App Router + Supabase), en español.

## Architecture

### Flujo general

```
┌─────────────────────────────┐
│ UI: dashboard/actualizacion  │
│  - Botón "Anular" (solo si    │
│    estado === "aprobado")     │
│  - Modal: motivo obligatorio  │
└───────────────┬──────────────┘
                │ POST (Authorization: Bearer <token>)
                │ { action: "anular", id, motivo }
                ▼
┌─────────────────────────────────────────────┐
│ API: /api/admin/solicitudes-ops (POST)        │
│  1. verifyAdmin(req)  → 403 si no autorizado  │
│  2. validar motivo (>=3) → 400 si inválido    │
│  3. leer solicitud por id → 404 si no existe  │
│  4. validar estado === "aprobado" → 400 si no │
│  5. UPDATE estado="anulado" + auditoría        │
└───────────────┬───────────────────────────────┘
                │ supabaseAdmin.update(...)
                ▼
┌─────────────────────────────┐
│ Tabla: solicitudes            │
│  estado = "anulado"           │
│  motivo_anulacion, anulado_por,│
│  anulado_at                   │
└───────────────┬──────────────┘
                │ (lectura posterior)
                ▼
┌─────────────────────────────────────────────┐
│ API: /api/admin/contabilidad (GET)            │
│  .eq("estado","aprobado")  → el registro      │
│  anulado queda EXCLUIDO automáticamente        │
└─────────────────────────────────────────────┘
```

### Por qué "anulado" excluye de Contabilidad sin tocar Contabilidad

El endpoint `src/app/api/admin/contabilidad/route.ts` calcula los ingresos de actualizaciones con una consulta que filtra explícitamente por estado aprobado:

```ts
const { data: actualizaciones } = await supabaseAdmin
  .from("solicitudes")
  .select("*")
  .eq("tipo_formulario", "actualizacion")
  .eq("estado", "aprobado")   // ← solo suma trámites aprobados
  ...
```

Como el filtro es `estado = "aprobado"`, cualquier trámite cuyo estado pase a `"anulado"` deja de coincidir con la consulta y, por lo tanto, **desaparece automáticamente** tanto del total (`resumen.actualizaciones` y `resumen.total`) como del listado `ingresos`. **No es necesario modificar `contabilidad/route.ts`.** Esta es la razón de diseño por la que se usa un cambio de estado en lugar de un borrado o un flag separado. Lo mismo aplica a `tipo_formulario = "tramite"`, aunque el alcance de esta feature se centra en actualizaciones.

### Decisión: acción dedicada vs. reutilizar PUT

Se evaluaron dos opciones:
- **(a) Reutilizar `PUT`** enviando `estado: "anulado"` + un campo de motivo. El `PUT` actual aplica cualquier `estado` sin validar la precondición "aprobado" ni exigir motivo, por lo que reutilizarlo obligaría a añadir ramas condicionales dentro de una función ya sobrecargada y abriría la puerta a anular desde cualquier estado.
- **(b) Acción dedicada de anulación** con su propio contrato, que lee la solicitud antes de actualizar, valida la precondición y exige motivo.

**Se elige la opción (b).** Se implementa como un nuevo método `POST` en `solicitudes-ops/route.ts` con `action: "anular"`, siguiendo el mismo patrón discriminado por `action` que ya usa el `DELETE` del endpoint (`delete_one` / `delete_all`). Esto mantiene la validación de la precondición aislada y explícita.

### Decisiones de producto incorporadas

- La anulación es **definitiva** (one-way): no se expone reversión a "aprobado" desde la UI ni desde el endpoint. Una corrección por error se haría directamente en base de datos.
- El motivo es **texto libre obligatorio** con longitud mínima de 3 caracteres no vacíos.
- La anulación **no llama a Nubefact**; la boleta se anula manualmente por fuera del sistema.
- Autorización: los **mismos roles/emails** que ya usa `verifyAdmin` en `solicitudes-ops`.

## Components and Interfaces

### 1. Endpoint de anulación (backend)

Se añade un handler `POST` a `src/app/api/admin/solicitudes-ops/route.ts`, reutilizando la función `verifyAdmin` existente.

**Contrato:**

```
POST /api/admin/solicitudes-ops
Headers: Authorization: Bearer <access_token>
Body (JSON):
{
  "action": "anular",
  "id": "<uuid de la solicitud>",
  "motivo": "<texto, mínimo 3 caracteres no vacíos>"
}
```

**Respuestas:**

| Situación | Código | Cuerpo |
|---|---|---|
| Éxito | 200 | `{ "success": true, "estado": "anulado", "anulado_at": "<iso>" }` |
| Sin token / no autorizado | 403 | `{ "error": "No autorizado" }` |
| `action` desconocido | 400 | `{ "error": "Acción no soportada" }` |
| `id` faltante | 400 | `{ "error": "id requerido" }` |
| Motivo ausente o < 3 chars | 400 | `{ "error": "El motivo de anulación es obligatorio (mínimo 3 caracteres)" }` |
| Trámite inexistente | 404 | `{ "error": "El trámite no existe" }` |
| Estado actual ≠ "aprobado" | 400 | `{ "error": "Solo se pueden anular trámites en estado aprobado" }` |
| Error de base de datos | 500 | `{ "error": "<mensaje>" }` |

**Lógica (pseudocódigo del handler POST):**

```ts
export async function POST(req: NextRequest) {
  const admin = await verifyAdmin(req);
  if (!admin) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const body = await req.json();
  const { action, id, motivo } = body;

  if (action !== "anular") {
    return NextResponse.json({ error: "Acción no soportada" }, { status: 400 });
  }
  if (!id) {
    return NextResponse.json({ error: "id requerido" }, { status: 400 });
  }

  const motivoTrim = typeof motivo === "string" ? motivo.trim() : "";
  if (motivoTrim.length < 3) {
    return NextResponse.json(
      { error: "El motivo de anulación es obligatorio (mínimo 3 caracteres)" },
      { status: 400 }
    );
  }

  // Leer la solicitud ANTES de actualizar para validar la precondición
  const { data: sol, error: readErr } = await supabaseAdmin
    .from("solicitudes")
    .select("id, estado")
    .eq("id", id)
    .single();

  if (readErr || !sol) {
    return NextResponse.json({ error: "El trámite no existe" }, { status: 404 });
  }
  if (sol.estado !== "aprobado") {
    return NextResponse.json(
      { error: "Solo se pueden anular trámites en estado aprobado" },
      { status: 400 }
    );
  }

  const anuladoPor = admin.email ?? admin.id;
  const anuladoAt = new Date().toISOString();

  const { error: updErr } = await supabaseAdmin
    .from("solicitudes")
    .update({
      estado: "anulado",
      motivo_anulacion: motivoTrim,
      anulado_por: anuladoPor,
      anulado_at: anuladoAt,
    })
    .eq("id", id)
    .eq("estado", "aprobado"); // guarda de concurrencia: solo si sigue aprobado

  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });

  return NextResponse.json({ success: true, estado: "anulado", anulado_at: anuladoAt });
}
```

Nota: la cláusula `.eq("estado", "aprobado")` en el `UPDATE` es una guarda de concurrencia que evita anular si el estado cambió entre la lectura y la escritura.

### 2. Capa de servicio (frontend)

Se añade una función a `src/lib/solicitudes-service.ts`, siguiendo el patrón de `actualizarEstado` (obtiene la sesión, envía Bearer token, maneja errores):

```ts
export async function anularSolicitud(id: string, motivo: string): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token ?? "";

  const res = await fetch("/api/admin/solicitudes-ops", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ action: "anular", id, motivo }),
  });

  if (!res.ok) {
    const json = await res.json();
    throw new Error(json.error ?? `Error ${res.status}`);
  }
}
```

### 3. UI: botón y modal (frontend)

En `src/app/dashboard/actualizacion/page.tsx`:

- **Tipos de estado y badges**: se extiende el soporte de estado para incluir `"anulado"`. Dado que `ESTADO_BADGE` y `ESTADO_LABEL` están tipados como `Record<NonNullable<Estado>, string>`, debe añadirse la entrada `anulado`:
  - `ESTADO_BADGE.anulado = "badge-gray"` (o clase equivalente existente para estado neutro/inactivo).
  - `ESTADO_LABEL.anulado = "Anulado"`.
  - El tipo `Estado` proviene de `SolicitudDB["estado"]` en `src/lib/supabase.ts`; si ese tipo es una unión literal, debe incluir `"anulado"`.

- **Botón "Anular" en la celda de acciones** (dentro del bloque que ya renderiza "Aprobar", "Editar docs", "Editar monto"), condicionado a estado aprobado:

```tsx
{s.estado === "aprobado" && (
  <button onClick={() => setAnularSol(s)}
    className="flex items-center gap-1 text-xs text-red-600 hover:text-red-800 font-medium whitespace-nowrap">
    <Ban size={12} /> Anular
  </button>
)}
```

- **Estado del componente**: `const [anularSol, setAnularSol] = useState<SolicitudDB | null>(null);`

- **Modal de anulación** (`AnularModal`), siguiendo el patrón de `EditMontoModal`:
  - Campo de texto para el motivo (obligatorio).
  - Botón "Confirmar anulación" deshabilitado mientras `motivo.trim().length < 3` o mientras `saving`.
  - Al confirmar, llama a `anularSolicitud(id, motivo)`; en éxito, actualiza la fila local (`estado: "anulado"`, `observacion`/motivo) vía `onSuccess`; en error, muestra el mensaje.
  - Muestra `<Loader2 className="animate-spin" />` mientras la operación está en curso.

```tsx
{anularSol && (
  <AnularModal
    solicitud={anularSol}
    onClose={() => setAnularSol(null)}
    onSuccess={(id, motivo) => {
      setTodas((prev) => prev.map((s) =>
        s.id === id ? { ...s, estado: "anulado", motivo_anulacion: motivo } : s));
      setAnularSol(null);
    }}
  />
)}
```

- **Mostrar el motivo en filas anuladas**: en la celda de estado, cuando `s.estado === "anulado"`, mostrar el badge "Anulado" y, debajo, el `motivo_anulacion` en texto pequeño.

## Data Models

### Columnas nuevas en `solicitudes`

| Columna | Tipo | Descripción |
|---|---|---|
| `motivo_anulacion` | `text` | Motivo de la anulación (texto libre, mínimo 3 caracteres). `NULL` si no está anulado. |
| `anulado_por` | `text` | Correo o id del Usuario_Autorizado que anuló. `NULL` si no está anulado. |
| `anulado_at` | `timestamptz` | Marca de tiempo de la anulación. `NULL` si no está anulado. |

El campo `estado` existente pasa a admitir el valor `"anulado"` además de los actuales (`"pendiente"`, `"aprobado"`, `"rechazado"`, etc.). No requiere cambio de esquema en base de datos si la columna es `text` libre; sí requiere actualizar el tipo TypeScript `SolicitudDB["estado"]` para incluir `"anulado"`.

### Migración SQL

Archivo nuevo: `src/db/anular-tramite-actualizacion-schema.sql`

```sql
-- Migración: columnas de auditoría para anulación de trámites de actualización
-- Ejecutar en el editor SQL de Supabase ANTES del despliegue.
-- Idempotente: usa IF NOT EXISTS.

ALTER TABLE solicitudes ADD COLUMN IF NOT EXISTS motivo_anulacion text;
ALTER TABLE solicitudes ADD COLUMN IF NOT EXISTS anulado_por       text;
ALTER TABLE solicitudes ADD COLUMN IF NOT EXISTS anulado_at        timestamptz;

COMMENT ON COLUMN solicitudes.motivo_anulacion IS 'Motivo obligatorio de la anulación (texto libre).';
COMMENT ON COLUMN solicitudes.anulado_por       IS 'Correo o id del administrador que anuló el trámite.';
COMMENT ON COLUMN solicitudes.anulado_at         IS 'Fecha y hora en que se anuló el trámite.';
```

> La migración la ejecuta el usuario manualmente en Supabase. El código del endpoint no debe desplegarse antes de correr esta migración, porque el `UPDATE` referencia estas columnas.

### Aplicabilidad a certificados de actualización

Tanto las actualizaciones como los certificados de actualización comparten `tipo_formulario = "actualizacion"` (los certificados se distinguen por `tipo_tramite` que empieza con `"CERTIFICADO"`). La anulación opera sobre la columna `estado` sin ramificar por `tipo_tramite`, por lo que **aplica por igual a ambos**. No se requiere lógica adicional para certificados.

## Error Handling

| Caso | Capa | Comportamiento |
|---|---|---|
| Token ausente o usuario no autorizado | Backend | 403 `{ error: "No autorizado" }` |
| `action` distinto de `"anular"` | Backend | 400 `{ error: "Acción no soportada" }` |
| `id` faltante | Backend | 400 `{ error: "id requerido" }` |
| Motivo vacío / solo espacios / < 3 chars | Backend | 400 mensaje de motivo obligatorio |
| Trámite no encontrado | Backend | 404 `{ error: "El trámite no existe" }` |
| Estado actual ≠ "aprobado" | Backend | 400 mensaje de solo aprobados |
| Carrera: estado cambió entre lectura y update | Backend | El `.eq("estado","aprobado")` del update evita la escritura; respuesta refleja 0 filas afectadas (tratado como no-op seguro) |
| Error de Supabase al actualizar | Backend | 500 con el mensaje del error |
| Motivo < 3 chars en el modal | Frontend | Botón de confirmación deshabilitado (validación previa al envío) |
| Error devuelto por el endpoint | Frontend | Mostrar mensaje de error en el modal (patrón de `EditMontoModal`) |

## Testing Strategy

Dada la naturaleza del cambio —una transición de estado con guardas de precondición, acoplada a I/O de Supabase (auth + base de datos) y a renderizado de UI— no existen propiedades universales de alto valor que justifiquen pruebas basadas en propiedades (no hay parsers, serializadores ni algoritmos con espacios de entrada amplios). Por ello, el diseño **no define una sección de Correctness Properties** y adopta una estrategia realista de pruebas por ejemplo y de borde para el endpoint, más verificación manual para la integración con Contabilidad.

### Pruebas por ejemplo del endpoint `POST ... action="anular"`

Con Supabase (`supabaseAdmin` y `supabase.auth.getUser`) mockeado:

1. **Autorizado + trámite aprobado + motivo válido → éxito**: el update aplica `estado="anulado"`, `motivo_anulacion`, `anulado_por`, `anulado_at`; respuesta 200. (Valida Req 1.1, 2.1, 3.1, 4.1–4.3, 5.1)
2. **No autorizado → 403**: sin token y con rol no permitido. (Valida Req 1.2)
3. **Estado no aprobado → 400**: casos `pendiente`, `observado`, `rechazado`, `anulado`. (Valida Req 2.2)
4. **Trámite inexistente → 404**: la lectura devuelve `null`. (Valida Req 2.3)
5. **Motivo faltante o corto → 400**: `undefined`, `""`, `"  "`, `"ab"`. (Valida Req 3.2)
6. **No se borra el registro**: se verifica que se invoca `update` y nunca `delete`. (Valida Req 5.1)

### Pruebas por ejemplo de la UI (opcionales)

- El botón "Anular" se renderiza solo cuando `estado === "aprobado"` y se oculta en otros estados. (Valida Req 7.1, 7.2)
- `ESTADO_BADGE`/`ESTADO_LABEL` incluyen la entrada `"anulado"` con etiqueta "Anulado". (Valida Req 5.2)
- El botón de confirmación del modal está deshabilitado con motivo `< 3` chars y habilitado con `>= 3`. (Valida Req 7.4)
- Tras respuesta OK, la fila pasa a mostrar "Anulado" y el motivo. (Valida Req 8.1)

### Verificación manual (integración con Contabilidad)

- Anular un trámite de actualización aprobado y confirmar que desaparece del total y del listado del mes en el módulo de Contabilidad (`/api/admin/contabilidad`), sin haber modificado `contabilidad/route.ts`. (Valida Req 6.1, 6.2)
- Verificación de compilación y build: `tsc --noEmit` y `next build` sin errores.

### Configuración de framework de pruebas

El proyecto no tiene un framework de pruebas configurado actualmente. Si se decide implementar los tests automatizados (marcados como opcionales en el plan), se configurará Vitest (estándar para proyectos Next.js/TypeScript) ejecutado en modo single-run (`vitest --run`). Si no, la verificación mínima obligatoria es `tsc --noEmit` + `next build` + la verificación manual de Contabilidad.
