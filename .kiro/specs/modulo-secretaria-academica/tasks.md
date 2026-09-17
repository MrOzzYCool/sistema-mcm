# Plan de Implementación: Módulo Secretaría de Atención Académica

## Overview

Implementación incremental en tres bloques priorizados: (1) permisos de acceso a Ciclos y Horarios, (2) vista de Cobranza de solo lectura, (3) Exámenes/Sustitutorios con facturación. Cada tarea reutiliza patrones existentes (autorización `verifyAccess`, `RouteGuard`, `NAV_ITEMS`, `installments` + Flujo_Voucher). Lenguaje: TypeScript. Las subtareas marcadas con `*` (tests) son opcionales. La facturación de exámenes está BLOQUEADA hasta que el usuario provea los códigos Nubefact (ver tarea 8).

## Tasks

- [ ] 1. Habilitar acceso del rol a Ciclos y Horarios (permisos/visibilidad)
  - [ ] 1.1 Agregar el rol al `RouteGuard` de la página de ciclos
    - En `src/app/dashboard/ciclos/page.tsx`, agregar `"secretaria_atencion_academica"` a `allowedRoles` (mantener `super_admin`, `cycle_manager`)
    - _Requisitos: 1.1, 1.2, 1.3_

  - [ ] 1.2 Agregar el rol a `ALLOWED_ROLES` de los endpoints de ciclos y horarios
    - Editar `src/app/api/admin/cycle-openings/route.ts`, `cycle-openings/available/route.ts`, `cycle-openings/close/route.ts` y `schedules/route.ts` para incluir `"secretaria_atencion_academica"`
    - _Requisitos: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_

  - [ ] 1.3 Mostrar "Ciclos y Horarios" en el Sidebar para el rol
    - En `src/components/Sidebar.tsx`, agregar `"secretaria_atencion_academica"` a `roles` del ítem `/dashboard/ciclos`
    - _Requisitos: 3.1, 3.2, 3.3_

  - [ ]* 1.4 Tests de autorización de endpoints de ciclos
    - Verificar que el rol es autorizado y que roles no permitidos reciben 403
    - _Requisitos: 2.5, 2.6_

- [ ] 2. Checkpoint — verificar build y acceso a Ciclos
  - Ejecutar `npx tsc --noEmit` y `npm run build`; asegurar que todos los tests pasan y consultar al usuario ante cualquier duda.

- [ ] 3. Vista de Cobranza — endpoint de solo lectura
  - [ ] 3.1 Crear `GET /api/admin/cobranza` con verificación de rol
    - Crear `src/app/api/admin/cobranza/route.ts` con `verifyAccess` (`ALLOWED_ROLES = ["super_admin","secretaria_atencion_academica"]` + fallback email admin); 403 si no autorizado
    - _Requisitos: 5.1, 5.2_

  - [ ] 3.2 Implementar consulta de deuda solo de carrera regular
    - Excluir carreras con `tipo_programa = "actualizacion"`; unir `inscripciones` → `payment_plans` → `installments` (status ∉ paid/exonerado) → `profiles`; agrupar por alumno con `concepto/amount/due_date/status`, `ciclo_actual`, nombre y `total_adeudado`; omitir alumnos sin deuda
    - Reutilizar el patrón de `src/app/api/admin/contabilidad/route.ts`
    - _Requisitos: 5.3, 5.4, 5.5, 5.6, 5.7_

  - [ ] 3.3 Implementar filtros por ciclo y por carrera
    - Aplicar parámetros de consulta `ciclo` y `carrera_id`
    - _Requisitos: 5.8, 5.9_

  - [ ]* 3.4 Tests del endpoint de cobranza
    - Autorización (403), exclusión de actualización, filtro de cuotas, total adeudado y filtros ciclo/carrera
    - _Requisitos: 5.1, 5.2, 5.3, 5.4, 5.7, 5.8, 5.9_

- [ ] 4. Vista de Cobranza — página y navegación
  - [ ] 4.1 Crear la página `/dashboard/cobranza` (solo lectura, intuitiva)
    - Crear `src/app/dashboard/cobranza/page.tsx` con `RouteGuard allowedRoles={["super_admin","secretaria_atencion_academica"]}`; mostrar por alumno nombre, ciclo, cuotas adeudadas (concepto/monto/vencimiento) y total; filtros de ciclo y carrera; estado vacío explícito; sin acciones de modificación
    - _Requisitos: 4.1, 4.3, 6.1, 6.2, 6.3, 6.4_

  - [ ] 4.2 Agregar el ítem "Cobranza" al Sidebar
    - En `src/components/Sidebar.tsx`, agregar ítem `{ href: "/dashboard/cobranza", ... roles: ["super_admin","secretaria_atencion_academica"] }`
    - _Requisitos: 4.2_

