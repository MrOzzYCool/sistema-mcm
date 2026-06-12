import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { supabaseAdmin } from "@/lib/supabase-admin";

/**
 * GET /api/portal/mis-cursos-aula
 *
 * Devuelve los cursos del alumno logueado filtrados por su carrera y ciclo actual.
 * Usa supabaseAdmin para bypass de RLS.
 */
export async function GET(req: NextRequest) {
  const token = (req.headers.get("authorization") ?? "").replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { data: { user } } = await supabase.auth.getUser(token);
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  try {
    // 1. Get alumno's inscription
    const { data: inscripcion, error: inscError } = await supabaseAdmin
      .from("inscripciones")
      .select("carrera_id, ciclo_actual, carreras:carrera_id(nombre_carrera)")
      .eq("alumno_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (inscError || !inscripcion || !inscripcion.carrera_id || !inscripcion.ciclo_actual) {
      return NextResponse.json({
        cursos: [],
        carrera: null,
        ciclo: null,
        message: "No se encontró inscripción activa para este alumno",
      });
    }

    const carreraObj = inscripcion.carreras as unknown as { nombre_carrera?: string } | null;
    const nombreCarrera = carreraObj?.nombre_carrera ?? null;

    // 2. Get curso_ids from malla_curricular for this carrera
    const { data: malla } = await supabaseAdmin
      .from("malla_curricular")
      .select("curso_id")
      .eq("carrera_id", inscripcion.carrera_id);

    const cursoIds = (malla ?? []).map((m) => m.curso_id).filter(Boolean);

    if (cursoIds.length === 0) {
      return NextResponse.json({
        cursos: [],
        carrera: nombreCarrera,
        ciclo: inscripcion.ciclo_actual,
        message: "No hay cursos en la malla curricular para esta carrera",
      });
    }

    // 3. Get courses filtered by ciclo_perteneciente = ciclo_actual
    const { data: cursosData, error: cursosError } = await supabaseAdmin
      .from("cursos")
      .select("*")
      .in("id", cursoIds)
      .eq("ciclo_perteneciente", inscripcion.ciclo_actual);

    if (cursosError) {
      console.error("[MIS-CURSOS-AULA] Error:", cursosError.message);
      return NextResponse.json({ error: "Error al consultar cursos" }, { status: 500 });
    }

    // 4. Get professor names from class_schedules for these courses
    const foundCursoIds = (cursosData ?? []).map(c => c.id);
    let profesorMap: Record<string, string> = {};

    if (foundCursoIds.length > 0) {
      const { data: schedules } = await supabaseAdmin
        .from("class_schedules")
        .select("course_id, professor_id")
        .in("course_id", foundCursoIds);

      const profesorIds = [...new Set((schedules ?? []).map(s => s.professor_id).filter(Boolean))];

      if (profesorIds.length > 0) {
        const { data: profProfiles } = await supabaseAdmin
          .from("profiles")
          .select("id, nombre_completo")
          .in("id", profesorIds);

        const profNameMap = new Map((profProfiles ?? []).map(p => [p.id, p.nombre_completo]));

        // Map course_id → professor name
        for (const sched of schedules ?? []) {
          if (sched.course_id && sched.professor_id && !profesorMap[sched.course_id]) {
            profesorMap[sched.course_id] = profNameMap.get(sched.professor_id) ?? "";
          }
        }
      }
    }

    // 5. Enrich courses with professor names
    const cursosEnriquecidos = (cursosData ?? []).map(c => ({
      ...c,
      profesor: profesorMap[c.id] || c.profesor || null,
    }));

    return NextResponse.json({
      cursos: cursosEnriquecidos,
      carrera: nombreCarrera,
      ciclo: inscripcion.ciclo_actual,
    }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    console.error("[MIS-CURSOS-AULA] Unexpected error:", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
