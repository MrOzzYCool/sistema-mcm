# Implementation Plan: Módulo Gerencia

## Overview

Implementación del módulo de solo lectura para la Gerenta General. Se sigue un orden que prioriza: esquema de base de datos → endpoints API → frontend → exportación → tests. El stack es TypeScript/Next.js con Supabase, Recharts para gráficos y jsPDF para generación de PDFs.

## Tasks

- [x] 1. Database schema changes (role, views, indexes)
  - [x] 1.1 Create SQL migration file with role, views, and indexes
    - Create `src/db/gerencia-schema.sql` with:
    - ALTER the `profiles.rol` check constraint to add `gerenta` while preserving all existing values
    - CREATE VIEW `report_financial_summary` aggregating installments by month with carrera_id and ciclo
    - CREATE VIEW `report_tramites_overview` joining solicitudes data
    - CREATE VIEW `report_recent_vouchers` joining payment_vouchers, installments, payment_plans, profiles (LIMIT 50, ORDER BY created_at DESC)
    - CREATE INDEX on `installments(due_date)`, `installments(status)`, `installments(carrera_id)` if not exists
    - CREATE INDEX on `solicitudes(created_at)`, `solicitudes(estado)` if not exists
    - CREATE INDEX on `payment_vouchers(created_at)` if not exists
    - Views must NOT modify or interfere with existing tables (SELECT only)
    - _Requirements: 1.1, 13.1, 13.2, 13.3, 14.1, 14.2, 14.3_

  - [x] 1.2 Update AppRole TypeScript type to include `gerenta`
    - In `src/lib/auth-context.tsx`, add `gerenta` to the `AppRole` type union
    - Ensure the role resolution logic in `resolveUser` handles `gerenta` correctly (it already reads from `profiles.rol`)
    - _Requirements: 1.2, 1.3_

- [x] 2. Shared utilities and types
  - [x] 2.1 Create TypeScript interfaces for gerencia module
    - Create `src/types/gerencia.ts` with interfaces: `FinancialSummary`, `MonthlyFinancial`, `TramitesCounts`, `TramiteRow`, `VoucherRow`, `GerenciaFilters`, `PaginatedResponse<T>`
    - _Requirements: 8.1, 8.2, 9.1_

  - [x] 2.2 Create auth helper for gerencia endpoints
    - Create `src/lib/verify-gerencia-access.ts` with `verifyGerenciaAccess(req: NextRequest)` function
    - Verify Bearer token via `supabase.auth.getUser(token)`
    - Query `profiles.rol` via `supabaseAdmin` and check role is `gerenta` or `super_admin`
    - Return user object or null
    - _Requirements: 8.3, 9.3, 10.5, 11.1_

  - [x] 2.3 Create date validation utility
    - Create `src/lib/validate-date-params.ts` with function to validate ISO 8601 date params (YYYY-MM-DD)
    - Validate `from` and `to` are present, valid format, and `from <= to`
    - Return parsed dates or error response
    - _Requirements: 8.4, 7.6_

- [x] 3. API endpoint: `/api/admin/reports/summary`
  - [x] 3.1 Implement GET handler for financial summary
    - Create `src/app/api/admin/reports/summary/route.ts`
    - Use `verifyGerenciaAccess` for auth
    - Accept query params: `from`, `to`, `carrera` (optional), `ciclo` (optional)
    - Query `report_financial_summary` view with filters
    - Query `report_recent_vouchers` view for latest 50 vouchers
    - Calculate `porcentaje_cobranza = (total_pagado / (total_pagado + total_pendiente)) * 100`
    - Handle division by zero (both zero → 0.0%)
    - Return 405 with `Allow: GET` header for non-GET methods
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 11.2, 11.3, 3.2, 3.3_

  - [ ]* 3.2 Write property tests for summary endpoint
    - **Property 4: Percentage calculation correctness**
    - **Validates: Requirements 3.2, 3.3**
    - Test with fast-check: for any non-negative total_pagado and total_pendiente, verify formula
    - Include zero/zero edge case

- [x] 4. API endpoint: `/api/admin/reports/financials`
  - [x] 4.1 Implement GET handler for monthly financials
    - Create `src/app/api/admin/reports/financials/route.ts`
    - Use `verifyGerenciaAccess` for auth
    - Accept query params: `from`, `to`, `group_by` (must be "month"), `carrera`, `ciclo`
    - Query `report_financial_summary` view filtered by date range
    - Return array of `{ month, ingresos, egresos }`
    - Return 405 with `Allow: GET` header for non-GET methods
    - _Requirements: 8.2, 8.3, 8.4, 8.5, 8.6, 11.2, 11.3_

