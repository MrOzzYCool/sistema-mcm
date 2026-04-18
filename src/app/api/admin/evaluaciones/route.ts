import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { supabase } from "@/lib/supabase";

const ADMIN_EMAIL = "admin@margaritacabrera.edu.pe";

async function verifyAdmin(req: NextRequest) {
  const token = (req.headers.get("authorization") ?? "").replace("Bearer ", "");
  if (!token) return null;
  const { data: { user } } = await supabase.auth.getUser(token);
  if (!user?.email || user.email.toLowerCase() !== ADMIN_EMAIL) return null;
  return user;
}

/**
 * GET /api/admin/evaluaciones?curso_id=xxx
 */
export async function GET(req: NextRequest) {
  const admin = await verifyAdmin(req);
  if (!admin) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const cursoId = req.nextUrl.searchParams.get("curso_id");
  if (!cursoId) return NextResponse.json({ error: "curso_id requerido" }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from("evaluacion_config")
    .select("id, nombre_concepto, porcentaje, orden")
    .eq("curso_id", cursoId)
    .order("orden");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ evaluaciones: data ?? [] });
}

/**
 * POST /api/admin/evaluaciones
 * Replaces all evaluations for a course.
 */
export async function POST(req: NextRequest) {
  const admin = await verifyAdmin(req);
  if (!admin) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const { curso_id, evaluaciones } = await req.json();

  // Validations
  if (!curso_id) return NextResponse.json({ error: "curso_id requerido" }, { status: 400 });
  if (!Array.isArray(evaluaciones) || evaluaciones.length === 0) {
    return NextResponse.json({ error: "Debe haber al menos 1 evaluación" }, { status: 400 });
  }

  // Validate each evaluation
  for (const ev of evaluaciones) {
    if (!ev.nombre_concepto?.trim()) {
      return NextResponse.json({ error: "Todos los conceptos deben tener nombre" }, { status: 400 });
    }
    if (typeof ev.porcentaje !== "number" || ev.porcentaje <= 0) {
      return NextResponse.json({ error: `Porcentaje inválido para "${ev.nombre_concepto}"` }, { status: 400 });
    }
  }

  // Validate sum = 100
  const suma = evaluaciones.reduce((s: number, e: { porcentaje: number }) => s + e.porcentaje, 0);
  if (suma !== 100) {
    return NextResponse.json({ error: `La suma de porcentajes debe ser 100% (actual: ${suma}%)` }, { status: 400 });
  }

  // Verify course exists
  const { data: curso } = await supabaseAdmin.from("cursos").select("id").eq("id", curso_id).single();
  if (!curso) return NextResponse.json({ error: "Curso no encontrado" }, { status: 404 });

  try {
    // Delete existing evaluations for this course
    const { error: delErr } = await supabaseAdmin
      .from("evaluacion_config")
      .delete()
      .eq("curso_id", curso_id);
    if (delErr) throw new Error(`Error eliminando evaluaciones: ${delErr.message}`);

    // Insert new evaluations
    const rows = evaluaciones.map((ev: { nombre_concepto: string; porcentaje: number; orden?: number }, i: number) => ({
      curso_id,
      nombre_concepto: ev.nombre_concepto.trim(),
      porcentaje: ev.porcentaje,
      orden: ev.orden ?? i + 1,
    }));

    const { error: insErr } = await supabaseAdmin.from("evaluacion_config").insert(rows);
    if (insErr) throw new Error(`Error insertando evaluaciones: ${insErr.message}`);

    // Audit
    await supabaseAdmin.from("historial_auditoria").insert({
      accion: "configurar_evaluaciones",
      admin_id: admin.id,
      admin_email: admin.email,
      detalle: { curso_id, evaluaciones: rows.length, suma },
    });

    return NextResponse.json({ success: true, count: rows.length });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error interno" },
      { status: 500 },
    );
  }
}
