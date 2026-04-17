# Plan de Implementación: User Soft Delete

## Resumen

Implementar un mecanismo de eliminación suave (soft delete) para usuarios en el panel de administración. Incluye: migración de BD, nuevo endpoint API, protección del toggle existente, UI con modal de confirmación, filtro por estado y badge visual. Todos los datos históricos se preservan intactos.

## Tareas

- [ ] 1. Actualizar esquema de base de datos para soportar estado `eliminado`
  - Modificar el archivo `supabase/schema.sql` para actualizar el CHECK constraint de `profiles.estado`
  - Reemplazar `check (estado in ('activo','inactivo'))` por `check (estado in ('activo','inactivo','eliminado'))`
  - Agregar comentario SQL con los ALTER TABLE para aplicar en BD existente:
    ```sql
    ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_estado_check;
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_estado_check CHECK (estado IN ('activo', 'inactivo', 'eliminado'));
    ```
  - _Requisitos: 1.1, 1.2, 1.3_

- [ ] 2. Crear endpoint API de soft-delete y proteger toggle existente
  - [ ] 2.1 Crear el endpoint `POST /api/admin/delete-user`
    - Crear archivo `src/app/api/admin/delete-user/route.ts`
    - Implementar la función `POST` siguiendo el patrón de autenticación existente en `toggle-user/route.ts` y `users/route.ts`
    - Paso 1: Extraer token del header Authorization, verificar con `supabase.auth.getUser(token)`, validar que el email sea `admin@margaritacabrera.edu.pe` → 403 si no
    - Paso 2: Parsear body JSON, validar que `userId` esté presente y no vacío → 400 con `"userId es requerido"`
    - Paso 3: Verificar que `userId !== admin.id` → 400 con `"No puedes eliminar tu propia cuenta"`
    - Paso 4: Consultar perfil del target con `supabaseAdmin.from("profiles").select("nombre_completo, rol").eq("id", userId).single()`
    - Paso 5: Obtener email del target con `supabaseAdmin.auth.admin.getUserById(userId)`
    - Paso 6: Actualizar estado con `supabaseAdmin.from("profiles").update({ estado: "eliminado" }).eq("id", userId)` → 500 si falla
    - Paso 7: Banear cuenta Auth con `supabaseAdmin.auth.admin.updateUserById(userId, { ban_duration: "876600h" })` → 500 si falla
    - Paso 8: Insertar registro de auditoría en `historial_auditoria` con `accion: "eliminar_usuario"`, `admin_id`, `admin_email`, `target_id`, y `detalle` JSON con `nombre_completo`, `email`, `rol`
    - Paso 9: Retornar `{ success: true }` con status 200
    - _Requisitos: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 3.1, 3.2, 3.3, 7.1_

  - [ ]* 2.2 Escribir test de propiedad para transición de estado a eliminado
    - **Property 1: Transición de estado a eliminado**
    - Generar usuarios random con estado `activo` o `inactivo`, ejecutar soft-delete, verificar que el estado cambia a `eliminado`
    - **Valida: Requisito 2.2**

  - [ ]* 2.3 Escribir test de propiedad para rechazo de autorización
    - **Property 2: Rechazo de autorización para no-admins**
    - Generar emails random que no sean `admin@margaritacabrera.edu.pe`, verificar que retorna HTTP 403
    - **Valida: Requisito 2.3**

  - [ ]* 2.4 Escribir test de propiedad para rechazo de userId inválido
    - **Property 3: Rechazo de userId inválido**
    - Generar strings vacíos, nulos o solo whitespace como `userId`, verificar que retorna HTTP 400
    - **Valida: Requisito 2.4**

  - [ ]* 2.5 Escribir test de propiedad para ban de Auth
    - **Property 4: Ban de Auth con parámetros correctos**
    - Generar usuarios random, ejecutar soft-delete, verificar que `updateUserById` se llama con `ban_duration: "876600h"`
    - **Valida: Requisitos 2.6, 7.1**

  - [ ]* 2.6 Escribir test de propiedad para registro de auditoría
    - **Property 5: Registro de auditoría completo**
    - Generar usuarios random, ejecutar soft-delete, verificar que el registro de auditoría contiene todos los campos requeridos
    - **Valida: Requisitos 3.1, 3.2, 3.3**

  - [ ]* 2.7 Escribir tests unitarios del endpoint delete-user
    - Test: mock fallo de BD → verifica respuesta 500 (Requisito 2.5)
    - Test: mock fallo de ban Auth → verifica respuesta de error (Requisito 2.7)
    - Test: auto-eliminación retorna 400 (Requisito 9.1)

  - [ ] 2.8 Agregar protección al endpoint toggle-user existente
    - Modificar `src/app/api/admin/toggle-user/route.ts`
    - Agregar validación después de parsear el body: si `estado === "eliminado"`, retornar 400 con `"No se puede usar este endpoint para eliminar usuarios"`
    - _Requisitos: 10.1, 10.3_

  - [ ]* 2.9 Escribir test de propiedad para protección del toggle
    - **Property 11: Toggle rechaza estado eliminado**
    - Verificar que solicitudes al toggle con `estado = "eliminado"` retornan HTTP 400
    - **Valida: Requisitos 10.1, 10.3**

- [ ] 3. Checkpoint — Verificar endpoints API
  - Asegurar que todos los tests pasan, preguntar al usuario si surgen dudas.

