# Requirements Document

**Documento de Requisitos — Gestión de Ciclos y Secciones**

## Introduction

_Introducción_


La gestión de ciclos y secciones del sistema I.E.S. Privada Margarita Cabrera permite al personal administrativo abrir secciones de un ciclo (aperturas) con una carrera obligatoria y un cupo máximo (tope), matricular alumnas asignándolas directamente a una sección específica con control de cupo, gestionar el ciclo de vida de cada sección (activa, llena, concluida) y cerrar una sección completa promoviendo en bloque (grupal) a todas sus alumnas activas al siguiente ciclo.

Al promover, el sistema conserva los montos de pago vigentes de cada alumna (los descuentos de `student_benefits` se mantienen a lo largo de la carrera), genera automáticamente el plan de pagos del nuevo ciclo (matrícula + cuotas 01-04) con montos y fechas correctas, genera los cursos del nuevo ciclo y vincula a las alumnas a una nueva sección del siguiente ciclo. Las alumnas que estén en el último ciclo de su carrera se marcan como egresadas en lugar de promoverse.

Esta funcionalidad resuelve problemas del estado actual: secciones sin límite de cupo, vínculo alumna-sección ambiguo (solo por coincidencia de `carrera_id` + `ciclo_actual`), aperturas creadas sin carrera, promoción únicamente individual, plan de pagos no generado automáticamente en la promoción y riesgo de perder la continuidad de montos entre ciclos.

## Glossary

_Glosario_

- **Sistema**: El sistema de gestión de ciclos y secciones del I.E.S. Privada Margarita Cabrera.
- **Administrador**: Usuario con rol `super_admin` o `cycle_manager` autorizado para gestionar aperturas, matrículas y promociones.
- **Alumna**: Persona registrada con perfil de estudiante que se matricula en una carrera.
- **Carrera**: Programa de estudios (tabla `carreras`) con `duracion_ciclos` que indica el número total de ciclos de la carrera.
- **Ciclo**: Etapa de estudios de aproximadamente 4 meses dentro de una carrera. Se representa como número entero positivo (`cycle_number`, `ciclo_actual`, `ciclo`).
- **Seccion**: Grupo de alumnas de un mismo ciclo y carrera, identificado por un número autogenerado (campo `seccion`). Materializada como una fila en `cycle_openings`.
- **Apertura**: Registro en la tabla `cycle_openings` que representa la apertura de una sección de un ciclo. Contiene `cycle_number`, `carrera_id`, `seccion`, `start_date`, `fecha_fin`, `status` y `created_by`.
- **Tope**: Cupo máximo de alumnas que una Seccion puede contener.
- **Cupos_Disponibles**: Diferencia entre el Tope de una Seccion y la cantidad de alumnas actualmente vinculadas a esa Seccion.
- **Estado_Seccion**: Estado del ciclo de vida de una Seccion. Valores: `activo` (admite matrículas), `llena` (alcanzó el Tope, no admite más matrículas), `concluido` (ciclo cerrado y alumnas promovidas).
- **Inscripcion**: Registro en la tabla `inscripciones` que vincula a una Alumna con una Carrera y su ciclo actual. Contiene `alumno_id`, `carrera_id`, `ciclo_actual`, `fecha_inicio_ciclo`, `fecha_matricula` y `estado`.
- **Plan_De_Pagos**: Registro en la tabla `payment_plans` (`alumno_id`, `ciclo`, `year`, `status`) con sus cuotas asociadas en la tabla `installments`.
- **Cuota**: Registro en la tabla `installments` de tipo `matricula` (numero 0) o `cuota` (numero 01-04), con `concepto`, `amount`, `amount_original`, `due_date`, `status` y `fecha_pago`.
- **Beneficio**: Registro en `student_benefits` (`tipo_concepto`, `monto_final`, `es_permanente`, `ciclo_aplicable`, `activo`) que define el monto con descuento que paga una Alumna por matrícula o cuota.
- **Promocion_Grupal**: Operación que cierra una Seccion y promueve en un solo proceso a todas las alumnas activas de esa Seccion al siguiente ciclo.
- **Egreso**: Estado final de una Alumna que completó el último ciclo de su Carrera. Se representa con `estado = egresado` en la Inscripcion.
- **Deuda_Pendiente**: Existencia de al menos una Cuota con `status` distinto de pagado o exonerado y cuya `due_date` ya venció, asociada a la Alumna.

