# Requirements Document

## Introduction

Esta funcionalidad permite al administrador del I.E.S. Margarita Cabrera corregir por completo un pago que ya fue registrado manualmente como pagado. Hoy, tras registrar un pago, el sistema solo permite editar la fecha de emisión y la nota de contabilidad; el resto del registro (tipo de comprobante, serie, número, monto, archivo de boleta y archivo de voucher) queda inmodificable.

En la operación real se han producido errores humanos, siendo el más grave el cruce de archivos: la boleta se subió en el campo del voucher y el voucher en el campo de la boleta. También puede haber errores en la serie, el número, el tipo de comprobante, el monto o la fecha. Esta funcionalidad añade una acción de edición completa que precarga todos los campos del pago, permite corregir cada dato, reemplazar los archivos de boleta y voucher, e intercambiar ambos archivos cuando quedaron cruzados. Dado que la boleta vive en la tabla `installments` (`comprobante_url`) y el voucher en la tabla `payment_vouchers` (`voucher_url`), el intercambio implica mover los valores entre ambas tablas. Toda edición queda registrada en el historial de auditoría.

## Glossary

- **Sistema_Pagos**: Componente servidor expuesto como `POST /api/admin/payments` que gestiona las acciones sobre planes y cuotas de pago.
- **Panel_Pagos**: Interfaz de administración de pagos por alumno (`src/app/dashboard/pagos-alumno`) desde la que el administrador opera.
- **Administrador**: Usuario único autenticado con el correo `admin@margaritacabrera.edu.pe`, el único autorizado a operar sobre pagos.
- **Cuota**: Registro en la tabla `installments` que representa una obligación de pago. Campos relevantes: `status`, `fecha_pago`, `tipo_comprobante`, `comprobante_serie`, `comprobante_numero`, `comprobante_url`, `amount`, `observacion`, `nota_contabilidad`.
- **Voucher_Registro**: Registro en la tabla `payment_vouchers` asociado a una Cuota mediante `installment_id`. Campos relevantes: `alumno_id`, `voucher_url`, `status` (`approved`/`pending_review`), `tipo_comprobante`, `reviewed_by`, `reviewed_at`.
- **Archivo_Boleta**: Valor de `comprobante_url` en la Cuota. Es el archivo del comprobante (boleta o factura). Puede contener varias URLs separadas por coma y admite PDF e imágenes.
- **Archivo_Voucher**: Valor de `voucher_url` en el Voucher_Registro. Es el archivo del voucher de pago. Puede contener varias URLs separadas por coma y admite PDF e imágenes.
- **Pago_Registrado**: Una Cuota cuyo `status` es `paid` que fue registrada manualmente por el Administrador.
- **Accion_Editar_Pago**: Nueva acción del Sistema_Pagos identificada por `action = "update-pago-completo"` que aplica la edición completa de un Pago_Registrado.
- **Historial_Auditoria**: Tabla `historial_auditoria` donde se registran las operaciones administrativas, con campos `accion`, `admin_id`, `admin_email`, `target_id` y `detalle`.
- **Intercambio_Archivos**: Operación que asigna el valor actual de Archivo_Boleta a Archivo_Voucher y el valor actual de Archivo_Voucher a Archivo_Boleta.

## Requirements

### Requirement 1: Acceso restringido a la edición completa

**User Story:** Como Administrador, quiero que solo yo pueda editar un pago registrado, para que ningún otro usuario pueda alterar comprobantes ni vouchers.

#### Acceptance Criteria

1. WHEN una solicitud de Accion_Editar_Pago es recibida sin token de autenticación válido, THEN THE Sistema_Pagos SHALL responder con estado 403 y no modificar ningún registro.
2. IF el correo del usuario autenticado es distinto de `admin@margaritacabrera.edu.pe`, THEN THE Sistema_Pagos SHALL responder con estado 403 y no modificar ningún registro.
3. WHEN el usuario autenticado es el Administrador, THE Sistema_Pagos SHALL procesar la Accion_Editar_Pago.

### Requirement 2: Alcance limitado a pagos ya registrados

**User Story:** Como Administrador, quiero editar únicamente pagos que ya están marcados como pagados, para evitar corromper cuotas que aún no han sido pagadas.

#### Acceptance Criteria

1. IF la Cuota referenciada por `installment_id` no existe, THEN THE Sistema_Pagos SHALL responder con estado 404 y un mensaje que indique que la cuota no fue encontrada.
2. IF el `status` de la Cuota referenciada es distinto de `paid`, THEN THE Sistema_Pagos SHALL responder con estado 400 y un mensaje que indique que solo se pueden editar pagos ya registrados.
3. WHERE la Cuota tiene `status` igual a `paid`, THE Panel_Pagos SHALL mostrar el botón "Editar registro completo" junto al botón de editar fecha de emisión.

### Requirement 3: Precarga de todos los campos en el modal de edición

**User Story:** Como Administrador, quiero ver todos los datos actuales del pago precargados al abrir la edición, para corregir solo lo que está mal sin volver a capturar lo correcto.

