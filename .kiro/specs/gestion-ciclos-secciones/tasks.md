# Plan de Implementación: Gestión de Ciclos y Secciones

## Resumen

Implementar cupo por sección (`tope`), vínculo directo alumna-sección (`cycle_opening_id`), ciclo de vida de sección (`activo → llena → concluido`) y promoción grupal que cierra una sección y avanza en bloque a sus alumnas activas al siguiente ciclo. El orden prioriza: migración de BD y RPC → servicios/endpoints de backend → UI → tests e integración, con checkpoints intermedios. El stack es TypeScript/Next.js 15 (App Router) con Supabase (Postgres), y `fast-check` para property-based tests (config en `vitest.config.ts`). Se reutiliza `generateStudentPaymentPlan` (`src/lib/payment-service.ts`), `generarCursosCiclo`/`cerrarCursosCiclo` (`src/lib/generar-cursos-ciclo.ts`) y `proximoLunes`/`esLunes` (`src/lib/fecha-utils.ts`) sin reescribirlos.

## Tareas

- [x] 1. Finalizar y verificar la migración de base de datos
  - [x] 1.1 Verificar y finalizar `src/db/gestion-ciclos-secciones-schema.sql`
    - Confirmar que agrega `cycle_openings.tope INTEGER NOT NULL DEFAULT 20` y `inscripciones.cycle_opening_id UUID REFERENCES cycle_openings(id)`
    - Confirmar CHECK `chk_cycle_openings_tope` (`tope >= 1`) y CHECK `chk_cycle_openings_status` con valores `('activo','llena','concluido','suspendido')`
    - Confirmar índices `idx_inscripciones_cycle_opening_id` e `idx_cycle_openings_carrera_ciclo_status`
    - Confirmar la RPC `enroll_into_opening` (SELECT ... FOR UPDATE sobre `cycle_openings`, rechazo de estado no `activo` → `SECCION_NO_ADMITE_MATRICULAS`, rechazo de duplicado activo → `MATRICULA_DUPLICADA`, conteo de cupo → `SECCION_LLENA`, insert/update de la inscripción con `cycle_opening_id` y transición a `llena` al alcanzar el tope)
    - Confirmar el backfill de `cycle_opening_id` que vincula solo cuando existe exactamente una apertura candidata por `carrera_id + ciclo_actual == cycle_number`
    - Asegurar que la migración es idempotente (uso de `IF NOT EXISTS`/`DROP CONSTRAINT IF EXISTS`/`CREATE OR REPLACE`)
    - _Requisitos: 1.3, 2.1, 2.4, 3.3, 3.6, 3.7, 5.1, 5.2, 5.5_

  - [x] 1.2 Añadir/actualizar las formas TypeScript del módulo
    - Crear `src/lib/gestion-ciclos-secciones/types.ts` con `CycleOpening` (incluye `tope` y `status: 'activo'|'llena'|'concluido'|'suspendido'`), `Inscripcion` (incluye `cycle_opening_id: string | null`), `EnrollResult` y `PromocionGrupalResult`
    - _Requisitos: 2.1, 2.2, 5.1_

- [x] 2. Actualizar apertura de sección con carrera y tope obligatorios
  - [x] 2.1 Actualizar `POST` en `src/app/api/admin/cycle-openings/route.ts`
    - Hacer `carrera_id` y `tope` obligatorios en el body junto a `cycle_number` y `start_date`
    - Rechazar con 400 si falta `carrera_id` ("la carrera es obligatoria"), si falta `cycle_number`/`start_date`, o si `tope` no es entero `>= 1` ("el tope debe ser un entero mayor o igual a 1")
    - Conservar la numeración automática de `seccion` por rango de carrera (ACT-SEC=210, ACT-IA=80, AA=410, RRHH=10, actualizacion=200, default=1)
    - Fijar `status='activo'` y persistir `carrera_id`, `cycle_number`, `start_date`, `fecha_fin`, `tope`, `seccion`, `created_by`
    - Registrar la apertura en `historial_auditoria` con `accion='aperturar_ciclo'` incluyendo `tope` y `seccion`
    - Mantener el `verifyAccess` existente (roles `super_admin`/`cycle_manager`)
    - _Requisitos: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 11.1_

  - [x]* 2.2 Escribir test unitario de validación de apertura
    - Casos: falta `carrera_id` → 400; `tope` = 0 / negativo / no entero → 400; body válido → 201 con `status='activo'` y `seccion` autogenerada
    - Verificar inserción de auditoría con `tope` y `seccion`
    - _Requisitos: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6_