## Requirements

_Requisitos_

### Requisito 1: Apertura de sección con carrera y tope obligatorios

**Historia de usuario:** Como Administrador, quiero abrir una sección de un ciclo indicando obligatoriamente la carrera y el cupo máximo, para que cada sección tenga un límite de alumnas y quede correctamente vinculada a su carrera.

#### Criterios de Aceptación

1. WHEN el Administrador solicita crear una Apertura, THE Sistema SHALL requerir `carrera_id`, `cycle_number`, `start_date` y Tope como campos obligatorios.
2. IF la solicitud de creación de Apertura no incluye `carrera_id`, THEN THE Sistema SHALL rechazar la creación y devolver un mensaje que indique que la carrera es obligatoria.
3. IF la solicitud de creación de Apertura incluye un Tope que no es un entero mayor o igual a 1, THEN THE Sistema SHALL rechazar la creación y devolver un mensaje que indique que el tope debe ser un entero mayor o igual a 1.
4. WHEN el Administrador crea una Apertura válida, THE Sistema SHALL autogenerar el número de `seccion` según el rango correspondiente a la carrera indicada.
5. WHEN el Administrador crea una Apertura válida, THE Sistema SHALL registrar la Apertura con `status = activo` y persistir `carrera_id`, `cycle_number`, `start_date`, `fecha_fin`, Tope, `seccion` y `created_by`.
6. WHEN el Administrador crea una Apertura válida, THE Sistema SHALL registrar la acción de apertura en la tabla `historial_auditoria`.

### Requisito 2: Vínculo directo entre alumna y sección

**Historia de usuario:** Como Administrador, quiero que cada alumna quede vinculada directamente a una sección específica, para eliminar la ambigüedad cuando existen dos secciones del mismo ciclo y carrera.

#### Criterios de Aceptación

1. THE Sistema SHALL almacenar en la Inscripcion una referencia directa a la Apertura asignada a la Alumna mediante el identificador de la Apertura.
2. WHEN el Administrador matricula a una Alumna en una Seccion, THE Sistema SHALL registrar en la Inscripcion el identificador de la Apertura seleccionada.
3. WHERE existen dos o más Secciones activas de la misma carrera y ciclo, THE Sistema SHALL determinar la Seccion de una Alumna a partir del identificador de Apertura almacenado en la Inscripcion.
4. THE Sistema SHALL calcular Cupos_Disponibles de una Seccion contando las inscripciones vinculadas por identificador de Apertura.

### Requisito 3: Matrícula con selección de sección y control de cupo

**Historia de usuario:** Como Administrador, quiero seleccionar la sección específica al matricular a una alumna y ver los cupos disponibles, para no exceder el tope de la sección.

#### Criterios de Aceptación

