# Documento de Diseño

## Overview

Se agrega un **correlativo interno por programa** a los grupos de actualización. El valor se calcula automáticamente al crear el grupo mediante una función pura (`calcularSiguienteNumeroGrupo`), se persiste en una nueva columna `numero_grupo` y se muestra solo en el panel de administración. Los dos grupos existentes se numeran con una migración de backfill (`ac1 = 10`, `ac2 = 30`).

El diseño respeta la arquitectura actual:
- Lógica pura en `src/lib/grupos-actualizacion/logic.ts` (junto a `validarApertura`, `programasActivos`, etc.).
- Catálogo de programas en `src/lib/mock-data.ts` (`ACTUALIZACIONES_CATALOGO`).
- Endpoint en `src/app/api/admin/grupos-actualizacion/route.ts`.
- Tipos en `src/lib/supabase.ts` (`GrupoActualizacionDB`).
- UI en `src/app/dashboard/actualizacion/page.tsx` (selector y `GruposModal`).
- Migración SQL nueva en `src/db/numero-correlativo-grupos-schema.sql` (la ejecuta el usuario en Supabase antes del deploy).

## Architecture

```
Panel admin (page.tsx)                         Formulario público
  selector + GruposModal                         (sin cambios)
        │  muestra "Grupo N"                           │
        │                                              │
        ▼                                              ▼
POST /api/admin/grupos-actualizacion           (no expone numero_grupo)
  1. verifyAccess (roles)
  2. validarApertura (ya existe)
  3. SELECT numero_grupo del programa (activos + cerrados)
  4. numeroInicio = catálogo[programa].numeroInicioGrupo ?? DEFAULT
  5. numero_grupo = calcularSiguienteNumeroGrupo(numeroInicio, existentes)  ◄── función pura (logic.ts)
  6. INSERT grupo con numero_grupo
  7. INSERT auditoría con numero_grupo
        │
        ▼
Supabase: tabla grupos_actualizacion
  + columna numero_grupo integer
  + índice único parcial (programa_id, numero_grupo)
```

Flujo de datos: el endpoint es el único punto que asigna `numero_grupo`. La UI y el formulario público solo leen. La función de cálculo no toca Supabase: recibe el número de inicio y la lista de números existentes como argumentos, lo que la hace testeable de forma aislada.

## Components and Interfaces

### 1. Función pura de cálculo (`src/lib/grupos-actualizacion/logic.ts`)

Se añade una función pura y una constante de default:

```typescript
/** Número de inicio por defecto cuando un programa no define `numeroInicioGrupo`. */
export const DEFAULT_NUMERO_INICIO_GRUPO = 1;

/**
 * Calcula el siguiente número correlativo de un grupo dentro de un programa (Req 2.1, 2.2, 1.3).
 *
 * @param numeroInicio  Número de inicio del programa (p.ej. 10 para ac1, 30 para ac2).
 *                      Si el programa no lo define, el llamador pasa DEFAULT_NUMERO_INICIO_GRUPO.
 * @param numerosExistentes  Lista de `numero_grupo` ya asignados en el programa,
 *                      considerando grupos activos y cerrados. Los valores null/no numéricos
 *                      se ignoran.
 * @returns  numeroInicio si no hay números válidos; de lo contrario max(existentes) + 1.
 */
export function calcularSiguienteNumeroGrupo(
  numeroInicio: number,
  numerosExistentes: (number | null | undefined)[]
): number {
  const validos = numerosExistentes.filter(
    (n): n is number => typeof n === "number" && Number.isFinite(n)
  );
  if (validos.length === 0) return numeroInicio;
  return Math.max(...validos) + 1;
}
```

Decisiones:
- La función ignora `null`/no numéricos para tolerar filas antiguas sin numerar (no debería ocurrir tras el backfill, pero es defensivo).
- No decide el default: el endpoint resuelve `numeroInicio` desde el catálogo y pasa `DEFAULT_NUMERO_INICIO_GRUPO` si falta.
- El endpoint pasa la lista completa de números (sin filtrar por estado), satisfaciendo Req 2.3.

### 2. Catálogo de programas (`src/lib/mock-data.ts`)

Se añade `numeroInicioGrupo` a cada entrada de `ACTUALIZACIONES_CATALOGO`:

```typescript
export const ACTUALIZACIONES_CATALOGO = [
  {
    id: "ac1",
    label: "IA PRÁCTICA PARA LA GESTIÓN ADMINISTRATIVA MODERNA",
    // ...campos existentes...
    numeroInicioGrupo: 10,
  },
  {
    id: "ac2",
    label: "GESTIÓN SECRETARIAL EJECUTIVA",
    // ...campos existentes...
    numeroInicioGrupo: 30,
  },
] as const;
```

