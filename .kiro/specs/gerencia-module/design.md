# Design Document: Módulo Gerencia

## Overview

El Módulo Gerencia es un dashboard ejecutivo de solo lectura para la Gerenta General del Instituto Margarita Cabrera. Proporciona visualización de KPIs financieros, gráficos de tendencias, estado de trámites y actividad de vouchers. El módulo se integra al sistema existente Next.js + Supabase sin modificar tablas existentes, usando vistas SQL para agregar datos y endpoints API dedicados bajo `/api/admin/reports/`.

### Decisiones de Diseño Clave

1. **Solo lectura**: El rol `gerenta` no tiene permisos de escritura. Los endpoints solo aceptan GET.
2. **Vistas SQL**: Se usan vistas (no tablas nuevas) para agregar datos sin interferir con el esquema existente.
3. **Server-side export**: PDF generado con `jspdf` en el servidor para evitar dependencias pesadas en el cliente.
4. **Patrón de auth existente**: Se reutiliza el patrón Bearer token + `supabase.auth.getUser()` + verificación de rol desde `profiles`.

## Architecture

```mermaid
graph TB
    subgraph Client ["Frontend (Next.js Client)"]
        DG[Dashboard Gerencia Page]
        FP[Finanzas Page]
        TP[Trámites Page]
        FC[Filter Controls]
        KC[KPI Cards]
        LC[Line Chart - Recharts]
        DC[Donut Chart - Recharts]
        VT[Vouchers Table]
        EB[Export Buttons]
    end

    subgraph API ["API Routes (Server-side)"]
        RS[/api/admin/reports/summary]
        RF[/api/admin/reports/financials]
        RT[/api/admin/reports/tramites]
        RE[/api/admin/reports/export]
    end

    subgraph DB ["Supabase (PostgreSQL)"]
        V1[view: report_financial_summary]
        V2[view: report_tramites_overview]
        V3[view: report_recent_vouchers]
        T1[installments]
        T2[solicitudes]
        T3[payment_vouchers]
        T4[profiles]
    end

    DG --> FC
    DG --> KC
    DG --> LC
    DG --> DC
    DG --> VT
    DG --> EB

    KC --> RS
    LC --> RF
    DC --> RT
    VT --> RS
    EB --> RE
    FP --> RF
    FP --> RE
    TP --> RT
    TP --> RE

    RS --> V1
    RS --> V3
    RF --> V1
    RT --> V2
    RE --> V1
    RE --> V2

    V1 --> T1
    V2 --> T2
    V3 --> T3
    V3 --> T4
```

### Flujo de Datos

1. El usuario con rol `gerenta` o `super_admin` accede a `/dashboard/gerencia`
2. El cliente envía requests GET a los endpoints `/api/admin/reports/*` con Bearer token
3. Los endpoints verifican el JWT y el rol, luego consultan las vistas SQL via `supabaseAdmin`
4. Los datos agregados se devuelven como JSON al cliente
5. El cliente renderiza KPIs, gráficos (Recharts) y tablas
6. Para exportar, el cliente solicita al endpoint `/api/admin/reports/export` que genera CSV/PDF server-side

## Components and Interfaces

### API Endpoints

#### `GET /api/admin/reports/summary`

Devuelve resumen financiero para KPIs.

**Query Parameters:**
| Param | Type | Required | Description |
|-------|------|----------|-------------|
| from | string (YYYY-MM-DD) | Yes | Fecha inicio |
| to | string (YYYY-MM-DD) | Yes | Fecha fin |
| carrera | string | No | Filtro por carrera |
| ciclo | number | No | Filtro por ciclo |

**Response (200):**
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

#### `GET /api/admin/reports/financials`

Devuelve datos mensuales para el gráfico de líneas.

**Query Parameters:**
| Param | Type | Required | Description |
|-------|------|----------|-------------|
| from | string (YYYY-MM-DD) | Yes | Fecha inicio |
| to | string (YYYY-MM-DD) | Yes | Fecha fin |
| group_by | string | Yes | Siempre "month" |
| carrera | string | No | Filtro por carrera |
| ciclo | number | No | Filtro por ciclo |

**Response (200):**
```json
{
  "data": [
    { "month": "2025-01", "ingresos": 15000.00, "egresos": 3000.00 },
    { "month": "2025-02", "ingresos": 18000.00, "egresos": 2500.00 }
  ]
}
```