- [x] 5. API endpoint: `/api/admin/reports/tramites`
  - [x] 5.1 Implement GET handler for tramites data
    - Create `src/app/api/admin/reports/tramites/route.ts`
    - Use `verifyGerenciaAccess` for auth
    - Accept query params: `from`, `to`, `estado` (optional), `carrera`, `ciclo`, `page`, `limit`
    - Query `report_tramites_overview` view with filters
    - Return counts by estado + paginated items list
    - Validate `estado` param against allowed values if provided
    - Return 405 with `Allow: GET` header for non-GET methods
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 11.2, 11.3_

  - [ ]* 5.2 Write property tests for tramites endpoint validation
    - **Property 9: Tramites estado filter correctness**
    - **Property 10: Invalid estado rejection**
    - **Validates: Requirements 9.2, 9.5**

- [x] 6. API endpoint: `/api/admin/reports/export`
  - [x] 6.1 Install jspdf dependency
    - Add `jspdf` to project dependencies (exact version)
    - _Requirements: 10.1, 10.2_

  - [x] 6.2 Create CSV generator utility
    - Create `src/lib/csv-generator.ts`
    - Implement `generateFinancialCSV(data: MonthlyFinancial[]): string`
    - Implement `generateTramitesCSV(data: TramiteRow[]): string`
    - Handle proper CSV escaping (quotes in fields, commas)
    - _Requirements: 10.1, 10.3_

  - [x] 6.3 Create PDF generator utility
    - Create `src/lib/pdf-generator.ts`
    - Implement `generateFinancialPDF(data: MonthlyFinancial[], filters: GerenciaFilters): Buffer`
    - Implement `generateTramitesPDF(data: TramiteRow[], filters: GerenciaFilters): Buffer`
    - Include header with title, date range, and institution name
    - Format table with columns matching the data type
    - _Requirements: 10.2, 10.4_

  - [x] 6.4 Implement GET handler for export endpoint
    - Create `src/app/api/admin/reports/export/route.ts`
    - Use `verifyGerenciaAccess` for auth
    - Accept query params: `type`, `format`, `from`, `to`, `carrera`, `ciclo`
    - Validate `type` ∈ {financials, tramites} and `format` ∈ {csv, pdf}
    - Query appropriate view based on type, apply filters
    - Generate CSV or PDF using utility functions
    - Set Content-Type and Content-Disposition headers correctly
    - Return 405 with `Allow: GET` header for non-GET methods
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7, 11.2, 11.3_

  - [ ]* 6.5 Write property tests for export endpoint
    - **Property 7: Export format correctness**
    - **Property 8: Export parameter validation**
    - **Validates: Requirements 10.1, 10.2, 10.3, 10.4, 10.6**

- [x] 7. Checkpoint - Ensure all API endpoints work
  - Ensure all tests pass, ask the user if questions arise.
  - Verify all 4 endpoints return correct responses with valid params
  - Verify 403 for unauthorized roles, 400 for invalid params, 405 for non-GET

- [ ] 8. Shared property tests for cross-cutting concerns
  - [ ]* 8.1 Write property tests for authorization and method enforcement
    - **Property 1: Authorization enforcement across all report endpoints**
    - **Property 2: Date parameter validation**
    - **Property 3: Read-only enforcement (HTTP method restriction)**
    - **Validates: Requirements 8.3, 8.4, 9.3, 9.4, 10.5, 10.7, 11.2, 11.3**
    - Install `fast-check` as dev dependency
    - Configure minimum 100 iterations per property
    - Test all 4 endpoints with generated invalid roles, dates, and HTTP methods

  - [ ]* 8.2 Write property test for date range filter correctness
    - **Property 5: Filter correctness — date range**
    - **Property 6: Filter correctness — invalid date range rejection**
    - **Validates: Requirements 7.2, 7.6, 8.1, 8.2, 12.3**

- [x] 9. Frontend: Sidebar navigation update
  - [x] 9.1 Add Gerencia nav item to Sidebar
    - Add entry to `NAV_ITEMS` array in `src/components/Sidebar.tsx`:
      `{ href: "/dashboard/gerencia", label: "Gerencia", icon: BarChart2, roles: ["super_admin", "gerenta"] }`
    - Use an appropriate Lucide icon (e.g., `PieChart` or `TrendingUp` to differentiate from existing "Reportes")
    - _Requirements: 2.1, 2.2, 2.4_