- [x] 3. Endpoint de secciones disponibles para el desplegable de matrícula
  - [x] 3.1 Crear `GET` en `src/app/api/admin/cycle-openings/available/route.ts`
    - Query params `?carrera_id=...&ciclo=...`
    - Devolver las aperturas con `status='activo'` de esa carrera/ciclo, cada una con `{ seccion, tope, vinculadas, cupos_disponibles }` (conteo de inscripciones activas por `cycle_opening_id`)
    - Aplicar `verifyAccess` (roles `super_admin`/`cycle_manager`); 403 si no autorizado
    - _Requisitos: 3.1, 2.4, 11.1_

  - [x]* 3.2 Escribir test unitario del endpoint available
    - Verificar que solo devuelve secciones `activo`, con `cupos_disponibles = tope - vinculadas`, y 403 sin autorización
    - _Requisitos: 3.1, 2.4, 11.1_

- [x] 4. Matrícula por sección con control de cupo, duplicados y ciclo de vida
  - [x] 4.1 Actualizar `POST` en `src/app/api/admin/enroll-user/route.ts` para usar la RPC `enroll_into_opening`
    - Hacer `cycle_opening_id` requerido en el body (`{ alumno_id, carrera_id, ciclo, cycle_opening_id, fecha_inicio_ciclo? }`); 400 si falta
    - Normalizar la fecha de inicio con `proximoLunes`/`esLunes` de `src/lib/fecha-utils.ts`
    - Llamar a la RPC `enroll_into_opening(...)` (control de estado, duplicado, cupo, insert/update de inscripción con `cycle_opening_id` y transición a `llena`)
    - Tras el vínculo: registrar `historial_ciclos` y generar cursos con `generarCursosCiclo`
    - Mapear errores de la RPC: `SECCION_LLENA` → 409 "la sección alcanzó su tope"; `SECCION_NO_ADMITE_MATRICULAS` → 400 "la sección no admite matrículas"; `MATRICULA_DUPLICADA` → 409 "la alumna ya está matriculada en ese ciclo"; `APERTURA_NO_ENCONTRADA` → 404
    - Mantener el mismo flujo para asignación de alumnas pre-registradas (Req 4)
    - Aplicar `verifyAccess`; 403 si no autorizado
    - _Requisitos: 2.2, 2.3, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 4.1, 4.2, 5.1, 5.2, 5.5, 11.1_

  - [x]* 4.2 Escribir property test para el control de cupo (lógica pura)
    - **Propiedad 1: El tope nunca se excede**
    - Generar `tope` T y N intentos de matrícula; verificar que se aceptan exactamente `min(intentos_válidos, T)` y el conteo activo nunca supera T
    - **Valida: Requisitos 2.4, 3.2, 3.3, 3.7, 8.4**
    - Mínimo 100 iteraciones; `// Feature: gestion-ciclos-secciones, Property 1`

  - [x]* 4.3 Escribir property test para sin matrícula activa duplicada
    - **Propiedad 2: Sin matrícula activa duplicada**
    - Generar intentos repetidos sobre misma alumna/carrera/ciclo; verificar rechazo del segundo sin crear duplicado
    - **Valida: Requisitos 3.6**
    - Mínimo 100 iteraciones

  - [x]* 4.4 Escribir property test para rechazo en secciones no disponibles
    - **Propiedad 3: Rechazo de matrícula en secciones no disponibles**
    - Generar aperturas con estado `llena`/`concluido` o `cupos_disponibles = 0`; verificar rechazo de todo intento
    - **Valida: Requisitos 3.3, 3.5, 5.2, 5.5**
    - Mínimo 100 iteraciones

  - [x]* 4.5 Escribir property test para transición a "llena"
    - **Propiedad 4: Transición a "llena" al alcanzar el tope**
    - Generar secuencias de matrículas hasta el tope; verificar que `status` pasa a `llena` exactamente al alcanzar `tope`
    - **Valida: Requisitos 5.1**
    - Mínimo 100 iteraciones

