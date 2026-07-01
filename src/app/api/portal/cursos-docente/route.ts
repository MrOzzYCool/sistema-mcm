import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

/**
 * GET /api/portal/cursos-docente
 *
 * Devuelve los cursos asignados al profesor logueado CON información de horarios.
 * Flujo: class_schedules (professor_id) → cursos + horarios
 */
export async function GET(req: NextRequest) {
  const token = (req.headers.get("authorization") ?? "").replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  // Use supabaseAdmin for token validation (bypass RLS issues)
  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  // Verify role is profesor (check both rol field and es_profesor flag)
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("rol, es_profesor")
    .eq("id", user.id)
    .single();

  if (!profile || (profile.rol !== "profesor" && !profile.es_profesor)) {
    return NextResponse.json({ error: "Acceso denegado" }, { status: 403 });
  }

  try {
    // 1. Get all schedules for this professor with course info
    const { data: schedules, error: schedError } = await supabaseAdmin
      .from("class_schedules")
      .select("id, course_id, cycle_number, day_of_week, start_time, end_time, location, start_date, end_date")
      .eq("professor_id", user.id)
      .order("day_of_week")
      .order("start_time");

    if (schedError) {
      return NextResponse.json({ error: "Error al consultar horarios" }, { status: 500 });
    }

    if (!schedules || schedules.length === 0) {
      return NextResponse.json({ cursos: [], message: "No tienes cursos asignados" });
    }

    // 2. Get course details for all course_ids
    const courseIds = [...new Set(schedules.map(s => s.course_id).filter(Boolean))];
    const { data: cursos } = await supabaseAdmin
      .from("cursos")
      .select("id, nombre_curso, ciclo_perteneciente")
      .in("id", courseIds);

    const cursoMap = new Map((cursos ?? []).map(c => [c.id, c]));

    // 3. Enrich with carrera name via malla_curricular
    let carreraMap: Record<string, string> = {};
    if (courseIds.length > 0) {
      const { data: malla } = await supabaseAdmin
        .from("malla_curricular")
        .select("curso_id, carreras:carrera_id(nombre_carrera)")
        .in("curso_id", courseIds);

      for (const m of malla ?? []) {
        const carreraObj = m.carreras as unknown as { nombre_carrera?: string } | null;
        if (carreraObj?.nombre_carrera && !carreraMap[m.curso_id]) {
          carreraMap[m.curso_id] = carreraObj.nombre_carrera;
        }
      }
    }

    // 4. Build response: one entry per schedule with course + horario info
    const cursosConHorario = schedules.map(s => {
      const curso = cursoMap.get(s.course_id);
      return {
        id: curso?.id ?? s.course_id,
        schedule_id: s.id,
        curso_id: s.course_id,
        nombre_curso: curso?.nombre_curso ?? "Curso sin nombre",
        ciclo_perteneciente: curso?.ciclo_perteneciente ?? s.cycle_number,
        cycle_number: s.cycle_number,
        dia_semana: s.day_of_week,
        hora_inicio: s.start_time,
        hora_fin: s.end_time,
        aula: s.location,
        start_date: s.start_date,
        end_date: s.end_date,
        carrera: carreraMap[s.course_id] ?? null,
        url_clase: null, // TODO: agregar campo url_clase a class_schedules si se necesita
      };
    });

    return NextResponse.json({ cursos: cursosConHorario }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("[CURSOS-DOCENTE] Error:", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
