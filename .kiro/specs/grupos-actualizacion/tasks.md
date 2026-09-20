# Plan de Implementación: Grupos de Actualización

## Overview

El diseño usa TypeScript (Next.js 15 App Router + Supabase), por lo que todas las tareas se implementan en TypeScript/TSX. El plan avanza en tres bloques incrementales: (1) esquema de BD y endpoints de grupos, (2) integración del formulario público, (3) panel de actualización (filtro por grupo y registro manual con selección de grupo). Las sub-tareas de pruebas están marcadas como opcionales con `*`.

## Tasks

- [ ] 1. Esquema de base de datos y tipos
  - [ ] 1.1 Crear la migración SQL `src/db/grupos-actualizacion-schema.sql`
    - Tabla `grupos_actualizacion` (id, programa_id, programa_label, fecha_inicio, fecha_cierre_inscripcion, estado, created_by, created_at)
    - CHECK de `estado IN ('activo','cerrado')`
    - Índice único parcial `uq_grupos_actualizacion_activo_por_programa` sobre `programa_id WHERE estado='activo'`
    - Columna `grupo_actualizacion_id` (UUID nullable, FK a `grupos_actualizacion`) en `solicitudes` + índice
    - Script idempotente (`IF NOT EXISTS`), con nota de que las inscripciones previas quedan sin agrupar (sin backfill)
    - _Requisitos: 8.1, 8.2, 8.3, 8.4, 8.6, 1.3_
  - [ ] 1.2 Ampliar tipos TypeScript en `src/lib/supabase.ts`
    - Agregar `grupo_actualizacion_id?: string | null` a `SolicitudDB`
    - Definir la interfaz `GrupoActualizacionDB`
    - _Requisitos: 8.1, 8.2_

- [ ] 2. Lógica pura y endpoints de grupos
  - [ ] 2.1 Crear módulo de lógica pura `src/lib/grupos-actualizacion/logic.ts`
    - `validarApertura(input, gruposExistentes)`: valida programa del catálogo, fecha de inicio y regla de un solo activo por programa
    - `resolverGrupoActivo(programaId, grupos)`: devuelve el grupo activo o null
    - `cerrarGrupo(grupo)`: transición idempotente a `cerrado`
    - `estaVencido(grupo, hoy)`: cálculo del indicador "vencido" sin cambiar estado
    - `programasActivos(grupos)`: deriva la lista de programas con grupo activo
    - _Requisitos: 1.1, 1.3, 1.4, 1.5, 2.1, 2.3, 2.4, 2.5, 3.1, 3.4, 4.1, 4.2_
  - [ ]* 2.2 Prueba de propiedad: un solo grupo activo por programa
    - **Property 1: A lo sumo un grupo activo por programa**
    - **Validates: Requisitos 1.1, 1.3**
  - [ ]* 2.3 Prueba de propiedad: programas activos derivados correctamente
    - **Property 4: El formulario solo ofrece programas con grupo activo**
    - **Validates: Requisitos 3.1, 3.2, 3.4**
  - [ ]* 2.4 Prueba de propiedad: cierre idempotente y bloqueo de vinculaciones
    - **Property 5: Cerrar es idempotente y bloquea nuevas vinculaciones**
    - **Validates: Requisitos 2.1, 2.2, 2.5**
  - [ ]* 2.5 Prueba de propiedad: vencido no cierra el grupo
    - **Property 6: La validez del "vencido" no cierra el grupo**
    - **Validates: Requisitos 2.3, 2.4**
  - [ ] 2.6 Crear `src/app/api/admin/grupos-actualizacion/route.ts` (GET, POST, PATCH)
    - `verifyAccess` con `ALLOWED_ROLES = ["super_admin","actualizacion"]` + fallback correo admin
    - GET: listar grupos (filtro opcional por `programa_id`)
    - POST: aperturar usando `validarApertura`; derivar `programa_label` del catálogo; registrar en `historial_auditoria`
    - PATCH: cerrar grupo (idempotente); registrar en `historial_auditoria`
    - _Requisitos: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 2.1, 2.5, 7.1, 7.2, 7.3_
  - [ ]* 2.7 Pruebas unitarias del endpoint de grupos
    - Validación de apertura (programa/fecha inválidos), cierre de ya cerrado, autorización por rol
    - _Requisitos: 1.4, 1.5, 2.5, 7.1, 7.2, 7.3_
  - [ ] 2.8 Crear `src/app/api/actualizaciones/programas-activos/route.ts` (GET público)
    - Devuelve programas con grupo activo (programa_id, programa_label, grupo_id, fechas) usando `programasActivos`
    - _Requisitos: 3.1, 3.3, 3.4_

- [ ] 3. Checkpoint — asegurar que todo compila y las pruebas pasan
  - Ejecutar `npx tsc --noEmit` y las pruebas existentes; consultar al usuario si surgen dudas.

