# Documento de Requisitos

## Introducción

Este módulo habilita el rol `secretaria_atencion_academica` (usuaria de referencia: Tatiana) dentro del sistema del I.E.S. Privada Margarita Cabrera (Next.js 15 App Router + Supabase, TypeScript). El objetivo es dotar a este rol —no técnico— de tres capacidades, priorizando una experiencia MUY INTUITIVA:

1. **Ciclos y Horarios (ya existe):** dar acceso al módulo existente `/dashboard/ciclos` (aperturar/cerrar ciclos, asignar profesores y horarios). Aquí el trabajo es únicamente de permisos y visibilidad; no se rediseña el módulo.
2. **Vista de Cobranza (nueva):** una página de solo lectura para rastrear alumnos de CARRERA regular (excluyendo programas de actualización) con deuda pendiente, con filtros por ciclo y por carrera.
3. **Exámenes / Sustitutorios (nuevo, con facturación):** permitir habilitar manualmente exámenes de pago a un alumno concreto (sustitutorio S/ 50, recuperación S/ 80, extraordinario S/ 100), creando un cargo que el alumno ve en su estado de cuenta y paga/factura reutilizando el flujo de vouchers y Nubefact existente.

El diseño reutiliza los patrones existentes del proyecto: autorización con `verifyAccess`/`verifyStaff` sobre `profiles.rol` con fallback al email admin, protección de páginas con `RouteGuard`, navegación con `NAV_ITEMS` en `Sidebar.tsx`, y facturación con `installments` + `payment_vouchers` + `nubefactService`.

## Glosario

- **Sistema:** La aplicación web del I.E.S. Margarita Cabrera (Next.js + Supabase).
- **Secretaria_Academica:** Usuario con `profiles.rol = "secretaria_atencion_academica"` (Tatiana). En este documento se refiere siempre a este rol, distinto de `secretaria_academica`.
- **Super_Admin:** Usuario con `profiles.rol = "super_admin"` o el email admin `admin@margaritacabrera.edu.pe`.
- **Alumno_Carrera:** Alumno inscrito en una carrera cuyo `carreras.tipo_programa` es distinto de `"actualizacion"`.
- **Programa_Actualizacion:** Carrera con `carreras.tipo_programa = "actualizacion"`, que queda EXCLUIDA de la vista de cobranza y de la habilitación de exámenes.
- **Cargo_Examen:** Registro en la tabla `installments` que representa un examen de pago habilitado a un alumno, enlazado al `payment_plan` de su ciclo actual.
- **Cuota_Pendiente:** Registro en `installments` cuyo `status` es distinto de `"paid"` y de `"exonerado"`.
- **Flujo_Voucher:** El flujo existente por el cual un alumno sube un comprobante de pago (`payment_vouchers`), el staff lo aprueba en `voucher-review` y se emite la boleta/factura vía Nubefact.
- **Nubefact:** Servicio externo de facturación electrónica (`src/lib/nubefactService.ts`, `generarBoleta`).
- **Codigo_Nubefact:** Código de producto Nubefact, HARDCODEADO en el código (mapa `NUBEFACT_CODES`), no en base de datos.
- **RouteGuard:** Componente (`src/components/RouteGuard.tsx`) que protege páginas mediante la prop `allowedRoles`.

## Requisitos

### Requisito 1: Acceso del rol a Ciclos y Horarios (página)

**Historia de usuario:** Como Secretaria_Academica, quiero acceder al módulo existente de Ciclos y Horarios, para poder aperturar/cerrar ciclos y asignar profesores y horarios.

#### Criterios de Aceptación

1. WHERE el usuario autenticado tiene `profiles.rol = "secretaria_atencion_academica"`, THE Sistema SHALL permitir el renderizado de la página `/dashboard/ciclos` a través del `RouteGuard`.
2. THE Sistema SHALL incluir `"secretaria_atencion_academica"` en la prop `allowedRoles` del `RouteGuard` de la página `/dashboard/ciclos`, manteniendo `"super_admin"` y `"cycle_manager"`.
3. IF un usuario cuyo rol no está en `allowedRoles` intenta acceder a `/dashboard/ciclos`, THEN THE Sistema SHALL impedir el acceso mediante el `RouteGuard`.

