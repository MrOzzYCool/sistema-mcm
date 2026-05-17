# Requirements Document

## Introduction

Módulo "Gerencia" de solo lectura para la Gerenta General del sistema MCM. Proporciona un dashboard ejecutivo con KPIs financieros, gráficos de ingresos/egresos, estado de trámites y vouchers recientes. Incluye filtros globales, exportación CSV/PDF server-side y opcionalmente programación de reportes por email. El módulo es accesible únicamente para los roles `gerenta` y `super_admin`.

## Glossary

- **Sistema_MCM**: La aplicación web Next.js del Instituto Margarita Cabrera que gestiona alumnos, pagos, trámites y operaciones académicas.
- **Módulo_Gerencia**: Sección del panel administrativo destinada exclusivamente a visualización de reportes ejecutivos.
- **Gerenta**: Rol de usuario con acceso de solo lectura al Módulo_Gerencia para supervisión financiera y operativa.
- **Dashboard_Gerencia**: Página principal del Módulo_Gerencia que muestra KPIs, gráficos y tablas resumidas.
- **API_Reportes**: Conjunto de endpoints server-side bajo `/api/admin/reports/` que proveen datos agregados para el Módulo_Gerencia.
- **Vista_Materializada**: Vista de base de datos pre-computada que se refresca periódicamente para mejorar el rendimiento de consultas agregadas.
- **Exportador**: Componente server-side que genera archivos CSV o PDF a partir de los datos de reportes.
- **RouteGuard**: Componente existente que restringe el acceso a páginas según el rol del usuario autenticado.
- **supabaseAdmin**: Cliente Supabase con Service Role key utilizado para consultas que requieren bypass de RLS.
- **KPI_Card**: Componente visual que muestra un indicador clave de rendimiento con título, valor y variación.

## Requirements

### Requirement 1: Registro del rol Gerenta

**User Story:** Como administrador del sistema, quiero que exista el rol `gerenta` en la base de datos, para que la Gerenta General pueda autenticarse y acceder al Módulo_Gerencia.

#### Acceptance Criteria

1. THE Sistema_MCM SHALL include the value `gerenta` in the `profiles.rol` check constraint while preserving all previously existing role values.
2. THE Sistema_MCM SHALL include `gerenta` in the `AppRole` TypeScript type definition.
3. WHEN a user with rol `gerenta` authenticates, THE Sistema_MCM SHALL return the value `gerenta` in the profile role query (`profiles.rol`) so that RouteGuard and API authorization checks identify the user as `gerenta`.
4. IF a user with rol `gerenta` authenticates and no corresponding row exists in the `profiles` table, THEN THE Sistema_MCM SHALL deny access and return an authorization error.

---

### Requirement 2: Navegación y acceso al Módulo Gerencia

**User Story:** Como Gerenta General, quiero ver un enlace "Gerencia" en el sidebar, para poder acceder al dashboard ejecutivo.

#### Acceptance Criteria

1. WHILE the authenticated user has role `gerenta` or `super_admin`, THE Sistema_MCM SHALL display a navigation item labeled "GERENCIA" in the Sidebar component that links to `/dashboard/gerencia`.
2. WHILE the authenticated user has a role other than `gerenta` or `super_admin`, THE Sistema_MCM SHALL not render the "GERENCIA" navigation item in the Sidebar DOM.
3. WHEN a user without role `gerenta` or `super_admin` navigates to `/dashboard/gerencia`, THE RouteGuard SHALL display a brief "Acceso denegado" message and redirect the user to `/dashboard/tramites-externos` within 3 seconds.
4. WHEN an authenticated user with role `gerenta` or `super_admin` clicks the "GERENCIA" navigation item, THE Sistema_MCM SHALL navigate to `/dashboard/gerencia` and highlight the item as active in the Sidebar.

---

### Requirement 3: Dashboard principal con KPIs

**User Story:** Como Gerenta General, quiero ver indicadores clave financieros en el dashboard, para tener una visión rápida del estado económico del instituto.

#### Acceptance Criteria

