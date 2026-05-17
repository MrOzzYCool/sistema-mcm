# Sistema MCM - I.E.S. Privada Margarita Cabrera

Aplicación web de gestión institucional desarrollada con Next.js y Supabase para el Instituto de Educación Superior Privada Margarita Cabrera. Gestiona alumnos, pagos, trámites, operaciones académicas y reportes ejecutivos.

---

## Módulo Gerencia - API

Dashboard ejecutivo de solo lectura para la Gerenta General. Todos los endpoints requieren autenticación con Bearer token y rol `gerenta` o `super_admin`. Todos los endpoints solo aceptan el método HTTP **GET**; cualquier otro método retorna **HTTP 405** con header `Allow: GET`.

### Autenticación

Todos los endpoints bajo `/api/admin/reports/` requieren:

- Header `Authorization: Bearer <token>` con un JWT válido
- El usuario asociado al token debe tener rol `gerenta` o `super_admin` en la tabla `profiles`
- Si el token es inválido o el rol no es autorizado, se retorna **HTTP 403** con `{ "error": "No autorizado" }`

---

### `GET /api/admin/reports/summary`

Retorna el resumen financiero para los KPIs del dashboard.

**Parámetros de consulta:**

| Parámetro | Tipo | Requerido | Descripción |
|-----------|------|-----------|-------------|
| `from` | string (YYYY-MM-DD) | Sí | Fecha de inicio del periodo |
| `to` | string (YYYY-MM-DD) | Sí | Fecha de fin del periodo |
| `carrera` | string | No | Filtrar por carrera |
| `ciclo` | number | No | Filtrar por ciclo |

**Respuesta exitosa (200):**

```json
{
  "total_pagado": 45000.00,
  "total_pendiente": 12000.00,
  "total_ingresos": 45000.00,
  "total_egresos": 8000.00,
  "porcentaje_cobranza": 78.9,
  "vouchers_recientes": [
    {
      "alumno_nombre": "Juan Pérez",
      "monto": 350.00,
      "fecha": "2025-01-15T10:30:00Z",
      "status": "approved",
      "comprobante_url": "https://..."
    }
  ]
}
```

**Errores:**

| Código | Condición |
|--------|-----------|
| 400 | Parámetros `from`/`to` ausentes o formato inválido |
| 400 | `from` es posterior a `to` |
| 403 | Token inválido o rol no autorizado |
| 405 | Método HTTP distinto a GET |

---

### `GET /api/admin/reports/financials`

Retorna datos financieros agrupados por mes para el gráfico de líneas.

**Parámetros de consulta:**

| Parámetro | Tipo | Requerido | Descripción |
|-----------|------|-----------|-------------|
| `from` | string (YYYY-MM-DD) | Sí | Fecha de inicio del periodo |
| `to` | string (YYYY-MM-DD) | Sí | Fecha de fin del periodo |
| `group_by` | string | Sí | Agrupación temporal (valor: `month`) |
| `carrera` | string | No | Filtrar por carrera |
| `ciclo` | number | No | Filtrar por ciclo |

**Respuesta exitosa (200):**

```json
{
  "data": [
    { "month": "2025-01", "ingresos": 15000.00, "egresos": 3000.00 },
    { "month": "2025-02", "ingresos": 18000.00, "egresos": 2500.00 }
  ]
}
```

**Errores:**

| Código | Condición |
|--------|-----------|
| 400 | Parámetros `from`/`to` ausentes o formato inválido |
| 400 | `from` es posterior a `to` |
| 403 | Token inválido o rol no autorizado |
| 405 | Método HTTP distinto a GET |

---

### `GET /api/admin/reports/tramites`

Retorna conteos de trámites por estado y listado paginado de solicitudes.

**Parámetros de consulta:**

| Parámetro | Tipo | Requerido | Descripción |
|-----------|------|-----------|-------------|
| `from` | string (YYYY-MM-DD) | Sí | Fecha de inicio del periodo |
| `to` | string (YYYY-MM-DD) | Sí | Fecha de fin del periodo |
| `estado` | string | No | Filtrar por estado (`pendiente`, `aprobado`, `observado`, `rechazado`) |
| `carrera` | string | No | Filtrar por carrera |
| `ciclo` | number | No | Filtrar por ciclo |
| `page` | number | No | Número de página (default: 1) |
| `limit` | number | No | Registros por página (default: 50, máximo: 50) |

**Respuesta exitosa (200):**

