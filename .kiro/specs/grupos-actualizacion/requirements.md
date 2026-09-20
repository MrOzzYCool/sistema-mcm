# Documento de Requisitos

## Introducción

El módulo de **Actualización** del sistema I.E.S. Privada Margarita Cabrera ofrece programas cortos (cada uno dura aproximadamente 2 meses). Hoy el catálogo de programas está fijo en el código (`ACTUALIZACIONES_CATALOGO` en `src/lib/mock-data.ts`) con dos programas: "IA PRÁCTICA PARA LA GESTIÓN ADMINISTRATIVA MODERNA" (id `ac1`) y "GESTIÓN SECRETARIAL EJECUTIVA" (id `ac2`).

Las inscripciones se guardan en la tabla `solicitudes` con `tipo_formulario = 'actualizacion'` y `tipo_tramite` = nombre (label) del programa. El problema es que **no existe ningún campo que identifique el grupo o la tanda** de la inscripción. Cuando entra un nuevo grupo del mismo programa, las inscripciones se mezclan con las del grupo anterior en el panel, y no hay forma de separarlas ni de saber cuándo se dejó de recibir inscripciones para una tanda.

Esta funcionalidad introduce el concepto de **Grupo de Actualización** (una tanda), modelado como una apertura que se puede abrir y cerrar, de forma análoga (pero más simple) a las aperturas de ciclo de carrera existentes (`cycle_openings`). Cada inscripción de actualización quedará vinculada al grupo activo del programa correspondiente, el formulario público solo ofrecerá los programas que tengan un grupo activo, y el panel permitirá filtrar las inscripciones por grupo, incluyendo los grupos cerrados como histórico.

## Glosario

- **Grupo de Actualización (Grupo / Tanda)**: Registro que representa una tanda de un programa de actualización. Tiene un programa asociado, fecha de inicio, fecha de cierre de inscripción (informativa) y un estado (`activo` o `cerrado`). Se persiste en la tabla `grupos_actualizacion`.
- **Programa de Actualización (Programa)**: Uno de los ítems del catálogo `ACTUALIZACIONES_CATALOGO`, identificado por su `id` (por ejemplo `ac1`, `ac2`) y su `label`.
- **Catálogo de Programas**: La constante `ACTUALIZACIONES_CATALOGO` en `src/lib/mock-data.ts`.
- **Solicitud**: Registro de la tabla `solicitudes` (`SolicitudDB` en `src/lib/supabase.ts`) que representa una inscripción o trámite.
- **Inscripción de Actualización**: Solicitud con `tipo_formulario = 'actualizacion'`.
- **Formulario_Publico**: Página pública sin autenticación `src/app/actualizaciones/page.tsx` donde una persona se inscribe a un programa de actualización.
- **Panel_Actualizacion**: Página administrativa `src/app/dashboard/actualizacion/page.tsx` donde se gestionan las inscripciones.
- **API_Grupos**: Endpoint de administración para listar, aperturar y cerrar grupos (`/api/admin/grupos-actualizacion`).
- **API_Programas_Activos**: Endpoint que informa qué programas tienen un grupo activo, para consumo del Formulario_Publico.
- **Registro_Manual**: Acción del Panel_Actualizacion mediante la cual una persona autorizada registra una inscripción a mano.
- **Sistema**: El conjunto del backend (endpoints y base de datos) y frontend de la funcionalidad de grupos de actualización.
- **Rol_Autorizado**: Un usuario cuyo `profiles.rol` sea `super_admin` o `actualizacion`, o el correo administrador `admin@margaritacabrera.edu.pe`.
- **grupo_actualizacion_id**: Columna nueva, nullable, en la tabla `solicitudes`, que referencia el `id` del grupo al que pertenece la inscripción.
- **Grupo Vencido**: Grupo cuyo estado es `activo` pero cuya `fecha_cierre_inscripcion` ya pasó. Es solo un aviso visual; el grupo sigue recibiendo inscripciones hasta que se cierre manualmente.

## Requisitos

### Requisito 1: Aperturar un grupo de actualización

**Historia de usuario:** Como encargada de actualización, quiero aperturar un grupo (tanda) para un programa, para empezar a recibir inscripciones de esa tanda de forma separada de las anteriores.

#### Criterios de Aceptación

