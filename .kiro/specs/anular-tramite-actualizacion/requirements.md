# Requirements Document

## Introduction

En el módulo de Actualización del sistema I.E.S. Margarita Cabrera (que incluye tanto actualizaciones como certificados de actualización) ocasionalmente se registra un trámite duplicado para la misma persona. Cuando ese trámite queda en estado "aprobado" y su boleta ya fue emitida en Nubefact, el sistema no ofrece ninguna forma de dejar sin efecto ese registro. Aunque la boleta se anule manualmente en Nubefact, el registro aprobado sigue sumando en el módulo de Contabilidad.

Esta funcionalidad permite a un administrador **anular** (no eliminar) un trámite de actualización que esté en estado "aprobado". La anulación marca el registro con estado "anulado", conservándolo en el historial, exige un motivo obligatorio, y registra quién realizó la anulación y cuándo. Dado que el módulo de Contabilidad suma únicamente los registros en estado "aprobado", cambiar el estado a "anulado" excluye automáticamente el trámite de los ingresos sin modificar la lógica de Contabilidad. La anulación no interactúa con Nubefact; la boleta se anula manualmente por fuera del sistema.

La funcionalidad aplica por igual a actualizaciones y a certificados de actualización, ya que ambos comparten `tipo_formulario = "actualizacion"` (los certificados se distinguen por `tipo_tramite` que empieza con "CERTIFICADO").

## Glossary

- **Sistema_Anulacion**: Componente del backend (endpoint `src/app/api/admin/solicitudes-ops/route.ts`) responsable de procesar la solicitud de anulación de un trámite de actualización.
- **Sistema_UI_Actualizacion**: Componente de interfaz en `src/app/dashboard/actualizacion/page.tsx` que lista los trámites de actualización y expone las acciones sobre cada fila.
- **Tramite_Actualizacion**: Registro de la tabla `solicitudes` con `tipo_formulario = "actualizacion"`, que abarca tanto actualizaciones como certificados de actualización.
- **Usuario_Autorizado**: Usuario autenticado cuyo correo pertenece a ADMIN_EMAILS (`admin@`, `staff@`, `nvasquez@`, `milnarvaez@margaritacabrera.edu.pe`) o cuyo rol en `profiles` es uno de: `super_admin`, `staff_tramites`, `gestor`, `actualizacion`.
- **Estado_Aprobado**: Valor `"aprobado"` del campo `estado` de un trámite, que indica que el trámite es válido y es contabilizado como ingreso.
- **Estado_Anulado**: Valor `"anulado"` del campo `estado` de un trámite, que indica que el trámite quedó sin efecto y no debe contabilizarse.
- **Motivo_Anulacion**: Texto libre obligatorio, con una longitud mínima de 3 caracteres, que explica la razón de la anulación.
- **Sistema_Contabilidad**: Componente en `src/app/api/admin/contabilidad/route.ts` que calcula los ingresos filtrando `solicitudes` por `estado = "aprobado"`.

## Requirements

### Requisito 1 — Acceso autorizado a la anulación

**Historia de usuario:** Como administrador del módulo de Actualización, quiero que solo usuarios autorizados puedan anular trámites, para que la operación quede restringida al personal habilitado.

#### Criterios de Aceptación

1. WHEN se recibe una solicitud de anulación con un token de un Usuario_Autorizado, THE Sistema_Anulacion SHALL procesar la solicitud de anulación.
2. IF se recibe una solicitud de anulación sin token o con un token que no corresponde a un Usuario_Autorizado, THEN THE Sistema_Anulacion SHALL rechazar la solicitud con código de estado HTTP 403 y un mensaje "No autorizado".

### Requisito 2 — Anulación permitida solo desde estado aprobado

**Historia de usuario:** Como administrador, quiero que solo se puedan anular trámites que estén en estado "aprobado", para evitar anular trámites que aún están en proceso o ya rechazados.

#### Criterios de Aceptación

1. WHEN un Usuario_Autorizado solicita anular un Tramite_Actualizacion que se encuentra en Estado_Aprobado, THE Sistema_Anulacion SHALL cambiar el estado del trámite a Estado_Anulado.
2. IF un Usuario_Autorizado solicita anular un Tramite_Actualizacion cuyo estado actual es distinto de Estado_Aprobado, THEN THE Sistema_Anulacion SHALL rechazar la solicitud con código de estado HTTP 400 y un mensaje indicando que solo se pueden anular trámites aprobados.
3. IF un Usuario_Autorizado solicita anular un Tramite_Actualizacion cuyo identificador no existe, THEN THE Sistema_Anulacion SHALL rechazar la solicitud con código de estado HTTP 404 y un mensaje indicando que el trámite no existe.

### Requisito 3 — Motivo de anulación obligatorio

**Historia de usuario:** Como administrador, quiero que al anular un trámite se exija un motivo, para que quede registrado por qué se dejó sin efecto.

#### Criterios de Aceptación

