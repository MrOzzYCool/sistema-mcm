# Implementation Plan: Anular trámite de actualización

## Overview

La implementación se realiza de forma incremental: primero la migración de base de datos (columnas de auditoría), luego el endpoint de anulación en `solicitudes-ops`, después la capa de servicio y la UI (botón + modal), y finalmente la verificación de tipos y build. Cada paso se apoya en el anterior y termina integrado en la página de actualización existente, sin código huérfano. La anulación se basa en un cambio de estado a `"anulado"`, que excluye el trámite de Contabilidad automáticamente porque esa consulta ya filtra por `estado = "aprobado"`.

## Tasks

- [ ] 1. Crear la migración SQL de columnas de auditoría
  - Crear el archivo `src/db/anular-tramite-actualizacion-schema.sql`
  - Añadir `ALTER TABLE solicitudes ADD COLUMN IF NOT EXISTS` para `motivo_anulacion text`, `anulado_por text`, `anulado_at timestamptz`
  - Incluir comentarios `COMMENT ON COLUMN` para cada columna
  - **Acción del usuario**: el USUARIO debe ejecutar este script en el editor SQL de Supabase ANTES de desplegar el endpoint (el `UPDATE` referencia estas columnas)
  - _Requisitos: 4.1, 4.2, 4.3_

- [ ] 2. Implementar el endpoint de anulación
  - [ ] 2.1 Añadir el handler `POST` con `action: "anular"` en `src/app/api/admin/solicitudes-ops/route.ts`
    - Reutilizar `verifyAdmin(req)`; devolver 403 `{ error: "No autorizado" }` si no autoriza
    - Validar `action === "anular"` (si no, 400 "Acción no soportada") e `id` presente (si no, 400 "id requerido")
    - Validar `motivo` con `motivo.trim().length >= 3` (si no, 400 con mensaje de motivo obligatorio)
    - Leer la solicitud por `id` con `supabaseAdmin`; si no existe, 404 "El trámite no existe"
    - Validar `estado === "aprobado"`; si no, 400 "Solo se pueden anular trámites en estado aprobado"
    - Ejecutar `UPDATE` con `estado="anulado"`, `motivo_anulacion`, `anulado_por` (email o id del admin), `anulado_at` (ISO), con guarda `.eq("estado","aprobado")`
    - Responder 200 `{ success: true, estado: "anulado", anulado_at }`; en error de DB, 500
    - _Requisitos: 1.1, 1.2, 2.1, 2.2, 2.3, 3.1, 3.2, 4.1, 4.2, 4.3, 5.1_
  - [ ]* 2.2 Escribir pruebas por ejemplo del endpoint de anulación
    - Mockear `supabaseAdmin` y `supabase.auth.getUser`
    - Casos: autorizado+aprobado+motivo válido → éxito; no autorizado → 403; estado no aprobado → 400; id inexistente → 404; motivo ausente/corto → 400; verificar que se usa `update` y nunca `delete`
    - _Requisitos: 1.1, 1.2, 2.1, 2.2, 2.3, 3.1, 3.2, 4.1, 4.2, 4.3, 5.1_

- [ ] 3. Añadir la función de servicio de anulación
  - Añadir `anularSolicitud(id, motivo)` en `src/lib/solicitudes-service.ts`
  - Obtener la sesión, enviar `POST` con `Authorization: Bearer <token>` y body `{ action: "anular", id, motivo }`
  - Lanzar `Error` con el mensaje del endpoint si la respuesta no es `ok`
  - _Requisitos: 7.5, 8.2_

- [ ] 4. Extender tipos y badges de estado para "anulado"
  - Añadir `"anulado"` a la unión literal de `SolicitudDB["estado"]` en `src/lib/supabase.ts` si aplica
  - Añadir las entradas `anulado` a `ESTADO_BADGE` (clase neutra/gris) y `ESTADO_LABEL` ("Anulado") en `src/app/dashboard/actualizacion/page.tsx`
  - Añadir el tipo del campo `motivo_anulacion` al modelo si se tipa explícitamente
  - _Requisitos: 5.2_

- [ ] 5. Añadir el botón "Anular" y el modal de motivo en la UI
  - [ ] 5.1 Añadir el botón "Anular" condicional en la celda de acciones de `src/app/dashboard/actualizacion/page.tsx`
    - Mostrar el botón solo cuando `s.estado === "aprobado"` (ocultarlo en los demás estados)
    - Agregar el estado `const [anularSol, setAnularSol] = useState<SolicitudDB | null>(null)` y abrir el modal al hacer clic
    - En la celda de estado, cuando `s.estado === "anulado"`, mostrar el badge "Anulado" y el `motivo_anulacion` debajo
    - _Requisitos: 5.2, 7.1, 7.2_
  - [ ] 5.2 Implementar el componente `AnularModal` en `src/app/dashboard/actualizacion/page.tsx`
    - Campo de texto para el motivo; botón "Confirmar anulación" deshabilitado mientras `motivo.trim().length < 3` o `saving`
    - Al confirmar, llamar `anularSolicitud(id, motivo)`; en éxito invocar `onSuccess(id, motivo)` que actualiza la fila local a `estado: "anulado"` + motivo; en error mostrar el mensaje
    - Mostrar `<Loader2 />` girando durante la operación (patrón de `EditMontoModal`)
    - Renderizar `{anularSol && <AnularModal .../>}` junto a los demás modales
    - _Requisitos: 7.3, 7.4, 7.5, 8.1, 8.2, 8.3_
  - [ ]* 5.3 Escribir pruebas por ejemplo de la UI
    - Verificar visibilidad del botón solo en estado aprobado; deshabilitado/habilitado del confirmar según longitud del motivo; actualización de la fila tras éxito
    - _Requisitos: 7.1, 7.2, 7.4, 8.1_

- [ ] 6. Punto de control — verificación de tipos y build
  - Ejecutar `npx tsc --noEmit` y `npm run build` y corregir cualquier error
  - Verificación manual de Contabilidad: anular un trámite aprobado y confirmar que desaparece del total y del listado del mes en `/api/admin/contabilidad` sin haber tocado `contabilidad/route.ts`
  - Asegurarse de que todo compila; preguntar al usuario si surgen dudas
  - _Requisitos: 6.1, 6.2_

## Notes

- Las tareas marcadas con `*` son opcionales (pruebas automatizadas) y pueden omitirse para un MVP. El proyecto no tiene framework de pruebas configurado; si se implementan, usar Vitest en modo single-run (`vitest --run`).
- La verificación mínima obligatoria es `tsc --noEmit` + `next build` + la verificación manual de Contabilidad (tarea 6).
- La migración SQL (tarea 1) la ejecuta el usuario en Supabase antes del despliegue del endpoint.
- La anulación aplica por igual a actualizaciones y certificados de actualización (ambos `tipo_formulario = "actualizacion"`).
- No se llama a Nubefact; la boleta se anula manualmente por fuera del sistema.
- Cada tarea referencia requisitos específicos para trazabilidad.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1", "4"] },
    { "id": 1, "tasks": ["2.1"] },
    { "id": 2, "tasks": ["2.2", "3"] },
    { "id": 3, "tasks": ["5.1"] },
    { "id": 4, "tasks": ["5.2"] },
    { "id": 5, "tasks": ["5.3"] }
  ]
}
```