1. WHEN un Rol_Autorizado envía una solicitud de apertura con un programa del catálogo, una fecha de inicio y una fecha de cierre de inscripción, THE API_Grupos SHALL crear un Grupo de Actualización con estado `activo` asociado a ese programa.
2. THE API_Grupos SHALL almacenar en cada grupo el identificador del programa (`programa_id`) y el nombre del programa (`programa_label`) tomados del Catálogo de Programas.
3. IF ya existe un Grupo de Actualización con estado `activo` para el mismo programa, THEN THE API_Grupos SHALL rechazar la apertura con un código de error y un mensaje que indique que ya hay un grupo activo para ese programa.
4. IF la solicitud de apertura no incluye un `programa_id` presente en el Catálogo de Programas, THEN THE API_Grupos SHALL rechazar la apertura con un mensaje de error de validación.
5. IF la solicitud de apertura no incluye una fecha de inicio válida, THEN THE API_Grupos SHALL rechazar la apertura con un mensaje de error de validación.
6. WHEN un grupo es creado, THE API_Grupos SHALL registrar el identificador del usuario que lo creó (`created_by`) y la fecha de creación (`created_at`).

### Requisito 2: Cerrar un grupo de actualización manualmente

**Historia de usuario:** Como encargada de actualización, quiero cerrar un grupo manualmente, para dejar de recibir inscripciones en esa tanda y poder aperturar una nueva cuando corresponda.

#### Criterios de Aceptación

1. WHEN un Rol_Autorizado solicita cerrar un grupo con estado `activo`, THE API_Grupos SHALL cambiar el estado de ese grupo a `cerrado`.
2. WHILE un grupo tiene estado `cerrado`, THE Sistema SHALL impedir que nuevas inscripciones queden vinculadas a ese grupo.
3. WHEN un grupo con estado `activo` tiene una `fecha_cierre_inscripcion` anterior a la fecha actual, THE Panel_Actualizacion SHALL mostrar ese grupo con un indicador de "vencido".
4. WHILE un grupo con estado `activo` está vencido, THE Sistema SHALL continuar aceptando inscripciones en ese grupo hasta que sea cerrado manualmente.
5. IF un Rol_Autorizado solicita cerrar un grupo que ya tiene estado `cerrado`, THEN THE API_Grupos SHALL responder indicando que el grupo ya está cerrado.

### Requisito 3: Formulario público que solo ofrece programas con grupo activo

**Historia de usuario:** Como persona interesada en un programa de actualización, quiero ver en el formulario público solo los programas que están recibiendo inscripciones, para no intentar inscribirme en un programa sin tanda abierta.

#### Criterios de Aceptación

1. WHEN el Formulario_Publico se carga, THE API_Programas_Activos SHALL devolver la lista de programas que tienen exactamente un grupo con estado `activo`.
2. THE Formulario_Publico SHALL mostrar como opciones seleccionables únicamente los programas devueltos por la API_Programas_Activos.
3. IF ningún programa tiene un grupo con estado `activo`, THEN THE Formulario_Publico SHALL indicar que no hay programas disponibles para inscripción en este momento.
4. WHERE un programa no tiene un grupo con estado `activo`, THE Formulario_Publico SHALL omitir ese programa de las opciones seleccionables.

### Requisito 4: Asignación automática de la inscripción al grupo activo

**Historia de usuario:** Como encargada de actualización, quiero que cada inscripción pública quede vinculada automáticamente al grupo activo del programa elegido, para que las inscripciones se agrupen por tanda sin intervención manual.

#### Criterios de Aceptación

1. WHEN una persona envía una inscripción desde el Formulario_Publico para un programa, THE Sistema SHALL vincular la Solicitud creada al grupo con estado `activo` de ese programa, guardando su identificador en `grupo_actualizacion_id`.
2. IF al momento de recibir una inscripción el programa seleccionado no tiene un grupo con estado `activo`, THEN THE Sistema SHALL rechazar la inscripción con un mensaje que indique que no hay una tanda abierta para ese programa.
3. THE Sistema SHALL asignar la inscripción al único grupo `activo` del programa, sin requerir que la persona elija el grupo.

### Requisito 5: Registro manual con selección de grupo