El array sigue siendo `as const`. Para programas futuros que no definan el campo, el endpoint usa `DEFAULT_NUMERO_INICIO_GRUPO`.

### 3. Contrato del endpoint (`src/app/api/admin/grupos-actualizacion/route.ts`)

El `POST` **no** acepta `numero_grupo` del body (Req 2.4). Cambios respecto a la versión actual:

- Tras validar con `validarApertura`, antes del `insert`, consultar el máximo correlativo del programa. En lugar del `SELECT programa_id, estado` filtrado por `estado = 'activo'` que ya se usa para la validación, se añade una consulta específica de números (sin filtrar por estado):

```typescript
// Máximo numero_grupo del programa (activos + cerrados) — Req 2.1, 2.3
const { data: maxRows, error: maxError } = await supabaseAdmin
  .from("grupos_actualizacion")
  .select("numero_grupo")
  .eq("programa_id", programa_id)
  .order("numero_grupo", { ascending: false })
  .limit(1);

if (maxError) return NextResponse.json({ error: maxError.message }, { status: 500 });

const numeroInicio = programa?.numeroInicioGrupo ?? DEFAULT_NUMERO_INICIO_GRUPO;
const numero_grupo = calcularSiguienteNumeroGrupo(
  numeroInicio,
  (maxRows ?? []).map((r) => r.numero_grupo)
);
```

- El `insert` incluye `numero_grupo`.
- El detalle de `historial_auditoria` incluye `numero_grupo` (Req 4.2).
- Manejo de carrera/duplicado (Req 3.2): si el `insert` falla por violación del índice único (código `23505` o mensaje `duplicate key`/`unique`), devolver un error claro. Dado que ya existe un `catch` para el índice único del grupo activo, se amplía el mensaje para distinguir el caso de `numero_grupo` duplicado. Dada la baja concurrencia real (un administrador operando), basta con devolver un error comprensible; no se implementa reintento automático.

El contrato de respuesta no cambia de forma (`{ success: true, grupo }`), pero `grupo` ahora incluye `numero_grupo`.

### 4. Tipo `GrupoActualizacionDB` (`src/lib/supabase.ts`)

Se añade el campo opcional:

```typescript
export interface GrupoActualizacionDB {
  // ...campos existentes...
  numero_grupo?: number | null; // correlativo interno por programa
}
```

### 5. UI del panel (`src/app/dashboard/actualizacion/page.tsx`)

Helper local para la etiqueta (Req 6.1, 6.2, 6.3):

```typescript
const etiquetaGrupo = (g: GrupoActualizacionDB) =>
  typeof g.numero_grupo === "number" ? `Grupo ${g.numero_grupo} — ` : "";
```

- **Selector de filtro** (línea ~347): anteponer `etiquetaGrupo(g)` a la descripción actual (`🟢/🔒 {fecha} (cerrado)`), quedando p.ej. `Grupo 10 — 🟢 21/10/2025`.
- **Lista del `GruposModal`** (línea ~1549, `gruposOrdenados.map`): mostrar `Grupo {numero_grupo}` junto a cada grupo listado.
- **NO** se toca el `<select>` de inscripción de alumnos que muestra `g.programa_label — inicia ...` ni el formulario público (Req 6.4).

## Data Models

### Columna nueva

Tabla `grupos_actualizacion`: se añade `numero_grupo INTEGER` (nullable para permitir el ALTER sobre filas existentes antes del backfill).

### Campo nuevo en catálogo

`ACTUALIZACIONES_CATALOGO[*].numeroInicioGrupo: number` (ac1 = 10, ac2 = 30).

### Migración y backfill (`src/db/numero-correlativo-grupos-schema.sql`)

```sql
-- 1. Columna correlativa interna (Req 4.1)
ALTER TABLE grupos_actualizacion
  ADD COLUMN IF NOT EXISTS numero_grupo INTEGER;

-- 2. Backfill determinista de los grupos existentes (Req 5.1, 5.2, 5.3)
--    Regla: al grupo más antiguo del programa se le asigna el numero_inicio,
--    y los siguientes se incrementan por orden de creación (created_at).
--    Con un solo grupo por programa, esto asigna ac1 -> 10 y ac2 -> 30.
WITH numerados AS (
  SELECT
    id,
    CASE programa_id WHEN 'ac1' THEN 10 WHEN 'ac2' THEN 30 ELSE 1 END
      + (ROW_NUMBER() OVER (PARTITION BY programa_id ORDER BY created_at ASC) - 1)
      AS nuevo_numero
  FROM grupos_actualizacion
  WHERE numero_grupo IS NULL
)
UPDATE grupos_actualizacion g
SET numero_grupo = n.nuevo_numero
FROM numerados n
WHERE g.id = n.id;

-- 3. Índice único parcial para evitar duplicados dentro del programa (Req 3.1)
--    Parcial sobre numero_grupo NOT NULL para no chocar con filas sin numerar.
CREATE UNIQUE INDEX IF NOT EXISTS uq_grupos_actualizacion_numero_por_programa
  ON grupos_actualizacion (programa_id, numero_grupo)
  WHERE numero_grupo IS NOT NULL;
```