1. WHEN the Dashboard_Gerencia loads, THE Sistema_MCM SHALL display KPI_Cards for: Total pagado, Total pendiente, Total ingresos del periodo, Total egresos del periodo, and Porcentaje de cobranza, showing monetary values with two decimal places.
2. THE KPI_Card for "Porcentaje de cobranza" SHALL calculate the value as (Total pagado / (Total pagado + Total pendiente)) × 100, rounded to one decimal place.
3. IF both Total pagado and Total pendiente equal zero, THEN THE KPI_Card for "Porcentaje de cobranza" SHALL display "0.0%".
4. WHEN the user applies global filters (date range, carrera, ciclo), THE Sistema_MCM SHALL recalculate all KPI values within 3 seconds using only data matching the applied filters.
5. IF the API_Reportes request for KPI data fails, THEN THE Sistema_MCM SHALL display an error message indicating the data could not be loaded and provide a retry option.

---

### Requirement 4: Gráfico de ingresos vs egresos

**User Story:** Como Gerenta General, quiero ver un gráfico de líneas con ingresos y egresos mensuales, para identificar tendencias financieras a lo largo del tiempo.

#### Acceptance Criteria

1. WHEN the Dashboard_Gerencia loads, THE Sistema_MCM SHALL display a line chart showing monthly income and expenses for the last 12 calendar months, with one data point per month on the X-axis and monetary values (in PEN) on the Y-axis.
2. WHEN the user changes the date range filter, THE Sistema_MCM SHALL update the line chart to reflect only the months within the selected period.
3. THE line chart SHALL use two visually distinct colors for the income series and the expense series, and SHALL include a legend identifying each series.
4. IF no financial data exists for the selected period, THEN THE Sistema_MCM SHALL display the line chart with zero values for all months and a message indicating no data is available.

---

### Requirement 5: Gráfico de trámites por estado

**User Story:** Como Gerenta General, quiero ver un gráfico de dona con la distribución de trámites por estado, para entender la carga operativa actual.

#### Acceptance Criteria

1. WHEN the Dashboard_Gerencia loads, THE Sistema_MCM SHALL display a donut chart showing the count of solicitudes grouped by estado (pendiente, aprobado, observado, rechazado), with each segment labeled with its count and percentage of the total.
2. WHEN the user applies global filters (date range, carrera, ciclo), THE Sistema_MCM SHALL update the donut chart to reflect only solicitudes matching all applied filters.
3. IF no solicitudes exist for the selected filters, THEN THE Sistema_MCM SHALL display an empty donut chart with a message indicating no data is available.

---

### Requirement 6: Tabla de últimos vouchers

**User Story:** Como Gerenta General, quiero ver una tabla con los últimos 50 vouchers, para monitorear la actividad de pagos reciente.

#### Acceptance Criteria

1. WHEN the Dashboard_Gerencia loads, THE Sistema_MCM SHALL display a table with up to 50 of the most recent payment_vouchers ordered by created_at descending.
2. THE table SHALL show columns: alumno nombre_completo, monto (installment amount formatted with 2 decimal places and currency symbol S/), fecha (voucher created_at), status, and a link to the comprobante file when the associated installment has a comprobante_url value.
3. WHEN a voucher's associated installment has no comprobante_url, THE Sistema_MCM SHALL display the text "Sin comprobante" in the comprobante column instead of a link.
4. IF fewer than 50 payment_vouchers exist, THEN THE Sistema_MCM SHALL display all available vouchers without error.

---

### Requirement 7: Filtros globales

**User Story:** Como Gerenta General, quiero aplicar filtros de rango de fechas, carrera y ciclo, para segmentar los datos del dashboard según mis necesidades de análisis.

#### Acceptance Criteria

1. THE Dashboard_Gerencia SHALL provide filter controls for: date range (from/to date pickers), a carrera dropdown populated from existing carreras in the system, and a ciclo dropdown populated from existing ciclos in the system.
2. WHEN the user selects a date range, THE Sistema_MCM SHALL apply the range to all KPIs, charts, and tables on the page.
3. WHEN the user selects a carrera filter, THE Sistema_MCM SHALL filter data to show only records associated with the selected carrera.
4. WHEN the user selects a ciclo filter, THE Sistema_MCM SHALL filter data to show only records associated with the selected ciclo.
5. WHEN no filters are applied, THE Sistema_MCM SHALL display data for the current calendar month (first day to last day of the current month) by default.
6. IF the user selects a "from" date that is after the "to" date, THEN THE Sistema_MCM SHALL prevent the filter from being applied and display an error message indicating the date range is invalid.
7. WHEN the user activates multiple filters simultaneously, THE Sistema_MCM SHALL apply all active filters as AND conditions to the data.