#### `GET /api/admin/reports/tramites`

Devuelve conteos de trámites por estado.

**Query Parameters:**
| Param | Type | Required | Description |
|-------|------|----------|-------------|
| from | string (YYYY-MM-DD) | Yes | Fecha inicio |
| to | string (YYYY-MM-DD) | Yes | Fecha fin |
| estado | string | No | Filtro por estado específico |
| carrera | string | No | Filtro por carrera |
| ciclo | number | No | Filtro por ciclo |
| page | number | No | Página (default 1) |
| limit | number | No | Registros por página (default 50, max 50) |

**Response (200):**
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

#### `GET /api/admin/reports/export`

Genera y descarga archivo CSV o PDF.

**Query Parameters:**
| Param | Type | Required | Description |
|-------|------|----------|-------------|
| type | string | Yes | "financials" o "tramites" |
| format | string | Yes | "csv" o "pdf" |
| from | string (YYYY-MM-DD) | Yes | Fecha inicio |
| to | string (YYYY-MM-DD) | Yes | Fecha fin |
| carrera | string | No | Filtro por carrera |
| ciclo | number | No | Filtro por ciclo |

**Response:** Binary file con headers apropiados.

### Frontend Components

#### Page Structure

```
/dashboard/gerencia/
├── page.tsx              → Dashboard principal (KPIs + charts + vouchers table)
├── finanzas/
│   └── page.tsx          → Tabla paginada de registros financieros
└── tramites/
    └── page.tsx          → Tabla paginada de solicitudes
```

#### Shared Components

| Component | Location | Purpose |
|-----------|----------|---------|
| `GerenciaFilters` | `src/components/gerencia/GerenciaFilters.tsx` | Filtros globales (fecha, carrera, ciclo) |
| `KpiCard` | Reutilizar existente en `dashboard/page.tsx` | Tarjeta de indicador |
| `ExportButtons` | `src/components/gerencia/ExportButtons.tsx` | Botones CSV/PDF |
| `GerenciaLayout` | `src/components/gerencia/GerenciaLayout.tsx` | Layout con tabs de navegación interna |

### Auth Middleware (per-endpoint)

```typescript
// Patrón de verificación para endpoints de reportes
async function verifyGerenciaAccess(req: NextRequest): Promise<{ user: User } | null> {
  const token = (req.headers.get("authorization") ?? "").replace("Bearer ", "");
  if (!token) return null;
  
  const { data: { user } } = await supabase.auth.getUser(token);
  if (!user) return null;
  
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("rol")
    .eq("id", user.id)
    .single();
  
  if (!profile || !["gerenta", "super_admin"].includes(profile.rol)) return null;
  return { user };
}
```

## Data Models

### Database Views (schema `public`)

> **Nota**: Las vistas se crean en el schema `public` (no `admin`) para compatibilidad con Supabase client. Se usa prefijo `report_` para distinguirlas.

#### `report_financial_summary`

```sql
CREATE OR REPLACE VIEW report_financial_summary AS
SELECT
  to_char(i.due_date, 'YYYY-MM') AS month,
  COALESCE(SUM(i.amount) FILTER (WHERE i.status = 'paid'), 0) AS total_ingresos,
  COALESCE(SUM(i.amount) FILTER (WHERE i.status IN ('pending', 'overdue')), 0) AS total_egresos,
  pp.carrera_id,
  pp.ciclo
FROM installments i
JOIN payment_plans pp ON pp.id = i.plan_id
GROUP BY to_char(i.due_date, 'YYYY-MM'), pp.carrera_id, pp.ciclo;
```

#### `report_tramites_overview`

```sql
CREATE OR REPLACE VIEW report_tramites_overview AS
SELECT
  s.id,
  s.created_at AS fecha,
  s.tipo_tramite,
  s.nombres || ' ' || s.apellidos AS alumno,
  s.monto_pagado AS costo,
  s.estado,
  s.carrera
FROM solicitudes s;
```

#### `report_recent_vouchers`