El usuario ejecuta esta migración en Supabase **antes** del deploy. El índice único es la garantía de unicidad (Req 3.1) y la red de seguridad para la carrera (Req 3.2).

## Error Handling

- **Programa inválido**: ya cubierto por `validarApertura` (devuelve 400). El cálculo del correlativo solo ocurre tras pasar esa validación.
- **Fallo al consultar el máximo** (`maxError`): devolver 500 con el mensaje del error, igual que el patrón existente.
- **Duplicado de `numero_grupo`** (violación del índice único, `23505`): devolver 400 con mensaje claro, distinguiéndolo del caso de "grupo activo duplicado" ya existente. Sin reintento automático dada la baja concurrencia.
- **Programa sin `numeroInicioGrupo`**: se usa `DEFAULT_NUMERO_INICIO_GRUPO = 1` (Req 1.3), sin error.
- **Grupos sin numerar en lectura** (`numero_grupo` null): la UI omite la etiqueta `Grupo N` (Req 6.3); la función de cálculo ignora valores no numéricos.

## Correctness Properties

*Una propiedad es una característica o comportamiento que debe cumplirse en todas las ejecuciones válidas del sistema — en esencia, una afirmación formal sobre lo que el sistema debe hacer. Las propiedades sirven de puente entre las especificaciones legibles por humanos y las garantías de corrección verificables por máquina.*

Las propiedades se concentran en la función pura `calcularSiguienteNumeroGrupo`, que es la única pieza con comportamiento que varía de forma interesante con la entrada. La unicidad en BD, la persistencia, la auditoría, la autorización, el backfill SQL y el render de UI son integración/ejemplo y se cubren con pruebas de ejemplo y verificación, no con PBT.

### Property 1: Monotonía estricta del correlativo

*Para cualquier* número de inicio entero y *para cualquier* lista no vacía de números de grupo existentes, `calcularSiguienteNumeroGrupo` devuelve un valor estrictamente mayor que todos los números existentes e igual a `max(existentes) + 1`.

**Validates: Requirements 2.1, 3.1**

### Property 2: Respeto del número de inicio sin grupos previos

*Para cualquier* número de inicio entero, cuando la lista de números existentes está vacía (o no contiene valores numéricos válidos), `calcularSiguienteNumeroGrupo` devuelve exactamente el número de inicio.

**Validates: Requirements 2.2, 1.3**

## Testing Strategy

Enfoque dual (pruebas de ejemplo + pruebas de propiedades), usando la stack existente del proyecto: **Vitest + fast-check**.

- **Pruebas de propiedades (fast-check)** sobre `calcularSiguienteNumeroGrupo`:
  - Property 1: generar `numeroInicio` y un array no vacío de enteros; verificar `resultado === max + 1` y `resultado > n` para todo `n`. Mínimo 100 iteraciones.
  - Property 2: generar `numeroInicio`; con lista vacía verificar `resultado === numeroInicio`. Mínimo 100 iteraciones.
  - Formato de etiqueta: **Feature: numero-correlativo-grupos, Property {N}: {texto}**.
- **Pruebas de ejemplo (Vitest)**:
  - Catálogo: `ac1.numeroInicioGrupo === 10`, `ac2.numeroInicioGrupo === 30` (Req 1.2).
  - Default: con lista vacía y `numeroInicio = DEFAULT_NUMERO_INICIO_GRUPO`, resultado `1` (Req 1.3).
  - Mezcla activos/cerrados: la función recibe números de ambos estados y usa el máximo global (Req 2.3).
- **Verificación/integración (manual o revisión)**:
  - Migración y backfill: ejecutar en Supabase y verificar `ac1 = 10`, `ac2 = 30` (Req 5.1, 5.2).
  - Endpoint: el `insert` persiste `numero_grupo` y el detalle de auditoría lo incluye (Req 4.1, 4.2).
  - Autorización: `verifyAccess` sigue restringiendo a los roles permitidos (Req 7.1, 7.2).
  - UI: el selector y `GruposModal` muestran `Grupo N`; el formulario público no lo referencia (Req 6.1–6.4).
- **Checkpoint**: `tsc --noEmit` y `next build` deben pasar.