---

### Requirement 8: Endpoint de resumen financiero

**User Story:** Como desarrollador, quiero un endpoint que devuelva el resumen financiero agregado, para alimentar los KPIs y gráficos del dashboard.

#### Acceptance Criteria

1. WHEN a GET request is made to `/api/admin/reports/summary` with valid `from` and `to` query parameters in ISO 8601 date format (YYYY-MM-DD), THE API_Reportes SHALL return total_pagado, total_pendiente, total_ingresos, total_egresos, and porcentaje_cobranza for the specified period.
2. WHEN a GET request is made to `/api/admin/reports/financials` with valid `from`, `to` (ISO 8601 date format), and `group_by=month` parameters, THE API_Reportes SHALL return an array of monthly aggregates with fields: month, ingresos, and egresos.
3. IF the request lacks a valid JWT with role `gerenta` or `super_admin`, THEN THE API_Reportes SHALL return HTTP 403 status.
4. IF the `from` or `to` query parameters are missing or not in valid ISO 8601 date format, THEN THE API_Reportes SHALL return HTTP 400 status with an error message indicating the invalid parameters.
5. IF no financial data exists for the specified period, THEN THE API_Reportes SHALL return the standard response structure with zero values for all numeric fields and an empty array for monthly aggregates.
6. THE API_Reportes SHALL use supabaseAdmin for database queries to bypass RLS restrictions.

---

### Requirement 9: Endpoint de trámites

**User Story:** Como desarrollador, quiero un endpoint que devuelva datos agregados de trámites, para alimentar el gráfico de dona y la página secundaria de trámites.

#### Acceptance Criteria

1. WHEN a GET request is made to `/api/admin/reports/tramites` with valid `from` and `to` query parameters in ISO 8601 date format (YYYY-MM-DD), THE API_Reportes SHALL return a JSON object containing counts of solicitudes grouped by estado (pendiente, aprobado, observado, rechazado) for solicitudes with `created_at` within the specified date range.
2. WHERE the optional `estado` query parameter is provided with a value matching one of the valid estados (pendiente, aprobado, observado, rechazado), THE API_Reportes SHALL filter results to include only solicitudes matching the specified estado.
3. IF the request lacks a valid JWT with role `gerenta` or `super_admin`, THEN THE API_Reportes SHALL return HTTP 403 status with a JSON body containing an error field.
4. IF the `from` or `to` query parameters are missing or not valid ISO 8601 dates, THEN THE API_Reportes SHALL return HTTP 400 status with a JSON body containing an error field indicating the invalid parameters.
5. IF the `estado` query parameter is provided with a value not in the valid set (pendiente, aprobado, observado, rechazado), THEN THE API_Reportes SHALL return HTTP 400 status with a JSON body containing an error field indicating the invalid estado value.

---

### Requirement 10: Exportación server-side (CSV y PDF)

**User Story:** Como Gerenta General, quiero exportar los reportes en formato CSV o PDF, para compartirlos con otros directivos o archivarlos.

#### Acceptance Criteria