#### Acceptance Criteria

1. WHEN el Administrador activa el botón "Editar registro completo" de un Pago_Registrado, THE Panel_Pagos SHALL abrir un modal con los campos `tipo_comprobante`, `comprobante_serie`, `comprobante_numero`, `amount`, `fecha_pago` y `nota_contabilidad` precargados con los valores actuales de la Cuota.
2. WHEN el modal de edición se abre, THE Panel_Pagos SHALL mostrar el valor actual de Archivo_Boleta y el valor actual de Archivo_Voucher asociado a la Cuota.
3. WHEN el Administrador visualiza un Archivo_Boleta o un Archivo_Voucher que contiene varias URLs separadas por coma, THE Panel_Pagos SHALL permitir visualizar cada archivo individualmente, mostrando los archivos PDF mediante `<embed>` y las imágenes como imagen.

### Requirement 4: Edición de los campos del comprobante

**User Story:** Como Administrador, quiero corregir el tipo de comprobante, la serie, el número, el monto, la fecha y la nota de contabilidad, para dejar el registro con la información correcta.

#### Acceptance Criteria

1. WHEN el Administrador confirma la Accion_Editar_Pago con todos los campos válidos, THE Sistema_Pagos SHALL actualizar en la Cuota los campos `tipo_comprobante`, `comprobante_serie`, `comprobante_numero`, `amount`, `fecha_pago` y `nota_contabilidad` con los valores enviados y responder con estado 200.
2. IF el campo `comprobante_serie` enviado está vacío o excede 20 caracteres, THEN THE Sistema_Pagos SHALL rechazar la Accion_Editar_Pago, responder con estado 400 y un mensaje que indique que la serie es obligatoria y no debe exceder 20 caracteres.
3. IF el campo `comprobante_numero` enviado está vacío o excede 20 caracteres, THEN THE Sistema_Pagos SHALL rechazar la Accion_Editar_Pago, responder con estado 400 y un mensaje que indique que el número es obligatorio y no debe exceder 20 caracteres.
4. IF el campo `amount` enviado es menor que 0 o mayor que 999,999,999.99, THEN THE Sistema_Pagos SHALL rechazar la Accion_Editar_Pago, responder con estado 400 y un mensaje que indique que el monto debe estar entre 0 y 999,999,999.99.
5. IF el campo `tipo_comprobante` enviado está vacío, THEN THE Sistema_Pagos SHALL rechazar la Accion_Editar_Pago, responder con estado 400 y un mensaje que indique que el tipo de comprobante es obligatorio.
6. IF el campo `fecha_pago` enviado no es una fecha válida o es posterior a la fecha actual del servidor, THEN THE Sistema_Pagos SHALL rechazar la Accion_Editar_Pago, responder con estado 400 y un mensaje que indique que la fecha de pago es inválida.
7. IF el usuario que invoca la Accion_Editar_Pago no corresponde a la cuenta admin@margaritacabrera.edu.pe, THEN THE Sistema_Pagos SHALL rechazar la solicitud, responder con estado 403 y no modificar ningún campo de la Cuota.
8. IF cualquier validación de la Accion_Editar_Pago falla, THEN THE Sistema_Pagos SHALL conservar todos los campos de la Cuota con sus valores previos sin aplicar cambios parciales.
9. WHEN la Accion_Editar_Pago se completa con éxito, THE Sistema_Pagos SHALL conservar el `status` de la Cuota en `paid`.

### Requirement 5: Reemplazo de archivos de boleta y voucher

**User Story:** Como Administrador, quiero reemplazar el archivo de boleta o el archivo de voucher, para subir el documento correcto cuando el anterior era equivocado.

#### Acceptance Criteria

1. WHEN el Administrador envía un nuevo Archivo_Boleta en la Accion_Editar_Pago, THE Sistema_Pagos SHALL actualizar `comprobante_url` de la Cuota con el valor enviado, aceptando entre 1 y 10 URLs separadas por coma que apunten a archivos en formato PDF o imagen, con una longitud total máxima de 2000 caracteres.
2. WHEN el Administrador envía un nuevo Archivo_Voucher en la Accion_Editar_Pago, THE Sistema_Pagos SHALL actualizar `voucher_url` del Voucher_Registro asociado a la Cuota con el valor enviado, aceptando entre 1 y 10 URLs separadas por coma que apunten a archivos en formato PDF o imagen, con una longitud total máxima de 2000 caracteres.
3. IF la Cuota no tiene un Voucher_Registro asociado al momento de asignar un Archivo_Voucher, THEN THE Sistema_Pagos SHALL crear un Voucher_Registro con `installment_id` y `alumno_id` de la Cuota, el `voucher_url` enviado, `status` igual a `approved`, `reviewed_by` igual al identificador del Administrador y `reviewed_at` igual a la fecha y hora UTC de la operación.
4. IF ninguno de los dos campos de archivo es enviado en la Accion_Editar_Pago, THEN THE Sistema_Pagos SHALL conservar sin modificación los valores actuales de Archivo_Boleta y Archivo_Voucher de la Cuota.
5. WHEN la Accion_Editar_Pago se completa con éxito, THE Sistema_Pagos SHALL responder con estado 200, dejando en Archivo_Boleta y en Archivo_Voucher de la Cuota una cadena no vacía (al menos un carácter distinto de espacio en blanco).
6. IF al finalizar la Accion_Editar_Pago el Archivo_Boleta quedaría vacío o compuesto únicamente por espacios en blanco, THEN THE Sistema_Pagos SHALL rechazar la operación sin modificar los valores actuales y responder con estado 400 y un mensaje que indique que la boleta es obligatoria.
7. IF al finalizar la Accion_Editar_Pago el Archivo_Voucher quedaría vacío o compuesto únicamente por espacios en blanco, THEN THE Sistema_Pagos SHALL rechazar la operación sin modificar los valores actuales y responder con estado 400 y un mensaje que indique que el voucher es obligatorio.
8. IF un Archivo_Boleta o Archivo_Voucher enviado contiene más de 10 URLs, excede 2000 caracteres o incluye un elemento cuyo formato no es PDF ni imagen, THEN THE Sistema_Pagos SHALL rechazar la operación sin modificar los valores actuales y responder con estado 400 y un mensaje que indique que el archivo enviado no cumple el formato o los límites permitidos.