- [x] 5. Checkpoint — Verificar migración, apertura y matrícula
  - Asegurar que todos los tests pasan, preguntar al usuario si surgen dudas.
  - Verificar que la migración corre sin errores y la RPC existe
  - Verificar que la apertura exige `carrera_id` + `tope` y autogenera `seccion`
  - Verificar que la matrícula respeta cupo, duplicados y ciclo de vida vía la RPC

- [x] 6. Servicio de promoción grupal (lógica de decisión y orquestación)
  - [x] 6.1 Crear el servicio de promoción en `src/lib/gestion-ciclos-secciones/promocion-grupal.ts`
    - Función pura `decidirPromocion(ciclo_actual, duracion_ciclos)` → `'promover'` (incrementa ciclo en 1) o `'egreso'` (marca egresado sin plan ni cursos)
    - Función auxiliar `detectarDeudaPendiente(cuotas)` → true si hay cuota con `status` distinto de `paid`/`exonerado` y `due_date` vencida
    - Estructurar el resultado como `PromocionGrupalResult` (promovidas, egresadas, omitidas, errores, advertencias_deuda, status_final)
    - _Requisitos: 6.3, 6.4, 9.1, 9.2, 10.1_

  - [x]* 6.2 Escribir property test para decisión de promoción vs. egreso
    - **Propiedad 5: Decisión de promoción vs. egreso**
    - Generar pares `(ciclo_actual, duracion_ciclos)`; verificar incremento en 1 si `C < D`, egreso si `C >= D`
    - **Valida: Requisitos 6.3, 6.4, 9.1, 9.2**
    - Mínimo 100 iteraciones

  - [x]* 6.3 Escribir property test para continuidad de montos y beneficios
    - **Propiedad 6: Continuidad de montos y beneficios en la promoción**
    - Generar configuraciones de `student_benefits`; verificar que cada cuota toma el `monto_final` del beneficio activo o el default (matrícula 250, cuota 400)
    - **Valida: Requisitos 7.2, 7.3**
    - Mínimo 100 iteraciones

  - [x]* 6.4 Escribir property test para fechas de vencimiento del plan
    - **Propiedad 7: Fechas de vencimiento del plan de pagos**
    - Generar `start_date` alrededor del día 16 y en fronteras de mes/año; verificar matrícula y cuota 01 al día 01 del mes de inicio, cuotas 02-04 en meses consecutivos, y el corrimiento por corte de fin de mes
    - **Valida: Requisitos 7.4**
    - Mínimo 100 iteraciones

  - [x]* 6.5 Escribir property test para exoneración con monto cero
    - **Propiedad 8: Exoneración con monto cero**
    - Generar beneficios con `monto_final = 0`; verificar cuota con `status='exonerado'` y `fecha_pago` con la fecha del proceso
    - **Valida: Requisitos 7.5**
    - Mínimo 100 iteraciones

