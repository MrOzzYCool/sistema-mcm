import { NextRequest, NextResponse } from "next/server";
import { verifyGerenciaAccess } from "@/lib/verify-gerencia-access";
import { supabaseAdmin } from "@/lib/supabase-admin";

/**
 * GET /api/admin/reports/filter-options
 *
 * Devuelve las opciones disponibles para los filtros del módulo Gerencia:
 * - carreras: lista de carreras con id y nombre_carrera
 * - ciclos: lista de ciclos únicos disponibles en payment_plans
 */
export async function GET(req: NextRequest) {
  const user = await verifyGerenciaAccess(req);
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  try {
    // Fetch carreras
    const { data: carreras, error: carrerasError } = await supabaseAdmin
      .from("carreras")
      .select("id, nombre_carrera")
      .order("nombre_carrera");

    if (carrerasError) {
      console.error("[REPORTS/FILTER-OPTIONS] Error querying carreras:", carrerasError.message);
    }

    // Fetch unique ciclos from payment_plans
    const { data: ciclosData, error: ciclosError } = await supabaseAdmin
      .from("payment_plans")
      .select("ciclo")
      .order("ciclo");

    if (ciclosError) {
      console.error("[REPORTS/FILTER-OPTIONS] Error querying ciclos:", ciclosError.message);
    }

    // Deduplicate ciclos
    const ciclosSet = new Set<number>();
    for (const row of ciclosData ?? []) {
      if (row.ciclo != null) ciclosSet.add(Number(row.ciclo));
    }
    const ciclos = Array.from(ciclosSet).sort((a, b) => a - b);

    return NextResponse.json({
      carreras: (carreras ?? []).map((c) => ({
        id: c.id,
        nombre: c.nombre_carrera,
      })),
      ciclos,
    });
  } catch (err) {
    console.error("[REPORTS/FILTER-OPTIONS] Unexpected error:", err);
    return NextResponse.json(
      { error: "Error interno al consultar opciones de filtro" },
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

export function POST() { return methodNotAllowed(); }
export function PUT() { return methodNotAllowed(); }
export function PATCH() { return methodNotAllowed(); }
export function DELETE() { return methodNotAllowed(); }