```sql
CREATE OR REPLACE VIEW report_recent_vouchers AS
SELECT
  pv.id,
  p.nombre_completo AS alumno_nombre,
  i.amount AS monto,
  pv.created_at AS fecha,
  pv.status,
  i.comprobante_url
FROM payment_vouchers pv
JOIN installments i ON i.id = pv.installment_id
JOIN payment_plans pp ON pp.id = i.plan_id
JOIN profiles p ON p.id = pp.alumno_id
ORDER BY pv.created_at DESC
LIMIT 50;
```

### TypeScript Interfaces

```typescript
// src/types/gerencia.ts

export interface FinancialSummary {
  total_pagado: number;
  total_pendiente: number;
  total_ingresos: number;
  total_egresos: number;
  porcentaje_cobranza: number;
}

export interface MonthlyFinancial {
  month: string; // YYYY-MM
  ingresos: number;
  egresos: number;
}

export interface TramitesCounts {
  pendiente: number;
  aprobado: number;
  observado: number;
  rechazado: number;
}

export interface TramiteRow {
  id: string;
  fecha: string;
  tipo_tramite: string;
  alumno: string;
  costo: number;
  estado: string;
}

export interface VoucherRow {
  id: string;
  alumno_nombre: string;
  monto: number;
  fecha: string;
  status: string;
  comprobante_url: string | null;
}

export interface GerenciaFilters {
  from: string; // YYYY-MM-DD
  to: string;   // YYYY-MM-DD
  carrera?: string;
  ciclo?: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}
```

### PDF Generation

Se usará `jspdf` para generación server-side de PDFs:

```typescript
// src/lib/pdf-generator.ts
import { jsPDF } from "jspdf";

export function generateFinancialPDF(data: MonthlyFinancial[], filters: GerenciaFilters): Buffer {
  const doc = new jsPDF();
  doc.setFontSize(16);
  doc.text("Reporte Financiero - MCM", 20, 20);
  doc.setFontSize(10);
  doc.text(`Periodo: ${filters.from} a ${filters.to}`, 20, 30);
  
  // Table header
  let y = 45;
  doc.setFontSize(9);
  doc.text("Mes", 20, y);
  doc.text("Ingresos (S/)", 60, y);
  doc.text("Egresos (S/)", 110, y);
  
  // Table rows
  data.forEach(row => {
    y += 8;
    doc.text(row.month, 20, y);
    doc.text(row.ingresos.toFixed(2), 60, y);
    doc.text(row.egresos.toFixed(2), 110, y);
  });
  
  return Buffer.from(doc.output("arraybuffer"));
}
```

### CSV Generation