### Requisito 2: Acceso del rol a los endpoints de Ciclos y Horarios

**Historia de usuario:** Como Secretaria_Academica, quiero que las operaciones de ciclos y horarios funcionen para mi rol, para poder guardar aperturas, cierres y horarios sin errores de autorización.

#### Criterios de Aceptación

1. THE Sistema SHALL incluir `"secretaria_atencion_academica"` en el arreglo `ALLOWED_ROLES` del endpoint `src/app/api/admin/cycle-openings/route.ts`.
2. THE Sistema SHALL incluir `"secretaria_atencion_academica"` en el arreglo `ALLOWED_ROLES` del endpoint `src/app/api/admin/cycle-openings/available/route.ts`.
3. THE Sistema SHALL incluir `"secretaria_atencion_academica"` en el arreglo `ALLOWED_ROLES` del endpoint `src/app/api/admin/cycle-openings/close/route.ts`.
4. THE Sistema SHALL incluir `"secretaria_atencion_academica"` en el arreglo `ALLOWED_ROLES` del endpoint `src/app/api/admin/schedules/route.ts`.
5. WHEN un usuario con rol `"secretaria_atencion_academica"` invoca cualquiera de los endpoints de ciclos y horarios listados, THE Sistema SHALL autorizar la petición.
6. IF un usuario cuyo rol no está en `ALLOWED_ROLES` (y no es el email admin) invoca cualquiera de estos endpoints, THEN THE Sistema SHALL responder con estado HTTP 403 y cuerpo `{ error: "No autorizado" }`.

### Requisito 3: Visibilidad del ítem "Ciclos y Horarios" en el Sidebar

**Historia de usuario:** Como Secretaria_Academica, quiero ver "Ciclos y Horarios" en el menú lateral, para encontrar el módulo sin ayuda técnica.

#### Criterios de Aceptación

1. WHERE el usuario tiene rol `"secretaria_atencion_academica"`, THE Sistema SHALL mostrar el ítem "Ciclos y Horarios" en el `Sidebar`.
2. THE Sistema SHALL incluir `"secretaria_atencion_academica"` en la propiedad `roles` del ítem `NAV_ITEMS` cuyo `href` es `/dashboard/ciclos`.
3. WHERE el usuario NO tiene un rol listado en el ítem, THE Sistema SHALL ocultar el ítem "Ciclos y Horarios" del `Sidebar`.

### Requisito 4: Acceso a la Vista de Cobranza

**Historia de usuario:** Como Secretaria_Academica, quiero una página de cobranza accesible desde el menú, para rastrear alumnos morosos de carrera.

#### Criterios de Aceptación

1. THE Sistema SHALL exponer una página `/dashboard/cobranza` protegida por `RouteGuard` con `allowedRoles` que incluya `"secretaria_atencion_academica"` y `"super_admin"`.
2. THE Sistema SHALL mostrar en el `Sidebar` un ítem "Cobranza" cuyo `roles` incluya `"secretaria_atencion_academica"` y `"super_admin"`.
3. IF un usuario cuyo rol no está autorizado intenta acceder a `/dashboard/cobranza`, THEN THE Sistema SHALL impedir el acceso mediante el `RouteGuard`.

### Requisito 5: Endpoint de Cobranza (solo lectura, solo carrera)

**Historia de usuario:** Como Secretaria_Academica, quiero consultar la deuda pendiente de alumnos de carrera, para identificar morosos con precisión.

#### Criterios de Aceptación