- [x] 7. Endpoint de cierre y promoción grupal
  - [x] 7.1 Crear `POST` en `src/app/api/admin/cycle-openings/close/route.ts` (alias `promover-seccion`)
    - Body `{ opening_id: string, confirmar: boolean }`; aplicar `verifyAccess`; 403 si no autorizado
    - Precondición de idempotencia: si la apertura ya está `concluido`, rechazar/reportar sin reprocesar (Req 6.10)
    - Control de concurrencia: como primer paso, transición condicional del estado de la apertura fuera de `activo`/`llena`, de modo que una segunda ejecución concurrente no reprocese (Req 6.12)
    - Identificar todas las inscripciones `estado='activo'` con `cycle_opening_id = opening_id` (Req 6.1)
    - Detectar `Deuda_Pendiente` por alumna para advertencias (Req 10.1)
    - Procesar cada alumna en su propio try/catch (Req 6.7), acumulando errores sin abortar el lote:
      - Si ya fue promovida (inscripción ya en ciclo destino o plan del nuevo ciclo existente) → **omitir** (Req 6.11)
      - Si `ciclo_actual >= duracion_ciclos` → `estado='egresado'`, sin plan ni cursos, auditar egreso (Req 6.4, 9.1, 9.2, 9.3)
      - En caso contrario → `ciclo_actual+1`, `fecha_inicio_ciclo = proximoLunes()`; cerrar `historial_ciclos` anterior (`fecha_fin`, `estado='completado'`, Req 6.6); `cerrarCursosCiclo`; localizar o crear la apertura del nuevo ciclo (Req 8.3) y vincular la inscripción respetando su `tope` vía `enroll_into_opening` (Req 8.2, 8.4); `generateStudentPaymentPlan({ alumnoId, ciclo, year, carreraId })` para conservar montos/beneficios (Req 7.1–7.6); `generarCursosCiclo` (Req 8.1)
      - Si tiene `Deuda_Pendiente`: promover igual, no tocar cuotas impagas, agregar advertencia al resultado y auditoría (Req 10.3, 10.4, 10.5)
    - Marcar la apertura origen `status='concluido'` (Req 6.5); si no había alumnas activas, concluir igual y reportar "sin alumnas por promover" (Req 6.9)
    - Auditar la operación en `historial_auditoria` (Req 6.8) y devolver `PromocionGrupalResult` con promovidas, egresadas, omitidas, errores y advertencias de deuda
    - Auto-crear la apertura del nuevo ciclo si no existe una `activo` para `(carrera_id, cycle_number+1)`, con numeración por rango de carrera y `tope` heredado del origen o 20
    - _Requisitos: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8, 6.9, 6.10, 6.11, 6.12, 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 8.1, 8.2, 8.3, 8.4, 9.1, 9.2, 9.3, 10.1, 10.2, 10.3, 10.4, 10.5, 11.1_

  - [ ]* 7.2 Escribir property test para idempotencia del cierre grupal
    - **Propiedad 9: Idempotencia del cierre grupal**
    - Aplicar el cierre dos veces sobre el mismo estado simulado; verificar ausencia de planes/cursos/actualizaciones duplicados y que la segunda ejecución rechaza u omite a las ya promovidas
    - **Valida: Requisitos 6.10, 6.11, 6.12**
    - Mínimo 100 iteraciones

  - [ ]* 7.3 Escribir property test para conservación de deuda en la promoción
    - **Propiedad 10: La deuda se conserva en la promoción**
    - Generar inscripciones con cuotas vencidas impagas; tras promover, verificar que esas cuotas quedan intactas y hay advertencia en el resultado
    - **Valida: Requisitos 10.3, 10.4, 10.5**
    - Mínimo 100 iteraciones

  - [ ]* 7.4 Escribir tests unitarios del endpoint de cierre
    - Sección con cero alumnas activas → concluye y reporta "sin alumnas por promover" (Req 6.9)
    - Creación de apertura del nuevo ciclo cuando no existe una activa (Req 8.3)
    - Fallo parcial: mock de error en una alumna → las demás se procesan y el error se colecta (Req 6.7)
    - Apertura ya `concluido` → rechazo sin reprocesar (Req 6.10)
    - _Requisitos: 6.7, 6.9, 6.10, 8.3_

- [~] 8. Checkpoint — Verificar promoción grupal
  - Asegurar que todos los tests pasan, preguntar al usuario si surgen dudas.
  - Verificar promoción/egreso, generación de plan y cursos, y vínculo a la nueva sección
  - Verificar idempotencia, fallo parcial y conservación de deuda

- [x] 9. UI: página de ciclos (tope, estado y promoción)
  - [x] 9.1 Agregar campo `tope` y estado de sección en `src/app/dashboard/ciclos/page.tsx`
    - Añadir input `tope` (entero `>= 1`) al formulario de apertura, con validación cliente
    - Mostrar `status` de cada apertura (`activo`/`llena`/`concluido`) con badge
    - Enviar `carrera_id` y `tope` al `POST /api/admin/cycle-openings`
    - _Requisitos: 1.1, 1.3, 5.1, 5.4_

  - [x] 9.2 Implementar modal "Cerrar ciclo y promover"
    - Botón por sección que abre un modal de confirmación
    - Antes de confirmar, mostrar cuáles alumnas tienen `Deuda_Pendiente` (Req 10.2)
    - Al confirmar: llamar a `POST /api/admin/cycle-openings/close` con `{ opening_id, confirmar: true }`
    - Mostrar el resumen del resultado (promovidas, egresadas, omitidas, alumnas con deuda, errores)
    - _Requisitos: 6.2, 10.2, 10.5_