1. WHEN un Usuario_Autorizado solicita anular un Tramite_Actualizacion incluyendo un Motivo_Anulacion con al menos 3 caracteres no vacíos, THE Sistema_Anulacion SHALL aceptar el Motivo_Anulacion y continuar con la anulación.
2. IF un Usuario_Autorizado solicita anular un Tramite_Actualizacion sin Motivo_Anulacion o con un Motivo_Anulacion de menos de 3 caracteres no vacíos, THEN THE Sistema_Anulacion SHALL rechazar la solicitud con código de estado HTTP 400 y un mensaje indicando que el motivo es obligatorio.

### Requisito 4 — Registro de datos de auditoría de la anulación

**Historia de usuario:** Como administrador, quiero que al anular un trámite se guarde el motivo, quién lo anuló y cuándo, para conservar la trazabilidad en el historial.

#### Criterios de Aceptación

1. WHEN THE Sistema_Anulacion cambia un Tramite_Actualizacion a Estado_Anulado, THE Sistema_Anulacion SHALL almacenar el Motivo_Anulacion en el campo `motivo_anulacion` del trámite.
2. WHEN THE Sistema_Anulacion cambia un Tramite_Actualizacion a Estado_Anulado, THE Sistema_Anulacion SHALL almacenar el correo o identificador del Usuario_Autorizado que realizó la anulación en el campo `anulado_por` del trámite.
3. WHEN THE Sistema_Anulacion cambia un Tramite_Actualizacion a Estado_Anulado, THE Sistema_Anulacion SHALL almacenar la marca de tiempo del momento de la anulación en el campo `anulado_at` del trámite.

### Requisito 5 — Conservación del historial

**Historia de usuario:** Como administrador, quiero que el trámite anulado se conserve en el sistema marcado como "Anulado", para no perder el historial del registro.

#### Criterios de Aceptación

1. WHEN THE Sistema_Anulacion anula un Tramite_Actualizacion, THE Sistema_Anulacion SHALL conservar el registro en la tabla `solicitudes` manteniendo sus campos existentes (nombres, apellidos, monto_pagado, voucher_url, pdf_boleta_url, created_at, entre otros).
2. WHEN THE Sistema_UI_Actualizacion lista los trámites, THE Sistema_UI_Actualizacion SHALL mostrar los trámites en Estado_Anulado con una etiqueta "Anulado".

### Requisito 6 — Exclusión automática de Contabilidad

**Historia de usuario:** Como personal de contabilidad, quiero que los trámites anulados dejen de contar como ingresos, para que los montos reflejen solo los trámites válidos.

#### Criterios de Aceptación

1. WHILE un Tramite_Actualizacion se encuentra en Estado_Anulado, THE Sistema_Contabilidad SHALL excluir el monto de ese trámite del total de ingresos de actualizaciones.
2. WHILE un Tramite_Actualizacion se encuentra en Estado_Anulado, THE Sistema_Contabilidad SHALL excluir ese trámite del listado de ingresos retornado.

### Requisito 7 — Visibilidad y disparo de la acción Anular en la interfaz

**Historia de usuario:** Como administrador, quiero ver el botón "Anular" solo en los trámites aprobados y confirmar el motivo antes de anular, para evitar anulaciones accidentales.

#### Criterios de Aceptación

1. WHERE un Tramite_Actualizacion se encuentra en Estado_Aprobado, THE Sistema_UI_Actualizacion SHALL mostrar una acción "Anular" en la fila del trámite.
2. WHERE un Tramite_Actualizacion se encuentra en un estado distinto de Estado_Aprobado, THE Sistema_UI_Actualizacion SHALL ocultar la acción "Anular" en la fila del trámite.
3. WHEN el Usuario_Autorizado activa la acción "Anular", THE Sistema_UI_Actualizacion SHALL mostrar un diálogo que solicita el Motivo_Anulacion.
4. WHILE el campo de Motivo_Anulacion del diálogo tiene menos de 3 caracteres no vacíos, THE Sistema_UI_Actualizacion SHALL mantener deshabilitada la acción de confirmación de la anulación.
5. WHEN el Usuario_Autorizado confirma la anulación en el diálogo con un Motivo_Anulacion válido, THE Sistema_UI_Actualizacion SHALL enviar la solicitud de anulación al Sistema_Anulacion incluyendo el identificador del trámite y el Motivo_Anulacion.

### Requisito 8 — Retroalimentación al usuario en la interfaz

**Historia de usuario:** Como administrador, quiero recibir confirmación o mensaje de error tras intentar anular, para saber si la operación tuvo éxito.

#### Criterios de Aceptación

1. WHEN THE Sistema_Anulacion confirma una anulación exitosa, THE Sistema_UI_Actualizacion SHALL actualizar la fila del trámite para mostrar la etiqueta "Anulado" y el Motivo_Anulacion registrado.
2. IF THE Sistema_Anulacion rechaza la solicitud de anulación, THEN THE Sistema_UI_Actualizacion SHALL mostrar el mensaje de error devuelto por el Sistema_Anulacion.
3. WHILE la solicitud de anulación está en curso, THE Sistema_UI_Actualizacion SHALL mostrar un indicador de carga en la acción de confirmación.
