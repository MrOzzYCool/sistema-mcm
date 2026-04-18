import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { supabaseAdmin } from "@/lib/supabase-admin";

/**
 * GET /api/portal/mis-notas?curso_id=xxx
 * Returns evaluation config + student grades for a specific course.
 */
export async function GET(req: NextRequest) {
  const token = (req.headers.get("authorization") ?? "").replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { data: { user } } = await supabase.auth.getUser(token);
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const cursoId = req.nextUrl.searchParams.get("curso_id");
  if (!cursoId) return NextResponse.json({ error: "curso_id requerido" }, { status: 400 });

  // Get evaluation config for this course
  const { data: config } = await supabaseAdmin
    .from("evaluacion_config")
    .select("id, nombre_concepto, porcentaje, orden")
    .eq("curso_id", cursoId)
    .order("orden");

  // Get student's grades for these evaluation configs
  const configIds = (config ?? []).map(c => c.id);
  let notas: { evaluacion_config_id: string; nota: number | null }[] = [];

  if (configIds.length > 0) {
    const { data } = await supabaseAdmin
      .from("alumno_notas")
      .select("evaluacion_config_id, nota")
      .eq("alumno_id", user.id)
      .in("evaluacion_config_id", configIds);
    notas = data ?? [];
  }

  // Merge config with grades
  const notasMap = new Map(notas.map(n => [n.evaluacion_config_id, n.nota]));
  const resultado = (config ?? []).map(c => ({
    id: c.id,
    concepto: c.nombre_concepto,
    porcentaje: c.porcentaje,
    nota: notasMap.get(c.id) ?? null,
  }));

  return NextResponse.json({ evaluaciones: resultado });
}