1. WHEN a GET request is made to `/api/admin/reports/export` with `type=financials`, `format=csv`, and valid `from` and `to` parameters in ISO 8601 date format, THE Exportador SHALL return a CSV file containing the financial data for the specified period with Content-Type `text/csv` and Content-Disposition header set to `attachment` with a descriptive filename.
2. WHEN a GET request is made to `/api/admin/reports/export` with `type=financials`, `format=pdf`, and valid `from` and `to` parameters in ISO 8601 date format, THE Exportador SHALL return a PDF file containing the financial data for the specified period with Content-Type `application/pdf` and Content-Disposition header set to `attachment` with a descriptive filename.
3. WHEN a GET request is made to `/api/admin/reports/export` with `type=tramites`, `format=csv`, and valid `from` and `to` parameters in ISO 8601 date format, THE Exportador SHALL return a CSV file containing tramites data for the specified period with Content-Type `text/csv` and Content-Disposition header set to `attachment` with a descriptive filename.
4. WHEN a GET request is made to `/api/admin/reports/export` with `type=tramites`, `format=pdf`, and valid `from` and `to` parameters in ISO 8601 date format, THE Exportador SHALL return a PDF file containing tramites data for the specified period with Content-Type `application/pdf` and Content-Disposition header set to `attachment` with a descriptive filename.
5. IF the request lacks a valid JWT with role `gerenta` or `super_admin`, THEN THE Exportador SHALL return HTTP 403 status with a JSON body containing an error field.
6. IF the `type` parameter is not one of `financials` or `tramites`, or the `format` parameter is not one of `csv` or `pdf`, THEN THE Exportador SHALL return HTTP 400 status with a JSON body containing an error field indicating the invalid parameter.
7. IF the `from` or `to` query parameters are missing or not valid ISO 8601 dates, THEN THE Exportador SHALL return HTTP 400 status with a JSON body containing an error field indicating the invalid date parameters.
8. THE Sistema_MCM SHALL provide "Exportar CSV" and "Exportar PDF" buttons in the Dashboard_Gerencia and secondary pages that trigger a download request to the export endpoint with the currently applied filters.

---

### Requirement 11: Módulo read-only

**User Story:** Como administrador del sistema, quiero que el Módulo_Gerencia sea estrictamente de solo lectura, para evitar modificaciones accidentales a los datos desde esta interfaz.

#### Acceptance Criteria

1. THE Módulo_Gerencia SHALL NOT render any buttons, forms, or controls that allow editing, approving, deleting, or modifying records.
2. THE API_Reportes endpoints (all routes under `/api/admin/reports/`) SHALL only support the GET HTTP method.
3. IF a non-GET request (POST, PUT, PATCH, DELETE) is made to any API_Reportes endpoint, THEN THE API_Reportes SHALL return HTTP 405 status with an `Allow: GET` response header.

---

### Requirement 12: Páginas secundarias (Finanzas y Trámites)

**User Story:** Como Gerenta General, quiero páginas dedicadas para Finanzas y Trámites con tablas completas y filtros, para analizar datos en detalle.

#### Acceptance Criteria

1. THE Módulo_Gerencia SHALL include a secondary page at `/dashboard/gerencia/finanzas` displaying a paginated table of financial records with columns: fecha, concepto, monto, tipo (ingreso/egreso), and estado, with a maximum of 50 rows per page.
2. THE Módulo_Gerencia SHALL include a secondary page at `/dashboard/gerencia/tramites` displaying a paginated table of solicitudes with columns: fecha, tipo_tramite, alumno, costo, estado, with a maximum of 50 rows per page.
3. WHEN the user applies filters (date range, carrera, estado) on a secondary page, THE Sistema_MCM SHALL filter the table data to show only records matching all applied filter criteria simultaneously.
4. WHEN no filters are applied on a secondary page, THE Sistema_MCM SHALL display data for the current calendar month by default.
5. THE secondary pages SHALL include "Exportar CSV" and "Exportar PDF" buttons that trigger server-side export of the currently filtered dataset via the `/api/admin/reports/export` endpoint.

---

### Requirement 13: Vistas de base de datos para reportes

**User Story:** Como desarrollador, quiero vistas de base de datos pre-definidas para reportes, para simplificar las consultas y mejorar el rendimiento.

#### Acceptance Criteria

1. THE Sistema_MCM SHALL create a database view `admin.report_financial_summary` that aggregates total ingresos (sum of monto where status = 'pagado') and total egresos by month from the installments table, returning columns: month (YYYY-MM format), total_ingresos, and total_egresos.
2. THE Sistema_MCM SHALL create a database view `admin.report_tramites_overview` that provides counts of solicitudes grouped by estado (pendiente, aprobado, observado, rechazado) and average processing time in days (difference between created_at and the timestamp when estado changed from pendiente) for each estado.
3. THE Sistema_MCM SHALL create a database view `admin.report_recent_vouchers` that returns the 50 most recent payment_vouchers ordered by created_at descending, with columns: alumno name (from profiles.nombre_completo), monto (from related installment), fecha (payment_vouchers.created_at), and status.
4. IF the dataset exceeds 10,000 records in any source table used by the views, THEN THE Sistema_MCM SHALL implement materialized views in place of regular views, with a refresh interval of no more than 60 minutes.