- [x] 10. Frontend: Dashboard Gerencia main page
  - [x] 10.1 Create GerenciaFilters component
    - Create `src/components/gerencia/GerenciaFilters.tsx`
    - Date range pickers (from/to) with validation (from ≤ to)
    - Carrera dropdown (fetch options from existing data)
    - Ciclo dropdown (fetch options from existing data)
    - Default to current month when no filters applied
    - Emit filter changes to parent via callback
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7_

  - [x] 10.2 Create ExportButtons component
    - Create `src/components/gerencia/ExportButtons.tsx`
    - Two buttons: "Exportar CSV" and "Exportar PDF"
    - Accept `type` prop ("financials" | "tramites") and current filters
    - Trigger download by calling `/api/admin/reports/export` with current filters
    - Show loading state during download
    - _Requirements: 10.8, 12.5_

  - [x] 10.3 Create GerenciaLayout component with internal navigation
    - Create `src/components/gerencia/GerenciaLayout.tsx`
    - Tab navigation: Dashboard | Finanzas | Trámites
    - Wrap children with consistent header and layout
    - _Requirements: 12.1, 12.2_

  - [x] 10.4 Implement Dashboard Gerencia main page
    - Create `src/app/dashboard/gerencia/page.tsx`
    - Client component with `useAuth()` hook
    - Role guard: if role not in {gerenta, super_admin}, show "Acceso denegado" and redirect after 3s
    - Fetch data from `/api/admin/reports/summary` and `/api/admin/reports/financials` and `/api/admin/reports/tramites`
    - Render 5 KPI cards (Total pagado, Total pendiente, Total ingresos, Total egresos, Porcentaje cobranza)
    - Render line chart (Recharts LineChart) for ingresos vs egresos by month
    - Render donut chart (Recharts PieChart) for tramites by estado
    - Render vouchers table (last 50)
    - Include GerenciaFilters and ExportButtons
    - NO edit/delete/approve buttons anywhere
    - _Requirements: 2.3, 3.1, 3.2, 3.3, 3.4, 3.5, 4.1, 4.2, 4.3, 4.4, 5.1, 5.2, 5.3, 6.1, 6.2, 6.3, 6.4, 11.1_

- [x] 11. Frontend: Secondary pages
  - [x] 11.1 Implement Finanzas secondary page
    - Create `src/app/dashboard/gerencia/finanzas/page.tsx`
    - Paginated table of financial records (max 50 per page)
    - Columns: fecha, concepto, monto, tipo (ingreso/egreso), estado
    - Include GerenciaFilters and ExportButtons (type="financials")
    - Default to current month when no filters
    - Pagination controls (prev/next)
    - _Requirements: 12.1, 12.3, 12.4, 12.5_

  - [x] 11.2 Implement Trámites secondary page
    - Create `src/app/dashboard/gerencia/tramites/page.tsx`
    - Paginated table of solicitudes (max 50 per page)
    - Columns: fecha, tipo_tramite, alumno, costo, estado
    - Include GerenciaFilters with additional estado filter and ExportButtons (type="tramites")
    - Default to current month when no filters
    - Pagination controls (prev/next)
    - _Requirements: 12.2, 12.3, 12.4, 12.5_

- [x] 12. Checkpoint - Ensure frontend renders correctly
  - Ensure all tests pass, ask the user if questions arise.
  - Verify dashboard loads with KPIs, charts, and table
  - Verify secondary pages load with paginated tables
  - Verify filters work across all pages
  - Verify export buttons trigger downloads

- [x] 13. Scheduled reports (optional feature)
  - [x] 13.1 Implement scheduled report configuration
    - Create `src/app/api/admin/reports/schedule/route.ts` (GET to list, POST to create/update, DELETE to cancel)
    - Note: This is the ONE exception to read-only — schedule management requires POST/DELETE but only for the schedule config, not for report data
    - Store schedule in a new `report_schedules` table (user_id, frequency, report_type, format, active)
    - Use Resend for email delivery
    - _Requirements: 15.1, 15.2, 15.3, 15.4, 15.5_

- [x] 14. Documentation
  - [x] 14.1 Update README with Módulo Gerencia documentation
    - Add "Módulo Gerencia - API" section documenting all endpoints (URL, method, auth, params, response)
    - Document database views (name, source tables, columns, refresh strategy)
    - Document any new environment variables
    - _Requirements: 17.1, 17.2, 17.3_

- [x] 15. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.
  - Verify all API endpoints respond correctly
  - Verify frontend pages render without errors
  - Verify export functionality works for both CSV and PDF
  - Verify role-based access control works end-to-end

## Task Dependency Graph

```json
{
  "waves": [
    { "tasks": ["1"] },
    { "tasks": ["2"] },
    { "tasks": ["3", "4", "5", "6"] },
    { "tasks": ["7"] },
    { "tasks": ["8", "9"] },
    { "tasks": ["10"] },
    { "tasks": ["11"] },
    { "tasks": ["12"] },
    { "tasks": ["13", "14"] },
    { "tasks": ["15"] }
  ]
}
```

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties using `fast-check`
- Unit tests validate specific examples and edge cases
- The `gerenta` role has NO write permissions — all endpoints are GET-only (except optional schedule management)
- SQL views are SELECT-only and do not modify existing tables
- PDF generation uses `jspdf` server-side to avoid client bundle bloat