1. WHEN el Administrador inicia la matrícula de una Alumna en una carrera y ciclo, THE Sistema SHALL mostrar las Secciones con `status = activo` de esa carrera y ciclo, cada una con su cantidad de alumnas vinculadas y su Tope en formato "vinculadas/tope".
2. WHEN el Administrador selecciona una Seccion con Cupos_Disponibles mayor o igual a 1, THE Sistema SHALL vincular a la Alumna a esa Seccion registrando el identificador de la Apertura en la Inscripcion.
3. IF el Administrador intenta matricular a una Alumna en una Seccion cuyos Cupos_Disponibles son iguales a 0, THEN THE Sistema SHALL rechazar la matrícula y devolver un mensaje que indique que la sección alcanzó su tope.
4. WHEN el Administrador matricula a una Alumna en una Seccion, THE Sistema SHALL crear o actualizar la Inscripcion, registrar el ciclo en `historial_ciclos` y generar los cursos del ciclo desde la malla curricular.
5. IF el Administrador intenta matricular en una Seccion con `status = llena` o `status = concluido`, THEN THE Sistema SHALL rechazar la matrícula y devolver un mensaje que indique que la sección no admite matrículas.
6. IF el Administrador intenta matricular a una Alumna que ya tiene una Inscripcion con `estado = activo` en la misma carrera y ciclo, THEN THE Sistema SHALL rechazar la matrícula y devolver un mensaje que indique que la alumna ya está matriculada en ese ciclo, sin crear una Inscripcion duplicada.
7. WHILE el Sistema procesa la vinculación de una Alumna a una Seccion, THE Sistema SHALL aplicar control de concurrencia sobre el conteo de Cupos_Disponibles de esa Seccion de modo que dos matrículas simultáneas no superen el Tope.

### Requisito 4: Pre-registro y asignación anticipada de sección

**Historia de usuario:** Como Administrador, quiero asignar a una sección específica a las alumnas que se pre-registran antes del inicio del ciclo, para tener los grupos organizados cuando comience el ciclo en marzo.

#### Criterios de Aceptación

1. WHEN el Administrador asigna una Alumna pre-registrada a una Seccion con `status = activo`, THE Sistema SHALL vincular a la Alumna a esa Seccion registrando el identificador de la Apertura en la Inscripcion.
2. THE Sistema SHALL aplicar el control de Cupos_Disponibles descrito en el Requisito 3 a las asignaciones de alumnas pre-registradas.

### Requisito 5: Ciclo de vida de la sección (activa, llena, concluida)

**Historia de usuario:** Como Administrador, quiero que las secciones cambien de estado según su ocupación y cierre, para saber cuándo abrir una nueva sección del mismo ciclo.

#### Criterios de Aceptación

1. WHEN una Seccion alcanza Cupos_Disponibles iguales a 0, THE Sistema SHALL cambiar el Estado_Seccion a `llena`.
2. WHILE una Seccion tiene `status = llena`, THE Sistema SHALL rechazar nuevas matrículas en esa Seccion.
3. WHEN el Administrador abre una nueva Apertura para la misma carrera y ciclo, THE Sistema SHALL autogenerar el siguiente número de `seccion` en el rango de esa carrera.
4. WHEN el Administrador cierra una Seccion, THE Sistema SHALL cambiar el Estado_Seccion a `concluido`.
5. WHILE una Seccion tiene `status = concluido`, THE Sistema SHALL rechazar nuevas matrículas en esa Seccion.

### Requisito 6: Cierre de sección y promoción grupal

**Historia de usuario:** Como Administrador, quiero cerrar una sección completa y promover en bloque a todas sus alumnas activas al siguiente ciclo, para no promover a las alumnas una por una.

#### Criterios de Aceptación