---

### Requirement 14: Índices de rendimiento

**User Story:** Como desarrollador, quiero índices en las columnas usadas por filtros, para que las consultas del Módulo_Gerencia respondan en tiempos aceptables.

#### Acceptance Criteria

1. THE Sistema_MCM SHALL create database indexes on `installments.due_date`, `installments.status`, and `installments.carrera_id` columns.
2. IF the indexes on `solicitudes.created_at` and `solicitudes.estado` do not already exist, THEN THE Sistema_MCM SHALL create database indexes on those columns.
3. THE Sistema_MCM SHALL create a database index on `payment_vouchers.created_at` column.
4. WHEN any API_Reportes endpoint is queried with filters applied, THE Sistema_MCM SHALL return the response within 2 seconds for datasets up to 50,000 records in the source tables.

---

### Requirement 15: Programación de reportes por email (opcional)

**User Story:** Como Gerenta General, quiero programar el envío automático de reportes por email, para recibir actualizaciones periódicas sin ingresar al sistema.

#### Acceptance Criteria

1. WHERE the "Schedule report" feature is enabled, THE Sistema_MCM SHALL display a "Programar reporte" button in the Dashboard_Gerencia.
2. WHEN the user clicks "Programar reporte", THE Sistema_MCM SHALL present a form with options for: frequency (diario or semanal), report type (financials or tramites), and export format (CSV or PDF).
3. WHEN the user confirms a schedule, THE Sistema_MCM SHALL store the schedule configuration including frequency, report type, format, and recipient email, and send the report to the user's registered email at 08:00 local time for diario schedules or Monday at 08:00 local time for semanal schedules.
4. IF the scheduled email fails to send, THEN THE Sistema_MCM SHALL log the error and retry sending on the next scheduled interval, up to a maximum of 3 consecutive failed attempts before disabling the schedule.
5. WHEN the user has an active schedule, THE Sistema_MCM SHALL display the schedule details and provide a "Cancelar programación" option to delete the schedule.

---

### Requirement 16: Tests de endpoints

**User Story:** Como desarrollador, quiero tests básicos para los endpoints de reportes, para verificar que responden correctamente y validan permisos.

#### Acceptance Criteria

1. THE Sistema_MCM SHALL include tests that verify each API_Reportes endpoint (`/api/admin/reports/summary`, `/api/admin/reports/financials`, `/api/admin/reports/tramites`, `/api/admin/reports/export`) returns HTTP 200 and a valid JSON response body for authenticated GET requests with role `gerenta` or `super_admin` and valid required query parameters.
2. THE Sistema_MCM SHALL include tests that verify each API_Reportes endpoint returns HTTP 403 for requests authenticated with roles other than `gerenta` or `super_admin`.
3. THE Sistema_MCM SHALL include tests that verify each API_Reportes endpoint returns HTTP 405 for non-GET requests (POST, PUT, DELETE).
4. THE Sistema_MCM SHALL include tests that verify each API_Reportes endpoint returns HTTP 400 when required query parameters (`from`, `to`) are missing or contain invalid date formats.

---

### Requirement 17: Documentación

**User Story:** Como desarrollador, quiero documentación actualizada en el README, para que el equipo conozca las rutas de API, vistas creadas y variables de entorno necesarias.

#### Acceptance Criteria

1. THE Sistema_MCM SHALL document all API_Reportes endpoint routes in a "Módulo Gerencia - API" section of the project README, including for each endpoint: the URL path, supported HTTP method, required authentication role, query parameters with their types and whether they are required or optional, and the response JSON structure.
2. THE Sistema_MCM SHALL document all database views created for the Módulo_Gerencia in the project README, including for each view: the view name, source tables, columns returned, and refresh strategy if materialized.
3. THE Sistema_MCM SHALL document any new environment variables required for the export and email scheduling features in the project README, including for each variable: the variable name, purpose, expected format, and an example value.