- [x] 10. UI: matrícula con desplegable de sección
  - [x] 10.1 Reemplazar el input de ciclo por desplegable de secciones en `src/app/dashboard/usuarios/page.tsx`
    - Consumir `GET /api/admin/cycle-openings/available?carrera_id=...&ciclo=...`
    - Mostrar cada sección como `vinculadas/tope`; deshabilitar las secciones llenas (`cupos_disponibles = 0`)
    - Al matricular, enviar `cycle_opening_id` al `POST /api/admin/enroll-user`
    - Mostrar mensajes de error mapeados (sección llena, no admite matrículas, matrícula duplicada)
    - _Requisitos: 3.1, 3.2, 3.3, 3.5, 4.1_

- [ ]* 11. Tests de integración (Postgres real/emulado)
  - [ ]* 11.1 Test de concurrencia sobre `enroll_into_opening`
    - Disparar llamadas concurrentes a la RPC sobre la misma apertura; verificar que el conteo final nunca supera `tope`
    - _Requisitos: 3.7, 6.12_

  - [ ]* 11.2 Test de cursos e `historial_ciclos` en la promoción
    - Con malla sembrada, verificar que la promoción crea `alumno_cursos` del nuevo ciclo y cierra el historial anterior
    - _Requisitos: 6.6, 8.1_

  - [ ]* 11.3 Test de auditoría
    - Verificar inserción en `historial_auditoria` para apertura, promoción grupal y egreso
    - _Requisitos: 1.6, 6.8, 9.3_

- [ ]* 12. Tests de control de acceso en endpoints
  - [ ]* 12.1 Escribir tests de autorización para todos los endpoints
    - Verificar 403 sin token o con rol no autorizado en apertura, matrícula, available y cierre
    - Verificar que `DELETE /api/admin/cycle-openings` solo lo permite `super_admin`
    - _Requisitos: 11.1, 11.2_

- [~] 13. Checkpoint final — Verificar integración de extremo a extremo
  - Asegurar que todos los tests pasan, preguntar al usuario si surgen dudas.
  - Verificar apertura con `tope`, matrícula por sección con cupo, ciclo de vida
  - Verificar cierre y promoción grupal con plan, cursos, egreso, deuda e idempotencia
  - Verificar la UI de ciclos y de matrícula
  - Verificar el control de acceso en todos los endpoints

## Notas

- Las tareas marcadas con `*` son opcionales y pueden omitirse para un MVP más rápido
- Cada tarea referencia requisitos específicos para trazabilidad
- Los checkpoints aseguran validación incremental
- Los tests de propiedades usan `fast-check` (mínimo 100 iteraciones) y se etiquetan con `// Feature: gestion-ciclos-secciones, Property N`
- Los tests unitarios validan ejemplos concretos y casos borde; los de integración cubren la capa de I/O (RPC, malla, auditoría)
- Se reutilizan `generateStudentPaymentPlan`, `generarCursosCiclo`/`cerrarCursosCiclo` y `proximoLunes`/`esLunes` sin reescribirlos
- Política de deuda OPCIÓN B: promover con advertencia y conservar cuotas impagas
- La migración `src/db/gestion-ciclos-secciones-schema.sql` es idempotente y segura de re-ejecutar

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2"] },
    { "id": 2, "tasks": ["2.1", "3.1", "4.1", "6.1"] },
    { "id": 3, "tasks": ["2.2", "3.2", "4.2", "4.3", "4.4", "4.5", "6.2", "6.3", "6.4", "6.5"] },
    { "id": 4, "tasks": ["7.1"] },
    { "id": 5, "tasks": ["7.2", "7.3", "7.4", "9.1", "10.1"] },
    { "id": 6, "tasks": ["9.2"] },
    { "id": 7, "tasks": ["11.1", "11.2", "11.3", "12.1"] }
  ]
}
```
