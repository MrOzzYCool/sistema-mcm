# Requirements Document

## Introduction

Esta funcionalidad asigna a cada grupo (tanda) de actualización un **número correlativo interno**, calculado automáticamente por el sistema al crear el grupo, con un **número de inicio configurable por programa**. El número es de uso exclusivamente interno/administrativo y **no** se muestra en el formulario público del alumno.

El correlativo es monótono creciente por programa: considera **todos** los grupos del programa (activos y cerrados), de modo que el número sigue subiendo aunque existan grupos cerrados. Los valores de inicio confirmados son: programa `ac1` ("IA PRÁCTICA PARA LA GESTIÓN ADMINISTRATIVA MODERNA") = 10; programa `ac2` ("GESTIÓN SECRETARIAL EJECUTIVA") = 30.

## Glossary

- **Sistema**: La aplicación Next.js (App Router) junto con su capa de datos en Supabase.
- **Programa**: Entrada del catálogo `ACTUALIZACIONES_CATALOGO` (en `src/lib/mock-data.ts`), identificada por `id` (p.ej. `ac1`, `ac2`).
- **Número de inicio** (`numeroInicioGrupo`): Entero configurable por programa que define el primer correlativo cuando el programa aún no tiene grupos.
- **Grupo**: Tanda de inscripción de un programa, registro de la tabla `grupos_actualizacion`.
- **Número de grupo** (`numero_grupo`): Correlativo interno entero asignado al grupo dentro de su programa.
- **Endpoint de grupos**: La ruta `src/app/api/admin/grupos-actualizacion/route.ts`.
- **Panel de administración**: La vista `src/app/dashboard/actualizacion/page.tsx` (selector de grupos y modal de gestión `GruposModal`).
- **Formulario público**: Las vistas accesibles por el alumno (p.ej. `src/app/actualizaciones/`, certificados de actualización).
- **Default de inicio** (`DEFAULT_NUMERO_INICIO_GRUPO`): Número de inicio a usar cuando un programa no define `numeroInicioGrupo`. Valor documentado: 1.

## Requirements

### Requisito 1

**Historia de usuario:** Como administrador, quiero configurar un número de inicio por programa, para que el correlativo de cada programa comience en el valor que necesito.

#### Criterios de Aceptación

1. THE Sistema SHALL definir para cada Programa del catálogo `ACTUALIZACIONES_CATALOGO` un campo `numeroInicioGrupo` de tipo entero.
2. THE Sistema SHALL usar `numeroInicioGrupo = 10` para el Programa `ac1` y `numeroInicioGrupo = 30` para el Programa `ac2`.
3. IF un Programa no define `numeroInicioGrupo`, THEN THE Sistema SHALL usar `DEFAULT_NUMERO_INICIO_GRUPO = 1` como número de inicio.

### Requisito 2

**Historia de usuario:** Como administrador, quiero que el número de grupo se asigne automáticamente al crear un grupo, para no tener que ingresarlo a mano ni arriesgar duplicados.

#### Criterios de Aceptación

1. WHEN el Endpoint de grupos crea un grupo de un Programa que ya tiene al menos un grupo, THE Sistema SHALL asignar `numero_grupo = (máximo numero_grupo existente de ese Programa) + 1`.
2. WHEN el Endpoint de grupos crea un grupo de un Programa que no tiene ningún grupo, THE Sistema SHALL asignar `numero_grupo = numeroInicioGrupo` del Programa.
3. WHEN el Sistema calcula el máximo `numero_grupo` de un Programa, THE Sistema SHALL considerar todos los grupos del Programa, tanto en estado `activo` como `cerrado`.
4. THE Sistema SHALL calcular el `numero_grupo` sin requerir entrada manual del número por parte del usuario.

### Requisito 3

**Historia de usuario:** Como administrador, quiero que cada número de grupo sea único dentro de su programa, para evitar correlativos duplicados.

#### Criterios de Aceptación

1. THE Sistema SHALL mantener valores de `numero_grupo` distintos entre grupos del mismo Programa.
2. IF al insertar un grupo se detecta un `numero_grupo` duplicado dentro del Programa, THEN THE Sistema SHALL rechazar la operación y devolver un mensaje de error comprensible.

### Requisito 4

**Historia de usuario:** Como administrador, quiero que el número de grupo quede persistido y registrado en auditoría, para mantener trazabilidad.

#### Criterios de Aceptación

1. WHEN el Endpoint de grupos crea un grupo, THE Sistema SHALL persistir el valor calculado de `numero_grupo` en la columna `numero_grupo` de la tabla `grupos_actualizacion`.
2. WHEN el Endpoint de grupos registra la acción `aperturar_grupo_actualizacion` en `historial_auditoria`, THE Sistema SHALL incluir el valor de `numero_grupo` en el detalle.

### Requisito 5

**Historia de usuario:** Como administrador, quiero que los dos grupos ya existentes queden numerados, para que el histórico sea consistente con los números de inicio.

#### Criterios de Aceptación

1. WHEN se ejecuta la migración de backfill, THE Sistema SHALL asignar `numero_grupo = 10` al grupo existente del Programa `ac1`.
2. WHEN se ejecuta la migración de backfill, THE Sistema SHALL asignar `numero_grupo = 30` al grupo existente del Programa `ac2`.
3. WHERE un Programa tiene varios grupos sin numerar durante el backfill, THE Sistema SHALL asignar al grupo más antiguo del Programa el `numeroInicioGrupo` y numerar el resto de forma creciente por orden de creación (`created_at` ascendente).

### Requisito 6

**Historia de usuario:** Como administrador, quiero ver el número de grupo solo en el panel de administración, para identificar tandas internamente sin exponerlo al alumno.

#### Criterios de Aceptación

1. WHEN el Panel de administración muestra el selector de grupos, THE Sistema SHALL anteponer la etiqueta `Grupo {numero_grupo}` a la descripción del grupo.
2. WHEN el Panel de administración muestra la lista de grupos del modal de gestión (`GruposModal`), THE Sistema SHALL mostrar la etiqueta `Grupo {numero_grupo}` para cada grupo.
3. WHILE un grupo no tenga `numero_grupo` asignado, THE Sistema SHALL mostrar la descripción del grupo sin la etiqueta `Grupo {numero_grupo}`.
4. THE Formulario público SHALL mostrar la información del grupo sin incluir `numero_grupo`.

### Requisito 7

**Historia de usuario:** Como responsable de seguridad, quiero que la asignación de correlativos esté restringida a los roles autorizados, para proteger la operación administrativa.

#### Criterios de Aceptación

1. IF una petición al Endpoint de grupos proviene de un usuario que no es `super_admin`, ni `actualizacion`, ni el correo `admin@margaritacabrera.edu.pe`, THEN THE Sistema SHALL rechazar la petición con estado 403.
2. WHERE la petición proviene de un usuario con rol `super_admin`, rol `actualizacion`, o el correo `admin@margaritacabrera.edu.pe`, THE Sistema SHALL permitir la creación del grupo y la asignación del `numero_grupo`.