1. THE Sistema SHALL exponer un endpoint `GET /api/admin/cobranza` que verifique el rol y autorice únicamente a `"secretaria_atencion_academica"`, `"super_admin"` y al email admin.
2. IF un usuario no autorizado invoca `GET /api/admin/cobranza`, THEN THE Sistema SHALL responder con estado HTTP 403 y cuerpo `{ error: "No autorizado" }`.
3. WHEN se consulta la cobranza, THE Sistema SHALL incluir únicamente alumnos cuya carrera tiene `carreras.tipo_programa` distinto de `"actualizacion"`.
4. WHEN se calcula la deuda de un alumno, THE Sistema SHALL incluir únicamente cuotas cuyo `installments.status` es distinto de `"paid"` y distinto de `"exonerado"`.
5. WHEN se retorna la deuda de un alumno, THE Sistema SHALL incluir por cada cuota pendiente: `concepto`, `amount`, `due_date` y `status`.
6. WHEN se retorna la información de un alumno con deuda, THE Sistema SHALL incluir el `nombre_completo` (desde `profiles`) y el ciclo actual (desde `inscripciones.ciclo_actual`).
7. WHEN se retorna la deuda de un alumno, THE Sistema SHALL calcular el total adeudado como la suma de los `amount` de las cuotas pendientes de ese alumno.
8. WHERE se recibe el parámetro de consulta `ciclo`, THE Sistema SHALL retornar únicamente alumnos cuyo ciclo actual coincide con el valor indicado.
9. WHERE se recibe el parámetro de consulta `carrera_id`, THE Sistema SHALL retornar únicamente alumnos inscritos en la carrera indicada.

### Requisito 6: Presentación intuitiva de la Cobranza

**Historia de usuario:** Como Secretaria_Academica no técnica, quiero ver la cobranza de forma clara y sencilla, para entenderla sin capacitación.

#### Criterios de Aceptación

1. WHEN la página de cobranza recibe datos, THE Sistema SHALL mostrar por cada alumno con deuda: nombre, ciclo actual, lista de conceptos/cuotas adeudadas con monto y fecha de vencimiento, y el total adeudado.
2. THE Sistema SHALL ofrecer un control de filtro por ciclo y un control de filtro por carrera en la página de cobranza.
3. WHEN no existen alumnos con deuda para los filtros aplicados, THE Sistema SHALL mostrar un mensaje explícito indicando que no hay alumnos con deuda pendiente.
4. THE Sistema SHALL presentar la vista de cobranza en modo de solo lectura, sin ofrecer acciones de modificación sobre las cuotas.

### Requisito 7: Acceso a la habilitación de Exámenes

**Historia de usuario:** Como Secretaria_Academica, quiero una interfaz para habilitar exámenes de pago a un alumno, para gestionar sustitutorios, recuperaciones y extraordinarios.

#### Criterios de Aceptación

1. THE Sistema SHALL exponer una interfaz de habilitación de exámenes accesible para `"secretaria_atencion_academica"` y `"super_admin"`.
2. WHEN la Secretaria_Academica abre la interfaz de exámenes, THE Sistema SHALL permitir seleccionar un Alumno_Carrera, un curso de la malla del alumno y un tipo de examen.
3. THE Sistema SHALL ofrecer exactamente tres tipos de examen: examen sustitutorio, examen de recuperación y examen extraordinario.
4. WHERE el usuario no está autorizado, THE Sistema SHALL impedir el acceso a la interfaz de habilitación de exámenes.

### Requisito 8: Creación del Cargo de Examen

**Historia de usuario:** Como Secretaria_Academica, quiero que al habilitar un examen se genere un cargo por el monto correcto, para que el alumno pueda pagarlo.

#### Criterios de Aceptación