**Historia de usuario:** Como encargada de actualización, quiero elegir a qué grupo va una inscripción cuando la registro manualmente, para poder asignar inscripciones a la tanda correcta (incluso a un grupo distinto del activo).

#### Criterios de Aceptación

1. WHEN un Rol_Autorizado abre el Registro_Manual, THE Panel_Actualizacion SHALL mostrar la lista de grupos disponibles para asociar la inscripción.
2. WHEN un Rol_Autorizado registra manualmente una inscripción seleccionando un grupo, THE Sistema SHALL crear la Solicitud vinculada al `grupo_actualizacion_id` seleccionado.
3. IF un Rol_Autorizado intenta guardar un Registro_Manual sin seleccionar un grupo, THEN THE Panel_Actualizacion SHALL impedir el guardado y solicitar la selección de un grupo.
4. THE Registro_Manual SHALL derivar el programa (`tipo_tramite`) de la inscripción a partir del programa del grupo seleccionado.

### Requisito 6: Filtrar inscripciones por grupo en el panel

**Historia de usuario:** Como encargada de actualización, quiero filtrar y ver las inscripciones por grupo (incluyendo los grupos cerrados), para revisar cada tanda por separado y consultar el histórico.

#### Criterios de Aceptación

1. WHEN un Rol_Autorizado abre el Panel_Actualizacion, THE Panel_Actualizacion SHALL permitir filtrar las inscripciones por grupo.
2. WHEN un Rol_Autorizado selecciona un grupo, THE Panel_Actualizacion SHALL mostrar únicamente las inscripciones cuyo `grupo_actualizacion_id` coincide con el grupo seleccionado.
3. THE Panel_Actualizacion SHALL incluir en el filtro tanto los grupos con estado `activo` como los grupos con estado `cerrado`.
4. WHERE existan inscripciones sin `grupo_actualizacion_id`, THE Panel_Actualizacion SHALL ofrecer una opción para ver las inscripciones "sin agrupar".
5. THE Panel_Actualizacion SHALL mostrar para cada grupo su programa, su estado (`activo` o `cerrado`) y sus fechas.

### Requisito 7: Control de acceso

**Historia de usuario:** Como institución, quiero que solo el personal autorizado gestione los grupos de actualización, para mantener el control sobre las aperturas y cierres de tandas.

#### Criterios de Aceptación

1. WHEN una petición a la API_Grupos incluye un token de un usuario con `profiles.rol` igual a `super_admin` o `actualizacion`, THE API_Grupos SHALL autorizar la operación.
2. WHEN una petición a la API_Grupos proviene del correo administrador `admin@margaritacabrera.edu.pe`, THE API_Grupos SHALL autorizar la operación.
3. IF una petición a la API_Grupos no incluye un token válido de un Rol_Autorizado, THEN THE API_Grupos SHALL responder con estado 403 y un mensaje "No autorizado".
4. THE Panel_Actualizacion SHALL permanecer accesible únicamente para los roles `super_admin` y `actualizacion`.

### Requisito 8: Migración de datos y esquema

**Historia de usuario:** Como responsable técnico, quiero incorporar el nuevo esquema sin romper las inscripciones existentes, para desplegar la funcionalidad de forma segura.

#### Criterios de Aceptación

1. THE Sistema SHALL contar con una tabla `grupos_actualizacion` con los campos: identificador, `programa_id`, `programa_label`, `fecha_inicio`, `fecha_cierre_inscripcion`, `estado`, `created_by` y `created_at`.
2. THE Sistema SHALL contar con una columna `grupo_actualizacion_id` nullable en la tabla `solicitudes`, con clave foránea hacia `grupos_actualizacion`.
3. THE Sistema SHALL permitir que una Solicitud tenga `grupo_actualizacion_id` en `NULL` para representar inscripciones "sin agrupar".
4. WHERE existan inscripciones de actualización creadas antes de esta funcionalidad, THE Sistema SHALL conservarlas con `grupo_actualizacion_id` en `NULL` (sin agrupar) sin alterar sus demás datos.
5. THE Sistema SHALL permitir que un Rol_Autorizado asigne manualmente un grupo a una inscripción existente que esté sin agrupar.
6. THE estado de la tabla `grupos_actualizacion` SHALL aceptar únicamente los valores `activo` y `cerrado`.