- [ ] 5. Checkpoint — verificar build y vista de Cobranza
  - Ejecutar `npx tsc --noEmit` y `npm run build`; asegurar que todos los tests pasan y consultar al usuario ante cualquier duda.

- [ ] 6. Exámenes — endpoint de creación del cargo
  - [ ] 6.1 Crear `POST /api/admin/examenes` con verificación de rol
    - Crear `src/app/api/admin/examenes/route.ts` con `verifyAccess` (`ALLOWED_ROLES = ["super_admin","secretaria_atencion_academica"]` + fallback email admin); 403 si no autorizado
    - _Requisitos: 8.1, 8.2_

  - [ ] 6.2 Implementar creación del Cargo_Examen en `installments`
    - Validar `tipo_examen`; montos 50/80/100; insertar `installment` con `tipo="examen"`, `concepto="<TIPO> - <curso>"`, `status="pending"`, `due_date`, enlazado al `payment_plan` del ciclo actual; rechazar alumnos de actualización (400) y ausencia de plan (400)
    - _Requisitos: 8.3, 8.4, 8.5, 8.6, 8.7, 8.8, 8.9, 8.10_

  - [ ]* 6.3 Tests del endpoint de exámenes
    - Autorización (403), montos por tipo, forma del installment, rechazo de actualización y ausencia de plan
    - _Requisitos: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 8.9, 8.10_

- [ ] 7. Exámenes — página de habilitación e integración con el estado de cuenta
  - [ ] 7.1 Crear la interfaz de habilitación de exámenes
    - Página/pestaña en `/dashboard/cobranza` con el mismo `RouteGuard`; selector de alumno (solo carrera, buscador predictivo estilo `ProfesorCombobox`), selector de curso desde la malla del alumno, selector de tipo de examen (3 opciones con monto visible), y acción que invoca `POST /api/admin/examenes`
    - _Requisitos: 7.1, 7.2, 7.3, 7.4_

  - [ ]* 7.2 Test de integración: visibilidad del cargo en el estado de cuenta
    - Crear un Cargo_Examen y verificar que aparece en `/portal/pagos` del alumno para su ciclo con concepto, monto y vencimiento
    - _Requisitos: 9.1, 9.2_

- [ ] 8. Facturación de exámenes (BLOQUEADA por códigos Nubefact PENDIENTES)
  - [ ] 8.1 Definir y registrar los códigos Nubefact de examen
    - BLOQUEANTE: solicitar al usuario los 3 códigos Nubefact (sustitutorio/recuperación/extraordinario) y registrarlos en `NUBEFACT_CODES` (`src/app/api/admin/voucher-review/route.ts` y donde corresponda), resolviendo por prefijo del concepto de examen; NO usar el código por defecto 16 (MATRÍCULA) para exámenes
    - _Requisitos: 11.1, 11.2, 11.3_

  - [ ] 8.2 Ajustar la resolución de código en la aprobación de vouchers de examen
    - En `voucher-review`, resolver el código de producto por tipo de examen (prefijo del concepto) reutilizando el flujo existente de emisión y marcado a `paid`; sin duplicar lógica de aprobación
    - _Requisitos: 10.1, 10.2, 10.3, 11.3_

  - [ ]* 8.3 Test de integración de facturación de examen (Nubefact mockeado)
    - Aprobar el voucher de un Cargo_Examen y verificar `status="paid"` y datos de comprobante; usa el código Nubefact del examen
    - _Requisitos: 10.2, 10.3_

- [ ] 9. Checkpoint final — verificar build y flujo completo
  - Ejecutar `npx tsc --noEmit` y `npm run build`; asegurar que todos los tests pasan y consultar al usuario ante cualquier duda.

## Notas

- Las subtareas marcadas con `*` son opcionales (tests) y pueden omitirse para un MVP más rápido.
- Cada tarea referencia requisitos específicos para trazabilidad.
- El rol es `secretaria_atencion_academica` (Tatiana), distinto de `secretaria_academica`.
- La columna de estado en `profiles` es `estado` (`activo`/`inactivo`), no `is_active`.
- La tarea 8 está BLOQUEADA hasta que el usuario provea los códigos Nubefact de los exámenes; el monto (50/80/100) sí se conoce.
- Este módulo no aplica testing basado en propiedades (PBT): son cambios de permisos, una consulta de solo lectura y la creación de una fila que reutiliza flujos existentes; se usan tests de ejemplo e integración.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2", "3.1", "6.1"] },
    { "id": 1, "tasks": ["1.3", "1.4", "3.2", "6.2"] },
    { "id": 2, "tasks": ["3.3", "3.4", "6.3", "8.1"] },
    { "id": 3, "tasks": ["4.1", "7.1", "8.2"] },
    { "id": 4, "tasks": ["4.2", "7.2", "8.3"] }
  ]
}
```
