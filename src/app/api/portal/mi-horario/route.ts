import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { supabaseAdmin } from "@/lib/supabase-admin";

/**
 * GET /api/portal/mi-horario
 *
 * Devuelve el horario semanal del alumno logueado basado en su carrera y ciclo actual.
 * Flujo: inscripciones (carrera_id, ciclo_actual) → malla_curricular (curso_ids) → class_schedules
 */
export async function GET(req: NextRequest) {
  const token = (req.headers.get("authorization") ?? "").replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { data: { user } } = await supabase.auth.getUser(token);
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  try {
    // 1. Obtener inscripción del alumno (carrera_id + ciclo_actual)
    const { data: inscripcion } = await supabaseAdmin
      .from("inscripciones")
      .select("carrera_id, ciclo_actual, carreras:carrera_id(nombre_carrera)")
      .eq("alumno_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (!inscripcion || !inscripcion.carrera_id || !inscripcion.ciclo_actual) {
      return NextResponse.json({
        horario: [],
        carrera: null,
        ciclo: null,
        message: "No se encontró inscripción activa",
      });
    }

    const { carrera_id, ciclo_actual } = inscripcion;
    const carreraObj = inscripcion.carreras as unknown as { nombre_carrera?: string } | null;
    const nombreCarrera = carreraObj?.nombre_carrera ?? "—";

    // 2. Obtener cursos de la malla curricular para esta carrera
    const { data: malla } = await supabaseAdmin
      .from("malla_curricular")
      .select("curso_id")
      .eq("carrera_id", carrera_id);

    const cursoIds = (malla ?? []).map((m) => m.curso_id).filter(Boolean);

    if (cursoIds.length === 0) {
      return NextResponse.json({
        horario: [],
        carrera: nombreCarrera,
        ciclo: ciclo_actual,
        message: "No hay cursos en la malla curricular",
      });
    }

    // 3. Obtener horarios de class_schedules para esos cursos y el ciclo actual
    const { data: schedules, error: schedError } = await supabaseAdmin
      .from("class_schedules")
      .select("id, course_id, day_of_week, start_time, end_time, location, cycle_number")
      .in("course_id", cursoIds)
      .eq("cycle_number", ciclo_actual)
      .order("day_of_week")
      .order("start_time");

    if (schedError) {
      console.error("[MI-HORARIO] Error querying schedules:", schedError.message);
      return NextResponse.json({ error: "Error al consultar horarios" }, { status: 500 });
    }

    if (!schedules || schedules.length === 0) {
      return NextResponse.json({
        horario: [],
        carrera: nombreCarrera,
        ciclo: ciclo_actual,
        message: "No se encontraron horarios programados para tu ciclo actual",
      });
    }

    // 4. Obtener nombres de cursos
    const scheduleCursoIds = [...new Set(schedules.map((s) => s.course_id))];
    const { data: cursos } = await supabaseAdmin
      .from("cursos")
      .select("id, nombre_curso")
      .in("id", scheduleCursoIds);

    const cursoMap = new Map((cursos ?? []).map((c) => [c.id, c.nombre_curso]));

    // 5. Mapear día numérico a nombre
    const DAY_NAMES: Record<number, string> = {
      1: "Lunes", 2: "Martes", 3: "Miércoles", 4: "Jueves", 5: "Viernes", 6: "Sábado",
    };

    // 6. Transformar datos para el frontend
    const horario = schedules.map((s) => ({
      id: s.id,
      dia: DAY_NAMES[s.day_of_week] ?? `Día ${s.day_of_week}`,
      dia_numero: s.day_of_week,
      curso: cursoMap.get(s.course_id) ?? "—",
      hora_inicio: s.start_time,
      hora_fin: s.end_time,
      aula: s.location ?? "—",
    }));

    return NextResponse.json({
      horario,
      carrera: nombreCarrera,
      ciclo: ciclo_actual,
    });
  } catch (err) {
    console.error("[MI-HORARIO] Unexpected error:", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