1. WHEN el Administrador solicita el cierre de una Seccion, THE Sistema SHALL identificar a todas las alumnas con Inscripcion `estado = activo` vinculadas a esa Seccion.
2. WHEN el Administrador confirma la Promocion_Grupal de una Seccion, THE Sistema SHALL procesar la promoción de todas las alumnas activas identificadas en una sola operación.
3. WHEN se procesa la Promocion_Grupal de una Alumna cuyo ciclo actual es menor que la `duracion_ciclos` de su Carrera, THE Sistema SHALL actualizar la Inscripcion incrementando `ciclo_actual` en 1 y registrar la nueva `fecha_inicio_ciclo`.
4. WHEN se procesa la Promocion_Grupal de una Alumna cuyo ciclo actual es igual o mayor que la `duracion_ciclos` de su Carrera, THE Sistema SHALL marcar la Inscripcion con `estado = egresado` sin incrementar el ciclo.
5. WHEN se completa la Promocion_Grupal de una Seccion, THE Sistema SHALL cambiar el Estado_Seccion de la Apertura de origen a `concluido`.
6. WHEN se completa la Promocion_Grupal de una Seccion, THE Sistema SHALL cerrar el ciclo anterior de cada alumna promovida en `historial_ciclos` registrando `fecha_fin` y `estado = completado`.
7. IF ocurre un error al procesar la promoción de una Alumna durante la Promocion_Grupal, THEN THE Sistema SHALL registrar el error identificando a la Alumna afectada y continuar procesando a las demás alumnas de la Seccion.
8. WHEN se completa la Promocion_Grupal de una Seccion, THE Sistema SHALL registrar la operación en la tabla `historial_auditoria`.
9. IF el Administrador solicita la Promocion_Grupal de una Seccion que no tiene alumnas con Inscripcion `estado = activo`, THEN THE Sistema SHALL cambiar el Estado_Seccion de la Apertura a `concluido`, registrar la operación en `historial_auditoria` y devolver un resultado que indique que no había alumnas activas por promover.
10. IF el Administrador solicita la Promocion_Grupal de una Seccion cuyo Estado_Seccion ya es `concluido`, THEN THE Sistema SHALL rechazar la operación sin volver a promover a las alumnas ni generar planes de pago o cursos duplicados (idempotencia).
11. WHEN el Sistema procesa la promoción de una Alumna que ya fue promovida al nuevo ciclo (Inscripcion ya actualizada o Plan_De_Pagos del nuevo ciclo ya existente), THE Sistema SHALL omitir esa Alumna sin duplicar la actualización de la Inscripcion, el Plan_De_Pagos ni los cursos.
12. WHILE el Sistema ejecuta una Promocion_Grupal de una Seccion, THE Sistema SHALL aplicar control de concurrencia que impida que dos ejecuciones simultáneas de la Promocion_Grupal de la misma Seccion procesen a las mismas alumnas.

### Requisito 7: Generación del plan de pagos en la promoción con continuidad de montos

**Historia de usuario:** Como Administrador, quiero que al promover al siguiente ciclo se genere el plan de pagos conservando los montos que ya paga cada alumna, para que el costo se mantenga consistente hasta que termine la carrera.

#### Criterios de Aceptación

1. WHEN se promueve a una Alumna a un nuevo ciclo, THE Sistema SHALL generar un Plan_De_Pagos para la Alumna correspondiente al nuevo ciclo con una Cuota de matrícula (numero 0) y cuatro Cuotas (numero 01 a 04).
2. WHEN el Sistema genera las Cuotas del nuevo ciclo de una Alumna, THE Sistema SHALL aplicar el `monto_final` del Beneficio activo de la Alumna que corresponda a cada tipo de concepto (matrícula y cuota).
3. WHERE una Alumna no tiene un Beneficio activo para un tipo de concepto, THE Sistema SHALL aplicar el monto original definido por el Sistema para ese tipo de concepto.
4. WHEN el Sistema genera las Cuotas del nuevo ciclo, THE Sistema SHALL asignar la `due_date` de la matrícula y de la cuota 01 al día 01 del mes de inicio de la nueva Seccion, y las cuotas 02 a 04 al día 01 de cada mes consecutivo siguiente.
5. IF el `monto_final` aplicado a una Cuota es igual a 0, THEN THE Sistema SHALL registrar esa Cuota con `status = exonerado` y `fecha_pago` con la fecha del proceso.
6. IF ya existe un Plan_De_Pagos para la Alumna con el mismo ciclo y año, THEN THE Sistema SHALL evitar la creación de un plan duplicado y registrar la condición.

### Requisito 8: Generación de cursos y asignación a nueva sección en la promoción