```typescript
// src/lib/csv-generator.ts
export function generateFinancialCSV(data: MonthlyFinancial[]): string {
  const header = "Mes,Ingresos,Egresos\n";
  const rows = data.map(r => `${r.month},${r.ingresos.toFixed(2)},${r.egresos.toFixed(2)}`).join("\n");
  return header + rows;
}

export function generateTramitesCSV(data: TramiteRow[]): string {
  const header = "Fecha,Tipo,Alumno,Costo,Estado\n";
  const rows = data.map(r => `${r.fecha},"${r.tipo_tramite}","${r.alumno}",${r.costo.toFixed(2)},${r.estado}`).join("\n");
  return header + rows;
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Authorization enforcement across all report endpoints

*For any* HTTP request to any endpoint under `/api/admin/reports/*` with a JWT whose associated profile has a role NOT in {gerenta, super_admin}, the API SHALL return HTTP 403.

**Validates: Requirements 8.3, 9.3, 10.5**

### Property 2: Date parameter validation

*For any* string that does not match the ISO 8601 date format (YYYY-MM-DD) provided as `from` or `to` query parameter to any report endpoint, the API SHALL return HTTP 400 with an error message.

**Validates: Requirements 8.4, 9.4, 10.7**

### Property 3: Read-only enforcement (HTTP method restriction)

*For any* HTTP method other than GET (POST, PUT, PATCH, DELETE) sent to any endpoint under `/api/admin/reports/*`, the API SHALL return HTTP 405 with an `Allow: GET` response header.

**Validates: Requirements 11.2, 11.3**

### Property 4: Percentage calculation correctness

*For any* non-negative values of total_pagado and total_pendiente, the porcentaje_cobranza SHALL equal `(total_pagado / (total_pagado + total_pendiente)) * 100` rounded to one decimal place, with the special case that when both are zero the result is 0.0.

**Validates: Requirements 3.2, 3.3**

### Property 5: Filter correctness — date range

*For any* valid date range filter (from ≤ to), all data items returned by any report endpoint SHALL have their associated date within the [from, to] range (inclusive).

**Validates: Requirements 7.2, 8.1, 8.2, 12.3**

### Property 6: Filter correctness — invalid date range rejection

*For any* pair of dates where `from` is strictly after `to`, the system SHALL reject the filter and return an error (HTTP 400 from API, or UI validation error on the client).

**Validates: Requirements 7.6**

### Property 7: Export format correctness

*For any* valid combination of type ∈ {financials, tramites} and format ∈ {csv, pdf} with valid date parameters, the export endpoint SHALL return a response with the correct Content-Type (`text/csv` for csv, `application/pdf` for pdf) and Content-Disposition header set to `attachment`.

**Validates: Requirements 10.1, 10.2, 10.3, 10.4**

### Property 8: Export parameter validation

*For any* value of `type` NOT in {financials, tramites} OR `format` NOT in {csv, pdf}, the export endpoint SHALL return HTTP 400.

**Validates: Requirements 10.6**

### Property 9: Tramites estado filter correctness

*For any* valid estado value provided as filter to the tramites endpoint, all returned items SHALL have their estado field matching the filter value.

**Validates: Requirements 9.2**

### Property 10: Invalid estado rejection

*For any* string value NOT in {pendiente, aprobado, observado, rechazado} provided as the `estado` query parameter, the tramites endpoint SHALL return HTTP 400.

**Validates: Requirements 9.5**

## Error Handling

### API Error Responses

All API endpoints follow a consistent error response format:

```json
{
  "error": "Descriptive error message in Spanish"
}
```

| Scenario | HTTP Status | Error Message |
|----------|-------------|---------------|
| No auth token | 403 | "No autorizado" |
| Invalid role | 403 | "No autorizado" |
| Missing from/to | 400 | "Parámetros 'from' y 'to' son requeridos (formato YYYY-MM-DD)" |
| Invalid date format | 400 | "Formato de fecha inválido. Use YYYY-MM-DD" |
| from > to | 400 | "La fecha 'from' no puede ser posterior a 'to'" |
| Invalid type/format | 400 | "Parámetro inválido: type debe ser 'financials' o 'tramites', format debe ser 'csv' o 'pdf'" |
| Invalid estado | 400 | "Estado inválido. Valores permitidos: pendiente, aprobado, observado, rechazado" |
| Non-GET method | 405 | (Allow: GET header) |
| DB query failure | 500 | "Error interno al consultar datos" |

### Client-Side Error Handling

- Mostrar toast/banner con mensaje de error del API
- Botón "Reintentar" para errores de red o 500
- Validación client-side de fechas antes de enviar request (from ≤ to)
- Loading states con skeleton/spinner durante fetch

## Testing Strategy

### Unit Tests (Example-based)

- Verificar que `KpiCard` renderiza valores correctamente
- Verificar que filtros invalidan rangos de fecha incorrectos (from > to)
- Verificar que el sidebar muestra/oculta el item "Gerencia" según rol
- Verificar que las páginas de gerencia no contienen controles de escritura

### Property-Based Tests

Se usará `fast-check` como librería de PBT para TypeScript/JavaScript.

**Configuración**: Mínimo 100 iteraciones por propiedad.

Cada test referencia su propiedad del diseño con el formato:
`Feature: gerencia-module, Property N: [título]`

Properties a implementar:
1. Authorization enforcement (Property 1)
2. Date validation (Property 2)
3. HTTP method restriction (Property 3)
4. Percentage calculation (Property 4)
5. Date range filter correctness (Property 5)
6. Invalid date range rejection (Property 6)
7. Export format correctness (Property 7)
8. Export parameter validation (Property 8)
9. Estado filter correctness (Property 9)
10. Invalid estado rejection (Property 10)

### Integration Tests

- Endpoint `/api/admin/reports/summary` returns 200 with valid structure
- Endpoint `/api/admin/reports/financials` returns monthly data
- Endpoint `/api/admin/reports/tramites` returns counts by estado
- Endpoint `/api/admin/reports/export` returns file with correct headers
- Views return data without errors

### Smoke Tests

- Database views exist and are queryable
- Indexes exist on expected columns
- `gerenta` role exists in check constraint
- `AppRole` type includes `gerenta`
