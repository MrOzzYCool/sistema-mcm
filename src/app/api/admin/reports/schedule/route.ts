import { NextRequest, NextResponse } from "next/server";
import { verifyGerenciaAccess } from "@/lib/verify-gerencia-access";
import { supabaseAdmin } from "@/lib/supabase-admin";

const VALID_FREQUENCIES = ["diario", "semanal"] as const;
const VALID_REPORT_TYPES = ["financials", "tramites"] as const;
const VALID_FORMATS = ["csv", "pdf"] as const;

/**
 * GET /api/admin/reports/schedule
 *
 * Returns all active report schedules for the authenticated user.
 */
export async function GET(req: NextRequest) {
  const user = await verifyGerenciaAccess(req);
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  try {
    const { data, error } = await supabaseAdmin
      .from("report_schedules")
      .select("id, frequency, report_type, format, active, created_at, updated_at")
      .eq("user_id", user.id)
      .eq("active", true)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[REPORTS/SCHEDULE] Error querying schedules:", error.message);
      return NextResponse.json(
        { error: "Error interno al consultar datos" },
        { status: 500 }
      );
    }

    return NextResponse.json({ schedules: data ?? [] });
  } catch (err) {
    console.error("[REPORTS/SCHEDULE] Unexpected error:", err);
    return NextResponse.json(
      { error: "Error interno al consultar datos" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/reports/schedule
 *
 * Creates a new report schedule.
 * Body: { frequency, report_type, format }
 */
export async function POST(req: NextRequest) {
  const user = await verifyGerenciaAccess(req);
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  let body: { frequency?: string; report_type?: string; format?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Body JSON inválido" },
      { status: 400 }
    );
  }

  const { frequency, report_type, format } = body;

  // Validate frequency
  if (!frequency || !VALID_FREQUENCIES.includes(frequency as typeof VALID_FREQUENCIES[number])) {
    return NextResponse.json(
      { error: "Frecuencia inválida. Valores permitidos: diario, semanal" },
      { status: 400 }
    );
  }

  // Validate report_type
  if (!report_type || !VALID_REPORT_TYPES.includes(report_type as typeof VALID_REPORT_TYPES[number])) {
    return NextResponse.json(
      { error: "Tipo de reporte inválido. Valores permitidos: financials, tramites" },
      { status: 400 }
    );
  }

  // Validate format
  if (!format || !VALID_FORMATS.includes(format as typeof VALID_FORMATS[number])) {
    return NextResponse.json(
      { error: "Formato inválido. Valores permitidos: csv, pdf" },
      { status: 400 }
    );
  }

  try {
    const { data, error } = await supabaseAdmin
      .from("report_schedules")
      .insert({
        user_id: user.id,
        frequency,
        report_type,
        format,
        active: true,
      })
      .select("id, frequency, report_type, format, active, created_at, updated_at")
      .single();

    if (error) {
      console.error("[REPORTS/SCHEDULE] Error creating schedule:", error.message);
      return NextResponse.json(
        { error: "Error interno al crear programación" },
        { status: 500 }
      );
    }

    return NextResponse.json({ schedule: data }, { status: 201 });
  } catch (err) {
    console.error("[REPORTS/SCHEDULE] Unexpected error:", err);
    return NextResponse.json(
      { error: "Error interno al crear programación" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/reports/schedule
 *
 * Deactivates a report schedule (soft delete).
 * Body: { schedule_id }
 */
export async function DELETE(req: NextRequest) {
  const user = await verifyGerenciaAccess(req);
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  let body: { schedule_id?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Body JSON inválido" },
      { status: 400 }
    );
  }

  const { schedule_id } = body;

  if (!schedule_id) {
    return NextResponse.json(
      { error: "El campo 'schedule_id' es requerido" },
      { status: 400 }
    );
  }

  try {
    // Deactivate the schedule (only if it belongs to the user)
    const { data, error } = await supabaseAdmin
      .from("report_schedules")
      .update({ active: false, updated_at: new Date().toISOString() })
      .eq("id", schedule_id)
      .eq("user_id", user.id)
      .select("id, active")
      .single();

    if (error) {
      console.error("[REPORTS/SCHEDULE] Error deactivating schedule:", error.message);
      return NextResponse.json(
        { error: "Error interno al cancelar programación" },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json(
        { error: "Programación no encontrada" },
        { status: 404 }
      );
    }

    return NextResponse.json({ message: "Programación cancelada", schedule_id: data.id });
  } catch (err) {
    console.error("[REPORTS/SCHEDULE] Unexpected error:", err);
    return NextResponse.json(
      { error: "Error interno al cancelar programación" },
      { status: 500 }
    );
  }
}

// ─── Unsupported methods return 405 ─────────────────────────────────────────

function methodNotAllowed() {
  return new NextResponse(null, {
    status: 405,
    headers: { Allow: "GET, POST, DELETE" },
  });
}

export function PUT() {
  return methodNotAllowed();
}

export function PATCH() {
  return methodNotAllowed();
}
