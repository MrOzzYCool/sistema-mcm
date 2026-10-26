# Implementation Plan: Número Correlativo de Grupos

## Overview

Implementación incremental del correlativo interno por programa. Se parte de la base de datos (migración + backfill que ejecuta el usuario), luego el catálogo y la función pura de cálculo (con sus pruebas), después la integración en el endpoint, la actualización del tipo y la UI del panel, y finalmente un checkpoint de compilación y build. Cada paso se apoya en los anteriores y termina integrando el correlativo de punta a punta sin dejar código huérfano.

## Tasks

- [ ] 1. Crear migración SQL con columna, backfill e índice único
  - Crear `src/db/numero-correlativo-grupos-schema.sql`
  - `ALTER TABLE grupos_actualizacion ADD COLUMN IF NOT EXISTS numero_grupo INTEGER`
  - Backfill determinista por `programa_id` ordenando por `created_at` ascendente: `ac1 -> 10`, `ac2 -> 30`, incrementando en caso de múltiples grupos
  - Índice único parcial `uq_grupos_actualizacion_numero_por_programa` sobre `(programa_id, numero_grupo) WHERE numero_grupo IS NOT NULL`
  - NOTA: el usuario ejecuta esta migración en Supabase antes del deploy
  - _Requisitos: 4.1, 5.1, 5.2, 5.3, 3.1_

- [ ] 2. Añadir `numeroInicioGrupo` al catálogo de programas
  - En `src/lib/mock-data.ts`, agregar `numeroInicioGrupo: 10` a `ac1` y `numeroInicioGrupo: 30` a `ac2`
  - Mantener el array `as const`
  - _Requisitos: 1.1, 1.2_

- [ ] 3. Implementar función pura de cálculo del siguiente correlativo
  - [ ] 3.1 Añadir `DEFAULT_NUMERO_INICIO_GRUPO` y `calcularSiguienteNumeroGrupo` en `src/lib/grupos-actualizacion/logic.ts`
    - La función recibe `numeroInicio` y la lista de `numero_grupo` existentes (ignora null/no numéricos)
    - Devuelve `numeroInicio` si no hay válidos; si no, `max(existentes) + 1`
    - _Requisitos: 1.3, 2.1, 2.2_

  - [ ]* 3.2 Escribir prueba de propiedad: monotonía estricta
    - **Property 1: Monotonía estricta del correlativo**
    - Para cualquier `numeroInicio` y lista no vacía de enteros, resultado = `max + 1` y mayor que todos
    - fast-check, mínimo 100 iteraciones
    - **Validates: Requirements 2.1, 3.1**

  - [ ]* 3.3 Escribir prueba de propiedad: respeto del número de inicio
    - **Property 2: Respeto del número de inicio sin grupos previos**
    - Para cualquier `numeroInicio`, con lista vacía o sin válidos, resultado = `numeroInicio`
    - fast-check, mínimo 100 iteraciones
    - **Validates: Requirements 2.2, 1.3**

  - [ ]* 3.4 Escribir pruebas de ejemplo del catálogo y default
    - `ac1.numeroInicioGrupo === 10`, `ac2.numeroInicioGrupo === 30`
    - Con `DEFAULT_NUMERO_INICIO_GRUPO` y lista vacía, resultado = 1
    - Mezcla de números de grupos activos y cerrados usa el máximo global
    - _Requisitos: 1.2, 1.3, 2.3_

- [ ] 4. Integrar el cálculo en el POST del endpoint y en auditoría
  - En `src/app/api/admin/grupos-actualizacion/route.ts`, tras `validarApertura` y antes del `insert`:
    - Consultar el máximo `numero_grupo` del programa sin filtrar por estado (`select numero_grupo ... order desc limit 1`)
    - Resolver `numeroInicio = programa?.numeroInicioGrupo ?? DEFAULT_NUMERO_INICIO_GRUPO`
    - Calcular `numero_grupo` con `calcularSiguienteNumeroGrupo`
  - Incluir `numero_grupo` en el `insert`
  - Incluir `numero_grupo` en el `detalle` de `historial_auditoria`
  - Ampliar el `catch` de índice único para distinguir el duplicado de `numero_grupo` y devolver 400 con mensaje claro
  - No aceptar `numero_grupo` desde el body
  - _Requisitos: 2.1, 2.2, 2.3, 2.4, 3.2, 4.1, 4.2, 7.1, 7.2_

- [ ] 5. Actualizar el tipo y mostrar "Grupo N" en el panel
  - [ ] 5.1 Añadir `numero_grupo?: number | null` a `GrupoActualizacionDB` en `src/lib/supabase.ts`
    - _Requisitos: 4.1_

  - [ ] 5.2 Mostrar "Grupo N" en el selector de filtro y en el `GruposModal`
    - En `src/app/dashboard/actualizacion/page.tsx`, crear helper `etiquetaGrupo` que devuelve `Grupo {numero_grupo} — ` solo si hay número
    - Anteponer la etiqueta en el `<option>` del selector de filtro (~línea 347)
    - Mostrar `Grupo {numero_grupo}` en la lista de `gruposOrdenados` del `GruposModal` (~línea 1549)
    - NO modificar el `<select>` de inscripción de alumnos ni el formulario público
    - _Requisitos: 6.1, 6.2, 6.3, 6.4_

- [ ] 6. Checkpoint - Verificar compilación y build
  - Ejecutar `tsc --noEmit` y `next build`
  - Asegurar que todas las pruebas pasan; preguntar al usuario si surgen dudas

## Notes

- Las tareas marcadas con `*` son opcionales (pruebas) y pueden omitirse para un MVP más rápido.
- La tarea 1 (migración) la ejecuta el usuario en Supabase antes del deploy.
- Cada tarea referencia requisitos específicos para trazabilidad.
- Las pruebas de propiedades (fast-check) validan la función pura; las de ejemplo cubren catálogo, default y bordes.
- El número correlativo es interno: solo aparece en el panel de administración, nunca en el formulario público.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1", "2", "3.1", "5.1"] },
    { "id": 1, "tasks": ["3.2", "3.3", "3.4", "4", "5.2"] }
  ]
}
```