- [ ] 4. Asignación automática al grupo activo en la inscripción pública
  - [ ] 4.1 Modificar `src/app/api/solicitudes/route.ts`
    - Si `tipo_formulario === "actualizacion"`: resolver `programa_id` (del body o desde el catálogo por `tipo_tramite`), buscar grupo activo con `resolverGrupoActivo`
    - Si hay grupo activo: insertar con `grupo_actualizacion_id`; si no: responder 400 "No hay una tanda abierta para este programa"
    - Mantener sin cambios el flujo para otros `tipo_formulario`
    - _Requisitos: 4.1, 4.2, 4.3_
  - [ ]* 4.2 Prueba de propiedad: la inscripción se asigna al grupo activo
    - **Property 2: La inscripción pública se asigna al grupo activo del programa**
    - **Validates: Requisitos 4.1, 4.3**
  - [ ]* 4.3 Prueba de propiedad: sin grupo activo se rechaza
    - **Property 3: Sin grupo activo se rechaza la inscripción**
    - **Validates: Requisitos 4.2, 3.3**

- [ ] 5. Integración del formulario público
  - [ ] 5.1 Modificar `src/app/actualizaciones/page.tsx`
    - Al montar, consumir `GET /api/actualizaciones/programas-activos` y poblar el `<select>` solo con programas activos
    - Enviar `programa_id` en el `POST /api/solicitudes`
    - Cruzar con `ACTUALIZACIONES_CATALOGO` por `programa_id` para mostrar costo/label
    - Si no hay programas activos, mostrar aviso y deshabilitar el envío
    - _Requisitos: 3.2, 3.3, 3.4, 4.1_
  - [ ]* 5.2 Pruebas de ejemplo del formulario
    - Render con lista de programas activos y con lista vacía (aviso)
    - _Requisitos: 3.2, 3.3_

- [ ] 6. Checkpoint — asegurar que todo compila y las pruebas pasan
  - Ejecutar `npx tsc --noEmit` y `npm run build`; consultar al usuario si surgen dudas.

- [ ] 7. Panel de actualización: servicio, filtro por grupo y registro manual
  - [ ] 7.1 Crear `src/lib/grupos-actualizacion-service.ts`
    - `getGrupos()`, `aperturarGrupo(...)`, `cerrarGrupo(id)`, `asignarGrupoASolicitud(solicitudId, grupoId)` con token de sesión (patrón de `solicitudes-service.ts`)
    - _Requisitos: 1.1, 2.1, 6.1, 8.5_
  - [ ] 7.2 Gestión de grupos en `src/app/dashboard/actualizacion/page.tsx`
    - UI para aperturar (programa, fecha inicio, fecha cierre) y cerrar grupos; indicador "Vencido" para grupos activos con fecha de cierre pasada
    - _Requisitos: 1.1, 2.1, 2.3, 6.5, 7.4_
  - [ ] 7.3 Filtro por grupo en el panel
    - Selector de grupo (activos y cerrados) + opción "Sin agrupar"; filtrar la tabla por `grupo_actualizacion_id`
    - _Requisitos: 6.1, 6.2, 6.3, 6.4, 6.5_
  - [ ] 7.4 Selección de grupo en el `RegistroManualModal`
    - `<select>` de grupo requerido; derivar `tipo_tramite` del `programa_label` del grupo; enviar `grupo_actualizacion_id`; impedir guardado sin grupo
    - _Requisitos: 5.1, 5.2, 5.3, 5.4_
  - [ ] 7.5 Acción para asignar grupo a inscripción sin agrupar
    - Botón por fila que llama a `asignarGrupoASolicitud` (endpoint PATCH de solicitudes)
    - _Requisitos: 8.5_
  - [ ]* 7.6 Prueba de propiedad: el registro manual respeta el grupo seleccionado
    - **Property 7: El registro manual respeta el grupo seleccionado**
    - **Validates: Requisitos 5.2, 5.4**
  - [ ]* 7.7 Pruebas de ejemplo del panel
    - Filtrado por grupo (incluye cerrados y sin agrupar); validación de guardado sin grupo
    - _Requisitos: 6.2, 6.4, 5.3_

- [ ] 8. Checkpoint final — asegurar que todo compila y las pruebas pasan
  - Ejecutar `npx tsc --noEmit` y `npm run build`; consultar al usuario si surgen dudas.

## Notas

- Las tareas marcadas con `*` son opcionales (pruebas) y pueden omitirse para un MVP más rápido.
- Cada tarea referencia los requisitos que cubre para trazabilidad.
- La migración SQL (tarea 1.1) la ejecuta el usuario en el SQL Editor de Supabase.
- La lógica pura (tarea 2.1) se separa del acceso a datos para permitir pruebas basadas en propiedades con mocks.
- Las propiedades de la sección Correctness Properties del diseño se implementan con **fast-check** (mínimo 100 iteraciones cada una) y se etiquetan con `// Feature: grupos-actualizacion, Property N: ...`.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2"] },
    { "id": 1, "tasks": ["2.1"] },
    { "id": 2, "tasks": ["2.2", "2.3", "2.4", "2.5", "2.6", "2.8"] },
    { "id": 3, "tasks": ["2.7", "4.1", "7.1"] },
    { "id": 4, "tasks": ["4.2", "4.3", "5.1", "7.2"] },
    { "id": 5, "tasks": ["5.2", "7.3", "7.4", "7.5"] },
    { "id": 6, "tasks": ["7.6", "7.7"] }
  ]
}
```