**Historia de usuario:** Como Administrador, quiero que al promover al siguiente ciclo se generen los cursos correspondientes y las alumnas queden asignadas a una sección del nuevo ciclo, para que el grupo continúe organizado.

#### Criterios de Aceptación

1. WHEN se promueve a una Alumna a un nuevo ciclo, THE Sistema SHALL generar los cursos del nuevo ciclo desde la malla curricular de la Carrera.
2. WHEN se promueve en bloque a las alumnas activas de una Seccion a un nuevo ciclo, THE Sistema SHALL vincular a esas alumnas a una Seccion del nuevo ciclo registrando el identificador de la Apertura correspondiente en cada Inscripcion.
3. IF no existe una Apertura con `status = activo` para la carrera y el nuevo ciclo al momento de la Promocion_Grupal, THEN THE Sistema SHALL crear una nueva Apertura para esa carrera y ciclo antes de vincular a las alumnas.
4. THE Sistema SHALL aplicar el control de Tope del Requisito 3 al vincular alumnas a la Seccion del nuevo ciclo.

### Requisito 9: Egreso al alcanzar el último ciclo

**Historia de usuario:** Como Administrador, quiero que las alumnas que están en el último ciclo de su carrera se marquen como egresadas en lugar de promoverse, para reflejar la finalización de sus estudios.

#### Criterios de Aceptación

1. WHEN se procesa la promoción de una Alumna cuyo `ciclo_actual` es igual o mayor que la `duracion_ciclos` de su Carrera, THE Sistema SHALL marcar la Inscripcion con `estado = egresado`.
2. WHEN una Alumna es marcada como egresada, THE Sistema SHALL omitir la generación del Plan_De_Pagos y de los cursos de un nuevo ciclo para esa Alumna.
3. WHEN una Alumna es marcada como egresada, THE Sistema SHALL registrar el egreso en la tabla `historial_auditoria`.

### Requisito 10: Manejo de deuda pendiente en la promoción

**Historia de usuario:** Como Administrador, quiero que el sistema permita promover a las alumnas con deuda pendiente registrando una advertencia, para no bloquear el avance académico y a la vez dejar constancia de la deuda.

#### Criterios de Aceptación

1. WHEN el Administrador inicia una Promocion_Grupal, THE Sistema SHALL identificar a las alumnas de la Seccion que tienen Deuda_Pendiente.
2. WHEN el Administrador visualiza el detalle de una Promocion_Grupal, THE Sistema SHALL mostrar cuáles alumnas de la Seccion tienen Deuda_Pendiente antes de confirmar la operación.
3. IF una Alumna tiene Deuda_Pendiente al procesar la Promocion_Grupal, THEN THE Sistema SHALL promover a la Alumna al siguiente ciclo sin bloquear la operación y registrar una advertencia asociada a esa Alumna en el resultado de la operación y en la tabla `historial_auditoria`.
4. WHEN el Sistema promueve a una Alumna con Deuda_Pendiente, THE Sistema SHALL conservar las Cuotas impagas del ciclo anterior con su `status` pendiente sin eliminarlas ni anularlas.
5. WHEN se completa la Promocion_Grupal de una Seccion que incluye alumnas con Deuda_Pendiente, THE Sistema SHALL incluir en el resultado de la operación la lista de alumnas promovidas con advertencia de Deuda_Pendiente.

### Requisito 11: Control de acceso

**Historia de usuario:** Como institución, quiero que solo el personal autorizado gestione aperturas, matrículas y promociones, para proteger la integridad de los datos académicos y financieros.

#### Criterios de Aceptación

1. IF una solicitud de apertura, matrícula, cierre de sección o promoción no proviene de un Administrador autorizado, THEN THE Sistema SHALL rechazar la solicitud y devolver un mensaje de no autorizado.
2. WHERE la operación es la eliminación de una Apertura, THE Sistema SHALL permitir la acción únicamente a usuarios con rol `super_admin`.
