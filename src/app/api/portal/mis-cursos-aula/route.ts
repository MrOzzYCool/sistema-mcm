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

    return NextResponse.json({
      cursos: cursosData ?? [],
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
