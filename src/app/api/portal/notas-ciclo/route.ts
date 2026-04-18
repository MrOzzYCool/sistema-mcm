import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { supabaseAdmin } from "@/lib/supabase-admin";

/**
 * GET /api/portal/notas-ciclo?ciclo=1
 * Returns all courses for a cycle with their evaluation config and student grades.
 */
export async function GET(req: NextRequest) {
  const token = (req.headers.get("authorization") ?? "").replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { data: { user } } = await supabase.auth.getUser(token);
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const ciclo = parseInt(req.nextUrl.searchParams.get("ciclo") ?? "0");
  if (!ciclo) return NextResponse.json({ error: "ciclo requerido" }, { status: 400 });

  // Get student's courses for this cycle
  const { data: alumnoCursos } = await supabaseAdmin
    .from("alumno_cursos")
    .select("id, curso_id, ciclo, estado, cursos(nombre_curso, creditos)")
    .eq("alumno_id", user.id)
    .eq("ciclo", ciclo)
    .order("created_at");

  if (!alumnoCursos?.length) {
    return NextResponse.json({ cursos: [] });
  }

  // Get evaluation configs for all these courses
  const cursoIds = alumnoCursos.map(ac => ac.curso_id);
  const { data: configs } = await supabaseAdmin
    .from("evaluacion_config")
    .select("id, curso_id, nombre_concepto, porcentaje, orden")
    .in("curso_id", cursoIds)
    .order("orden");

  // Get student's grades for all these configs
  const configIds = (configs ?? []).map(c => c.id);
  let notas: { evaluacion_config_id: string; nota: number | null }[] = [];
  if (configIds.length > 0) {
    const { data } = await supabaseAdmin
      .from("alumno_notas")
      .select("evaluacion_config_id, nota")
      .eq("alumno_id", user.id)
      .in("evaluacion_config_id", configIds);
    notas = data ?? [];
  }

  // Build response: courses with their evaluations and grades
  const notasMap = new Map(notas.map(n => [n.evaluacion_config_id, n.nota]));
  const configsByCurso = new Map<string, typeof configs>();
  for (const c of configs ?? []) {
    if (!configsByCurso.has(c.curso_id)) configsByCurso.set(c.curso_id, []);
    configsByCurso.get(c.curso_id)!.push(c);
  }

  const resultado = alumnoCursos.map(ac => ({
    id: ac.id,
    curso_id: ac.curso_id,
    nombre_curso: (ac.cursos as unknown as { nombre_curso: string })?.nombre_curso ?? "Sin nombre",
    creditos: (ac.cursos as unknown as { creditos: number })?.creditos ?? 0,
    estado: ac.estado,
    evaluaciones: (configsByCurso.get(ac.curso_id) ?? []).map(cfg => ({
      id: cfg.id,
      concepto: cfg.nombre_concepto,
      porcentaje: cfg.porcentaje,
      nota: notasMap.get(cfg.id) ?? null,
    })),
  }));

  return NextResponse.json({ cursos: resultado });
}