### Requirement 6: Intercambio de archivos cruzados

**User Story:** Como Administrador, quiero intercambiar el archivo de boleta y el de voucher con una sola acción, para corregir rápidamente los registros donde ambos quedaron cruzados.

#### Acceptance Criteria

1. WHERE el Administrador indica la opción de Intercambio_Archivos, THE Panel_Pagos SHALL enviar a la Accion_Editar_Pago la instrucción de intercambiar Archivo_Boleta y Archivo_Voucher en una sola operación.
2. WHEN la Accion_Editar_Pago recibe la instrucción de Intercambio_Archivos y tanto `comprobante_url` de la Cuota como `voucher_url` del Voucher_Registro tienen un valor no vacío, THE Sistema_Pagos SHALL asignar a `comprobante_url` de la Cuota el valor que tenía `voucher_url` del Voucher_Registro y asignar a `voucher_url` del Voucher_Registro el valor que tenía `comprobante_url` de la Cuota.
3. IF la Accion_Editar_Pago recibe la instrucción de Intercambio_Archivos y `comprobante_url` de la Cuota o `voucher_url` del Voucher_Registro está vacío, THEN THE Sistema_Pagos SHALL rechazar la operación sin modificar ninguno de los dos valores y mostrar un mensaje de error indicando que ambos archivos deben existir para intercambiarse.
4. IF ocurre un fallo durante la escritura del intercambio de `comprobante_url` y `voucher_url`, THEN THE Sistema_Pagos SHALL revertir ambos valores a su estado previo al intercambio y mostrar un mensaje de error indicando que el intercambio no se completó.
5. WHILE la instrucción de Intercambio_Archivos está activa, THE Panel_Pagos SHALL deshabilitar los controles de reemplazo de Archivo_Boleta y Archivo_Voucher para evitar combinaciones ambiguas en una misma operación.
6. WHEN el Sistema_Pagos completa correctamente el intercambio de `comprobante_url` y `voucher_url`, THE Panel_Pagos SHALL rehabilitar los controles de reemplazo de Archivo_Boleta y Archivo_Voucher y mostrar una confirmación del intercambio realizado.

### Requirement 7: Registro en auditoría

**User Story:** Como Administrador, quiero que cada edición completa de un pago quede registrada, para mantener trazabilidad de las correcciones realizadas.

#### Acceptance Criteria

1. WHEN la Accion_Editar_Pago se completa con éxito, THE Sistema_Pagos SHALL insertar un registro en el Historial_Auditoria con `accion` igual a `editar_pago_completo`, `admin_id` y `admin_email` del Administrador, y `target_id` igual al `installment_id` de la Cuota.
2. WHEN la Accion_Editar_Pago se completa con éxito, THE Sistema_Pagos SHALL incluir en el campo `detalle` del registro de auditoría el `installment_id`, la indicación de si se realizó Intercambio_Archivos y la indicación de si se reemplazó Archivo_Boleta o Archivo_Voucher.

### Requirement 8: Retroalimentación al Administrador

**User Story:** Como Administrador, quiero recibir confirmación o el motivo del error al guardar, para saber si la corrección se aplicó.

#### Acceptance Criteria

1. WHEN la Accion_Editar_Pago se completa con éxito, THE Sistema_Pagos SHALL responder con estado 200 y un mensaje de confirmación de que el pago fue actualizado.
2. IF ocurre un error al persistir los cambios en la Cuota o en el Voucher_Registro, THEN THE Sistema_Pagos SHALL responder con estado 500 y un mensaje descriptivo del error.
3. WHEN el Sistema_Pagos responde con un error, THE Panel_Pagos SHALL mostrar el mensaje de error al Administrador y mantener el modal de edición abierto.