```json
{
  "counts": {
    "pendiente": 12,
    "aprobado": 45,
    "observado": 3,
    "rechazado": 2
  },
  "items": [
    {
      "id": "uuid",
      "fecha": "2025-01-15",
      "tipo_tramite": "Certificado de estudios",
      "alumno": "María García",
      "costo": 50.00,
      "estado": "pendiente"
    }
  ],
  "total": 62,
  "page": 1,
  "limit": 50
}
```

**Errores:**

| Código | Condición |
|--------|-----------|
| 400 | Parámetros `from`/`to` ausentes o formato inválido |
| 400 | `from` es posterior a `to` |
| 400 | Valor de `estado` no válido |
| 403 | Token inválido o rol no autorizado |
| 405 | Método HTTP distinto a GET |

---

### `GET /api/admin/reports/export`

Genera y descarga un archivo CSV o PDF con los datos del reporte solicitado.

**Parámetros de consulta:**

| Parámetro | Tipo | Requerido | Descripción |
|-----------|------|-----------|-------------|
| `type` | string | Sí | Tipo de reporte: `financials` o `tramites` |
| `format` | string | Sí | Formato de exportación: `csv` o `pdf` |
| `from` | string (YYYY-MM-DD) | Sí | Fecha de inicio del periodo |
| `to` | string (YYYY-MM-DD) | Sí | Fecha de fin del periodo |
| `carrera` | string | No | Filtrar por carrera |
| `ciclo` | number | No | Filtrar por ciclo |

**Respuesta exitosa:** Descarga de archivo binario con headers:

- `Content-Type`: `text/csv` o `application/pdf` según el formato
- `Content-Disposition`: `attachment; filename="reporte-<type>-<from>-<to>.<ext>"`

**Errores:**

| Código | Condición |
|--------|-----------|
| 400 | Parámetros `from`/`to` ausentes o formato inválido |
| 400 | `from` es posterior a `to` |
| 400 | `type` no es `financials` ni `tramites`, o `format` no es `csv` ni `pdf` |
| 403 | Token inválido o rol no autorizado |
| 405 | Método HTTP distinto a GET |

---

## Vistas de Base de Datos

Vistas SQL creadas en el schema `public` con prefijo `report_` para agregar datos sin modificar tablas existentes.

### `report_financial_summary`

Resumen financiero mensual agregado desde cuotas de planes de pago.

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `month` | text | Mes en formato YYYY-MM |
| `total_ingresos` | numeric | Suma de montos con status `paid` |
| `total_egresos` | numeric | Suma de montos con status `pending` u `overdue` |
| `carrera_id` | uuid | ID de la carrera asociada |
| `ciclo` | integer | Número de ciclo |

**Tablas fuente:** `installments`, `payment_plans`

**Estrategia de refresco:** Vista regular (no materializada). Se evalúa materialización si las tablas fuente superan 10,000 registros.

---

### `report_tramites_overview`

Vista de solicitudes de trámites con datos del alumno.

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `id` | uuid | ID de la solicitud |
| `fecha` | timestamp | Fecha de creación de la solicitud |
| `tipo_tramite` | text | Tipo de trámite solicitado |
| `alumno` | text | Nombre completo del alumno (nombres + apellidos) |
| `costo` | numeric | Monto pagado por el trámite |
| `estado` | text | Estado actual de la solicitud |
| `carrera` | text | Carrera del alumno |

**Tablas fuente:** `solicitudes`

**Estrategia de refresco:** Vista regular (no materializada). Se evalúa materialización si la tabla fuente supera 10,000 registros.

---

### `report_recent_vouchers`

Últimos 50 vouchers de pago con información del alumno y la cuota.

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `id` | uuid | ID del voucher |
| `alumno_nombre` | text | Nombre completo del alumno (desde profiles) |
| `monto` | numeric | Monto de la cuota asociada |
| `fecha` | timestamp | Fecha de creación del voucher |
| `status` | text | Estado del voucher |
| `comprobante_url` | text | URL del comprobante (puede ser null) |

**Tablas fuente:** `payment_vouchers`, `installments`, `payment_plans`, `profiles`

**Estrategia de refresco:** Vista regular (no materializada). Limitada a 50 registros más recientes ordenados por `created_at DESC`.

---

## Variables de Entorno

| Variable | Requerida | Descripción | Ejemplo |
|----------|-----------|-------------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Sí | URL del proyecto Supabase | `https://xxxxx.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Sí | Clave de Service Role para consultas administrativas (solo server-side, no exponer al cliente) | `eyJhbGciOiJIUzI1NiIs...` |
| `RESEND_API_KEY` | No | Clave API de Resend para envío de reportes programados por email | `re_xxxxx` |