1. THE Sistema SHALL exponer un endpoint `POST /api/admin/examenes` que verifique el rol y autorice únicamente a `"secretaria_atencion_academica"`, `"super_admin"` y al email admin.
2. IF un usuario no autorizado invoca `POST /api/admin/examenes`, THEN THE Sistema SHALL responder con estado HTTP 403 y cuerpo `{ error: "No autorizado" }`.
3. WHEN se habilita un examen sustitutorio, THE Sistema SHALL crear un Cargo_Examen con `amount = 50.00`.
4. WHEN se habilita un examen de recuperación, THE Sistema SHALL crear un Cargo_Examen con `amount = 80.00`.
5. WHEN se habilita un examen extraordinario, THE Sistema SHALL crear un Cargo_Examen con `amount = 100.00`.
6. WHEN se crea un Cargo_Examen, THE Sistema SHALL registrarlo en la tabla `installments` con `tipo = "examen"`, enlazado al `payment_plan` del ciclo actual del alumno, con `status = "pending"`.
7. WHEN se crea un Cargo_Examen, THE Sistema SHALL asignar un `concepto` que describa el tipo de examen y el curso (por ejemplo, "EXAMEN SUSTITUTORIO - <curso>").
8. WHEN se crea un Cargo_Examen, THE Sistema SHALL asignar una fecha de vencimiento (`due_date`) al cargo.
9. IF el alumno seleccionado pertenece a un Programa_Actualizacion, THEN THE Sistema SHALL rechazar la creación del cargo con un error explicativo.
10. IF el alumno seleccionado no tiene un `payment_plan` para su ciclo actual, THEN THE Sistema SHALL responder con un error explicativo sin crear el cargo.

### Requisito 9: Visibilidad del Cargo de Examen en el estado de cuenta del alumno

**Historia de usuario:** Como alumno, quiero ver el cargo del examen habilitado en mi estado de cuenta, para poder pagarlo como cualquier otra cuota.

#### Criterios de Aceptación

1. WHEN un Cargo_Examen existe en el `payment_plan` del ciclo actual del alumno, THE Sistema SHALL mostrarlo en el estado de cuenta del alumno en `/portal/pagos` al seleccionar ese ciclo.
2. WHEN se muestra un Cargo_Examen en el estado de cuenta, THE Sistema SHALL mostrar su `concepto`, su `amount` y su `due_date`.

### Requisito 10: Pago, aprobación y facturación del Examen reutilizando el flujo existente

**Historia de usuario:** Como alumno, quiero pagar el examen subiendo mi voucher como con cualquier cuota, para recibir mi boleta o factura.

#### Criterios de Aceptación

1. WHEN el alumno sube un voucher para un Cargo_Examen, THE Sistema SHALL registrarlo mediante el Flujo_Voucher existente (`payment_vouchers` enlazado por `installment_id`).
2. WHEN el staff aprueba el voucher de un Cargo_Examen en `voucher-review`, THE Sistema SHALL emitir el comprobante vía Nubefact y marcar el `installments.status` del cargo como `"paid"`, reutilizando el flujo existente.
3. THE Sistema SHALL reutilizar el Flujo_Voucher sin duplicar la lógica de aprobación, emisión de comprobante ni actualización de estado.

### Requisito 11: Códigos Nubefact de los exámenes (PENDIENTE bloqueante)

**Historia de usuario:** Como responsable de facturación, quiero que los códigos Nubefact de los exámenes se definan antes de facturar, para que las boletas se emitan con el código de producto correcto.

#### Criterios de Aceptación

1. THE Sistema SHALL tratar los Codigo_Nubefact de los tres tipos de examen como un valor de configuración PENDIENTE, documentado en el diseño y marcado como bloqueante en las tareas.
2. WHEN los Codigo_Nubefact de examen sean provistos por el usuario, THE Sistema SHALL registrarlos en el mapa `NUBEFACT_CODES` (en `src/app/api/admin/voucher-review/route.ts` y donde corresponda) asociados a los conceptos de examen.
3. IF se intenta facturar un Cargo_Examen sin un Codigo_Nubefact específico definido para su concepto, THEN THE Sistema SHALL evitar emitir con un código incorrecto (por ejemplo, no usar silenciosamente el código de MATRÍCULA por defecto).

## Notas

- El rol relevante es `secretaria_atencion_academica` (Tatiana), que NO debe confundirse con el rol existente `secretaria_academica`.
- La columna real de estado en `profiles` es `estado` (`"activo"`/`"inactivo"`), NO `is_active`.
- La verificación de build del proyecto es `npx tsc --noEmit` y `npm run build`; ambos deben pasar.
