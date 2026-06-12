import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { supabaseAdmin } from "@/lib/supabase-admin";

/**
 * GET /api/portal/cursos-docente
 *
 * Devuelve los cursos asignados al profesor logueado.
 * Flujo: class_schedules (professor_id) → cursos
 */
export async function GET(req: NextRequest) {
  const token = (req.headers.get("authorization") ?? "").replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { data: { user } } = await supabase.auth.getUser(token);
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  // Verify role is profesor
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("rol")
    .eq("id", user.id)
    .single();

  if (!profile || profile.rol !== "profesor") {
    return NextResponse.json({ error: "Acceso denegado" }, { status: 403 });
  }

  try {
    // 1. Get course_ids from class_schedules where professor_id = user.id
    const { data: schedules } = await supabaseAdmin
      .from("class_schedules")
      .select("course_id, cycle_number")
      .eq("professor_id", user.id);

    const courseIds = [...new Set((schedules ?? []).map(s => s.course_id).filter(Boolean))];

    if (courseIds.length === 0) {
      return NextResponse.json({ cursos: [], message: "No tienes cursos asignados" });
    }

    // 2. Get course details
    const { data: cursos, error: cursosError } = await supabaseAdmin
      .from("cursos")
      .select("*")
      .in("id", courseIds)
      .order("ciclo_perteneciente");

    if (cursosError) {
      return NextResponse.json({ error: "Error al consultar cursos" }, { status: 500 });
    }

    // 3. Enrich with carrera name via malla_curricular
    const allCursoIds = (cursos ?? []).map(c => c.id);
    let carreraMap: Record<string, string> = {};

    if (allCursoIds.length > 0) {
      const { data: malla } = await supabaseAdmin
        .from("malla_curricular")
        .select("curso_id, carreras:carrera_id(nombre_carrera)")
        .in("curso_id", allCursoIds);

      for (const m of malla ?? []) {
        const carreraObj = m.carreras as unknown as { nombre_carrera?: string } | null;
        if (carreraObj?.nombre_carrera && !carreraMap[m.curso_id]) {
          carreraMap[m.curso_id] = carreraObj.nombre_carrera;
        }
      }
    }

    const cursosEnriquecidos = (cursos ?? []).map(c => ({
      ...c,
      carrera: carreraMap[c.id] || c.carrera || null,
    }));

    return NextResponse.json({ cursos: cursosEnriquecidos }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("[CURSOS-DOCENTE] Error:", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