- [ ] 4. Implementar cambios de UI en la página de usuarios
  - [ ] 4.1 Agregar estado de modal de eliminación y constantes
    - Modificar `src/app/dashboard/usuarios/page.tsx`
    - Agregar import de `Trash2` desde `lucide-react`
    - Agregar constante `ADMIN_LEVEL_ROLES = ["super_admin", "staff_tramites", "gestor", "actualizacion"]`
    - Agregar estado `deleteModal` con tipo `{ show: boolean; targetUser: Profile | null; confirmText: string; deleting: boolean }`
    - Agregar estado `filtroEstado` con valor por defecto `"todos"`
    - _Requisitos: 5.1, 6.4, 8.2_

  - [ ] 4.2 Implementar función `handleDelete` y lógica de filtrado por estado
    - Implementar `handleDelete(userId: string)` que llama a `POST /api/admin/delete-user` con el token de autenticación
    - En caso de éxito: cerrar modal, refrescar lista con `cargar()`
    - En caso de error: mostrar error en el modal
    - Actualizar la variable `lista` para aplicar filtro de estado:
      - `"todos"` → mostrar `activo` e `inactivo` (excluir `eliminado`)
      - `"activo"` → solo `activo`
      - `"inactivo"` → solo `inactivo`
      - `"eliminado"` → solo `eliminado`
    - _Requisitos: 6.6, 8.3, 8.4, 8.5_

  - [ ]* 4.3 Escribir test de propiedad para filtro de estado
    - **Property 10: Filtro de estado correcto**
    - Generar listas de usuarios con estados mixtos, verificar que cada filtro muestra exactamente los usuarios correctos
    - **Valida: Requisitos 8.3, 8.4, 8.5**

  - [ ] 4.4 Agregar pills de filtro de estado en la UI
    - Agregar una fila de botones pill debajo de los filtros de rol existentes con opciones: `todos`, `activo`, `inactivo`, `eliminado`
    - Usar el mismo estilo de pills que los filtros de rol (clsx con bg-[#a93526] para activo, bg-slate-100 para inactivo)
    - _Requisitos: 8.2_

  - [ ] 4.5 Agregar botón Eliminar y actualizar visibilidad de botones de acción
    - Agregar botón `Trash2` en la columna de acciones de cada fila de usuario
    - Ocultar botón Eliminar para usuarios con `estado === "eliminado"` (Requisito 5.3)
    - Ocultar botón Eliminar para la fila del super_admin autenticado (Requisito 9.2)
    - Ocultar botón toggle (activar/desactivar) para usuarios con `estado === "eliminado"` (Requisito 10.2)
    - Al hacer click en Eliminar: abrir modal de confirmación sin llamar a la API (Requisito 5.4)
    - _Requisitos: 5.1, 5.2, 5.3, 5.4, 9.2, 10.2_

  - [ ]* 4.6 Escribir test de propiedad para visibilidad de botones
    - **Property 7: Botones de acción ocultos para usuarios eliminados**
    - Verificar que para usuarios con `estado = 'eliminado'`, no se renderizan los botones Eliminar ni toggle
    - **Valida: Requisitos 5.3, 10.2**

  - [ ] 4.7 Implementar modal de confirmación de eliminación
    - Renderizar modal con overlay `bg-black/40` siguiendo el patrón del modal de creación existente
    - Mostrar nombre completo, email y rol del usuario target (Requisito 6.1)
    - Mostrar warning de que el usuario será desactivado y no podrá iniciar sesión (Requisito 6.2)
    - Para `Admin_Level_User` (rol en `ADMIN_LEVEL_ROLES`): mostrar warning adicional prominente + input para escribir "ELIMINAR" (Requisitos 6.3, 6.4)
    - Botón "Confirmar" habilitado solo cuando: es usuario regular, O es admin-level y `confirmText === "ELIMINAR"` (Requisito 6.4)
    - Botón "Cancelar" cierra modal sin acción (Requisito 6.5)
    - Durante la petición: botón deshabilitado + spinner `Loader2` (Requisito 6.7)
    - _Requisitos: 6.1, 6.2, 6.3, 6.4, 6.5, 6.7_

  - [ ]* 4.8 Escribir test de propiedad para confirmación extra de roles admin
    - **Property 9: Confirmación extra para roles administrativos**
    - Generar strings random, verificar que solo "ELIMINAR" habilita el botón de confirmar para usuarios admin-level
    - **Valida: Requisito 6.4**

  - [ ] 4.9 Actualizar badge de estado para soportar `eliminado`
    - Actualizar la lógica del badge en la columna Estado de la tabla:
      - `activo` → `badge-green`
      - `inactivo` → `badge-red`
      - `eliminado` → `badge-gray`
    - La clase `badge-gray` ya existe en `globals.css` (`bg-gray-100 text-gray-600`)
    - _Requisitos: 8.6_

- [ ] 5. Checkpoint final — Verificar implementación completa
  - Asegurar que todos los tests pasan, preguntar al usuario si surgen dudas.

## Notas

- Las tareas marcadas con `*` son opcionales y pueden omitirse para un MVP más rápido
- Cada tarea referencia requisitos específicos para trazabilidad
- Los checkpoints aseguran validación incremental
- Los tests de propiedades validan propiedades universales de corrección definidas en el diseño
- Los tests unitarios validan ejemplos específicos y casos borde
- La clase `badge-gray` ya existe en `globals.css`, no se necesita crear
