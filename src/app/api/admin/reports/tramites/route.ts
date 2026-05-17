import { NextRequest, NextResponse } from "next/server";
import { verifyGerenciaAccess } from "@/lib/verify-gerencia-access";
import { validateDateParams } from "@/lib/validate-date-params";
import { supabaseAdmin } from "@/lib/supabase-admin";

const ESTADOS_VALIDOS = ["pendiente", "aprobado", "observado", "rechazado"] as const;
const MAX_LIMIT = 50;
const DEFAULT_LIMIT = 50;
const DEFAULT_PAGE = 1;

/**
 * GET /api/admin/reports/tramites
 *
 * Devuelve conteos de trámites por estado y lista paginada de items.
 * Query params: from, to (requeridos), estado, carrera, ciclo, page, limit (opcionales)
 */
export async function GET(req: NextRequest) {
  // 1. Auth
  const user = await verifyGerenciaAccess(req);
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  // 2. Validar fechas
  const searchParams = req.nextUrl.searchParams;
  const dateResult = validateDateParams(
    searchParams.get("from"),
    searchParams.get("to")
  );
  if (!dateResult.valid) {
    return NextResponse.json(
      { error: dateResult.error },
      { status: dateResult.status }
    );
  }

  const { from, to } = dateResult;

  // 3. Validar estado (opcional)
  const estado = searchParams.get("estado");
  if (estado && !ESTADOS_VALIDOS.includes(estado as typeof ESTADOS_VALIDOS[number])) {
    return NextResponse.json(
      {
        error:
          "Estado inválido. Valores permitidos: pendiente, aprobado, observado, rechazado",
      },
      { status: 400 }
    );
  }

  // 4. Filtros opcionales
  const carrera = searchParams.get("carrera");
  const ciclo = searchParams.get("ciclo");

  // 5. Paginación
  let page = Number(searchParams.get("page")) || DEFAULT_PAGE;
  if (page < 1) page = DEFAULT_PAGE;

  let limit = Number(searchParams.get("limit")) || DEFAULT_LIMIT;
  if (limit < 1) limit = DEFAULT_LIMIT;
  if (limit > MAX_LIMIT) limit = MAX_LIMIT;

  const offset = (page - 1) * limit;

  try {
    // 6. Build base filter for counts query (all matching records)
    let countsQuery = supabaseAdmin
      .from("solicitudes")
      .select("estado")
      .gte("created_at", `${from}T00:00:00`)
      .lte("created_at", `${to}T23:59:59`);

    if (estado) {
      countsQuery = countsQuery.eq("estado", estado);
    }
    if (carrera) {
      countsQuery = countsQuery.eq("carrera", carrera);
    }

    const { data: countsData, error: countsError } = await countsQuery;

    if (countsError) {
      console.error(
        "[REPORTS/TRAMITES] Error querying counts:",
        countsError.message
      );
      return NextResponse.json(
        { error: "Error interno al consultar datos" },
        { status: 500 }
      );
    }

    // 7. Calculate counts by estado
    const counts = {
      pendiente: 0,
      aprobado: 0,
      observado: 0,
      rechazado: 0,
    };

    for (const row of countsData ?? []) {
      const key = row.estado as keyof typeof counts;
      if (key in counts) {
        counts[key]++;
      }
    }

    // Total matching records
    const total = (countsData ?? []).length;

    // 8. Query paginated items directly from solicitudes
    let itemsQuery = supabaseAdmin
      .from("solicitudes")
      .select("id, created_at, tipo_tramite, nombres, apellidos, monto_pagado, estado")
      .gte("created_at", `${from}T00:00:00`)
      .lte("created_at", `${to}T23:59:59`)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (estado) {
      itemsQuery = itemsQuery.eq("estado", estado);
    }
    if (carrera) {
      itemsQuery = itemsQuery.eq("carrera", carrera);
    }

    const { data: itemsData, error: itemsError } = await itemsQuery;

    if (itemsError) {
      console.error(
        "[REPORTS/TRAMITES] Error querying items:",
        itemsError.message
      );
      return NextResponse.json(
        { error: "Error interno al consultar datos" },
        { status: 500 }
      );
    }

    // 9. Transform items to expected format
    const items = (itemsData ?? []).map((row) => ({
      id: row.id,
      fecha: row.created_at,
      tipo_tramite: row.tipo_tramite ?? "",
      alumno: `${row.nombres ?? ""} ${row.apellidos ?? ""}`.trim(),
      costo: Number(row.monto_pagado ?? 0),
      estado: row.estado,
    }));

    // 10. Return response
    return NextResponse.json({
      counts,
      items,
      total,
      page,
      limit,
    });
  } catch (err) {
    console.error("[REPORTS/TRAMITES] Unexpected error:", err);
    return NextResponse.json(
      { error: "Error interno al consultar datos" },
      { status: 500 }
    );
  }
}

// ─── Non-GET methods return 405 ─────────────────────────────────────────────

function methodNotAllowed() {
  return new NextResponse(null, {
    status: 405,
    headers: { Allow: "GET" },
  });
}

export function POST() {
  return methodNotAllowed();
}

export function PUT() {
  return methodNotAllowed();
}

export function PATCH() {
  return methodNotAllowed();
}

export function DELETE() {
  return methodNotAllowed();
}
