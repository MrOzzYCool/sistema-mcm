import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { supabase } from "@/lib/supabase";

const ADMIN_EMAIL = "admin@margaritacabrera.edu.pe";
const ALLOWED_ROLES = ["super_admin", "cycle_manager"];

// Mapeo: nombre del día (frontend) → número (BD: 1=Lunes ... 6=Sábado)
const DAY_MAP: Record<string, number> = {
  lunes: 1, martes: 2, miercoles: 3, jueves: 4, viernes: 5, sabado: 6,
};
const DAY_REVERSE: Record<number, string> = {
  1: "lunes", 2: "martes", 3: "miercoles", 4: "jueves", 5: "viernes", 6: "sabado",
};

async function verifyAdmin(req: NextRequest) {
  const token = (req.headers.get("authorization") ?? "").replace("Bearer ", "");
  if (!token) return null;
  const { data: { user } } = await supabase.auth.getUser(token);
  if (!user) return null;
  if (user.email?.toLowerCase() === ADMIN_EMAIL) return user;
  const { data: profile } = await supabaseAdmin
    .from("profiles").select("rol").eq("id", user.id).single();
  if (!profile || !ALLOWED_ROLES.includes(profile.rol)) return null;
  return user;
}

/** Calcula duración en minutos entre dos tiempos HH:MM */
function calcDurationMinutes(start: string, end: string): number {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  return (eh * 60 + em) - (sh * 60 + sm);
}

/**
 * GET /api/admin/schedules
 */
export async function GET(req: NextRequest) {
  const admin = await verifyAdmin(req);
  if (!admin) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  // Diagnóstico: devolver estructura de la tabla
  if (req.nextUrl.searchParams.get("diagnostico") === "1") {
    const { data, error } = await supabaseAdmin
      .from("class_schedules")
      .select("*")
      .limit(1);
    if (error) return NextResponse.json({ error: error.message, columns: null }, { status: 500 });
    const columns = data && data.length > 0 ? Object.keys(data[0]) : "tabla vacía";
    return NextResponse.json({ columns, sample: data?.[0] ?? null });
  }

  const { data, error } = await supabaseAdmin
    .from("class_schedules")
    .select("*")
    .order("day_of_week")
    .order("start_time");

  if (error) {
    console.error("[schedules GET] Error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Obtener profesores y cursos para enriquecer los datos
  const profesorIds = [...new Set((data ?? []).map(s => s.professor_id).filter(Boolean))];
  const cursoIds = [...new Set((data ?? []).map(s => s.course_id).filter(Boolean))];

  const [profRes, cursoRes] = await Promise.all([
    profesorIds.length > 0
      ? supabaseAdmin.from("profiles").select("id, nombre_completo").in("id", profesorIds)
      : Promise.resolve({ data: [] }),
    cursoIds.length > 0
      ? supabaseAdmin.from("cursos").select("id, nombre_curso, ciclo_perteneciente").in("id", cursoIds)
      : Promise.resolve({ data: [] }),
  ]);

  const profMap = new Map((profRes.data ?? []).map(p => [p.id, p]));
  const cursoMap = new Map((cursoRes.data ?? []).map(c => [c.id, c]));

  // Transformar para el frontend
  const schedules = (data ?? []).map(s => ({
    ...s,
    // Campos de compatibilidad para el frontend
    dia_semana: DAY_REVERSE[s.day_of_week] ?? "lunes",
    hora_inicio: s.start_time,
    hora_fin: s.end_time,
    aula: s.location,
    ciclo: s.cycle_number,
    // Datos enriquecidos
    profiles: profMap.get(s.professor_id) ?? { nombre_completo: "—" },
    cursos: cursoMap.get(s.course_id) ?? { nombre_curso: "—" },
  }));

  return NextResponse.json({ schedules });
}

/**
 * POST /api/admin/schedules
 * Body: { profesor_id, curso_id, ciclo, dia_semana, hora_inicio, hora_fin, aula? }
 *
 * Columnas reales en class_schedules:
 *   professor_id, course_id, cycle_number, day_of_week, start_time, end_time,
 *   duration_minutes, location, start_date, end_date
 */
export async function POST(req: NextRequest) {
  const admin = await verifyAdmin(req);
  if (!admin) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const body = await req.json();
  const { profesor_id, curso_id, ciclo, dia_semana, hora_inicio, hora_fin, aula } = body;

  // ── Validaciones ──────────────────────────────────────────────────────────

  if (!profesor_id || !curso_id || !ciclo || !dia_semana || !hora_inicio || !hora_fin) {
    return NextResponse.json(
      { error: "Campos requeridos: profesor_id, curso_id, ciclo, dia_semana, hora_inicio, hora_fin" },
      { status: 400 },
    );
  }

  const dayNumber = DAY_MAP[dia_semana.toLowerCase()];
  if (!dayNumber) {
    return NextResponse.json(
      { error: `Día inválido: "${dia_semana}". Valores: lunes, martes, miercoles, jueves, viernes, sabado` },
      { status: 400 },
    );
  }

  // Validate time format (HH:MM or HH:MM:SS)
  const timeRegex = /^\d{2}:\d{2}(:\d{2})?$/;
  if (!timeRegex.test(hora_inicio) || !timeRegex.test(hora_fin)) {
    return NextResponse.json({ error: "Formato de hora inválido. Usa HH:MM" }, { status: 400 });
  }

  if (hora_inicio >= hora_fin) {
    return NextResponse.json({ error: "hora_fin debe ser mayor que hora_inicio" }, { status: 400 });
  }

  // Calcular duración en minutos
  const durationMinutes = calcDurationMinutes(hora_inicio, hora_fin);

  // Verify profesor exists
  const { data: profesor } = await supabaseAdmin
    .from("profiles")
    .select("id, nombre_completo, rol")
    .eq("id", profesor_id)
    .single();

  if (!profesor) {
    return NextResponse.json({ error: "Profesor no encontrado" }, { status: 400 });
  }

  // Verify curso exists
  const { data: curso } = await supabaseAdmin
    .from("cursos")
    .select("id, nombre_curso")
    .eq("id", curso_id)
    .single();

  if (!curso) {
    return NextResponse.json({ error: "Curso no encontrado" }, { status: 400 });
  }

  // ── Check for overlapping schedules (same profesor, same day, same cycle) ──

  const { data: overlaps } = await supabaseAdmin
    .from("class_schedules")
    .select("id, start_time, end_time, course_id, location")
    .eq("professor_id", profesor_id)
    .eq("day_of_week", dayNumber)
    .eq("cycle_number", parseInt(ciclo));

  const conflictoProfesor = (overlaps ?? []).find(s => {
    return hora_inicio < s.end_time && s.start_time < hora_fin;
  });

  if (conflictoProfesor) {
    return NextResponse.json(
      { error: `El profesor ${profesor.nombre_completo} ya tiene una clase ese día de ${conflictoProfesor.start_time?.slice(0,5)} a ${conflictoProfesor.end_time?.slice(0,5)}` },
      { status: 409 },
    );
  }

  // ── Check for location (aula) overlap ─────────────────────────────────────

  if (aula && aula.trim()) {
    const { data: aulaOverlaps } = await supabaseAdmin
      .from("class_schedules")
      .select("id, start_time, end_time, professor_id")
      .eq("location", aula.trim())
      .eq("day_of_week", dayNumber)
      .eq("cycle_number", parseInt(ciclo));

    const conflictoAula = (aulaOverlaps ?? []).find(s => {
      return hora_inicio < s.end_time && s.start_time < hora_fin;
    });

    if (conflictoAula) {
      return NextResponse.json(
        { error: `El aula "${aula}" ya está ocupada ese día de ${conflictoAula.start_time?.slice(0,5)} a ${conflictoAula.end_time?.slice(0,5)}` },
        { status: 409 },
      );
    }
  }

  // ── Obtener fechas del ciclo ──────────────────────────────────────────────

  const { data: cycleOpening } = await supabaseAdmin
    .from("cycle_openings")
    .select("start_date, fecha_fin")
    .eq("cycle_number", parseInt(ciclo))
    .eq("status", "activo")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (!cycleOpening || !cycleOpening.start_date) {
    return NextResponse.json(
      { error: `No hay apertura activa para el Ciclo ${ciclo}. Apertura el ciclo primero.` },
      { status: 400 },
    );
  }

  if (!cycleOpening.fecha_fin) {
    return NextResponse.json(
      { error: `El Ciclo ${ciclo} no tiene fecha de culminación. Edita la apertura para agregar la fecha fin.` },
      { status: 400 },
    );
  }

  // Validar que las fechas del ciclo sean coherentes
  if (cycleOpening.fecha_fin < cycleOpening.start_date) {
    return NextResponse.json(
      { error: `Las fechas del Ciclo ${ciclo} son inválidas: la fecha fin es anterior a la fecha inicio.` },
      { status: 400 },
    );
  }

  // Validar que la fecha actual no sea posterior a la fecha fin del ciclo
  const hoy = new Date().toISOString().split("T")[0];
  if (hoy > cycleOpening.fecha_fin) {
    return NextResponse.json(
      { error: `El Ciclo ${ciclo} ya finalizó (${cycleOpening.fecha_fin}). No se pueden crear horarios fuera del rango del ciclo.` },
      { status: 400 },
    );
  }

  // ── INSERT con nombres EXACTOS de columnas ────────────────────────────────

  const insertPayload = {
    professor_id:     profesor_id,
    course_id:        curso_id,
    cycle_number:     parseInt(ciclo),
    day_of_week:      dayNumber,
    start_time:       hora_inicio,
    end_time:         hora_fin,
    duration_minutes: durationMinutes,
    location:         aula || null,
    start_date:       cycleOpening.start_date,
    end_date:         cycleOpening.fecha_fin ?? cycleOpening.start_date,
  };

  console.log("[schedules POST] INSERT payload:", JSON.stringify(insertPayload, null, 2));

  // Validación final
  if (!insertPayload.professor_id) return NextResponse.json({ error: "professor_id vacío" }, { status: 400 });
  if (!insertPayload.course_id) return NextResponse.json({ error: "course_id vacío" }, { status: 400 });
  if (!insertPayload.start_date) return NextResponse.json({ error: "start_date vacío" }, { status: 400 });
  if (!insertPayload.end_date) return NextResponse.json({ error: "end_date vacío" }, { status: 400 });

  const { data: schedule, error: insertErr } = await supabaseAdmin
    .from("class_schedules")
    .insert(insertPayload)
    .select()
    .single();

  if (insertErr) {
    console.error("[schedules POST] INSERT ERROR:", insertErr.message, "| Payload:", JSON.stringify(insertPayload));
    return NextResponse.json({ error: insertErr.message }, { status: 500 });
  }

  // Audit
  await supabaseAdmin.from("historial_auditoria").insert({
    accion: "crear_horario",
    admin_id: admin.id,
    admin_email: admin.email,
    target_id: profesor_id,
    detalle: { profesor: profesor.nombre_completo, curso: curso.nombre_curso, ...insertPayload },
  });

  return NextResponse.json({ success: true, schedule }, { status: 201 });
}

/**
 * PUT /api/admin/schedules
 * Body: { schedule_id, profesor_id, curso_id, ciclo, dia_semana, hora_inicio, hora_fin, aula? }
 */
export async function PUT(req: NextRequest) {
  const admin = await verifyAdmin(req);
  if (!admin) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const body = await req.json();
  const { schedule_id, profesor_id, curso_id, ciclo, dia_semana, hora_inicio, hora_fin, aula } = body;

  if (!schedule_id) return NextResponse.json({ error: "schedule_id requerido" }, { status: 400 });
  if (!profesor_id || !curso_id || !ciclo || !dia_semana || !hora_inicio || !hora_fin) {
    return NextResponse.json({ error: "Todos los campos son requeridos" }, { status: 400 });
  }

  const dayNumber = DAY_MAP[dia_semana.toLowerCase()];
  if (!dayNumber) return NextResponse.json({ error: `Día inválido: ${dia_semana}` }, { status: 400 });

  const durationMinutes = calcDurationMinutes(hora_inicio, hora_fin);

  // ── Check for professor overlap (excluding current schedule) ───────────────

  const { data: profOverlaps } = await supabaseAdmin
    .from("class_schedules")
    .select("id, start_time, end_time")
    .eq("professor_id", profesor_id)
    .eq("day_of_week", dayNumber)
    .eq("cycle_number", parseInt(ciclo))
    .neq("id", schedule_id);

  const conflictoProf = (profOverlaps ?? []).find(s => {
    return hora_inicio < s.end_time && s.start_time < hora_fin;
  });

  if (conflictoProf) {
    return NextResponse.json(
      { error: `El profesor ya tiene una clase ese día de ${conflictoProf.start_time?.slice(0,5)} a ${conflictoProf.end_time?.slice(0,5)}` },
      { status: 409 },
    );
  }

  // ── Check for location overlap (excluding current schedule) ────────────────

  if (aula && aula.trim()) {
    const { data: aulaOverlaps } = await supabaseAdmin
      .from("class_schedules")
      .select("id, start_time, end_time")
      .eq("location", aula.trim())
      .eq("day_of_week", dayNumber)
      .eq("cycle_number", parseInt(ciclo))
      .neq("id", schedule_id);

    const conflictoAula = (aulaOverlaps ?? []).find(s => {
      return hora_inicio < s.end_time && s.start_time < hora_fin;
    });

    if (conflictoAula) {
      return NextResponse.json(
        { error: `El aula "${aula}" ya está ocupada ese día de ${conflictoAula.start_time?.slice(0,5)} a ${conflictoAula.end_time?.slice(0,5)}` },
        { status: 409 },
      );
    }
  }

  // Obtener fechas del ciclo
  const { data: cycleOpening } = await supabaseAdmin
    .from("cycle_openings")
    .select("start_date, fecha_fin")
    .eq("cycle_number", parseInt(ciclo))
    .eq("status", "activo")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (!cycleOpening || !cycleOpening.start_date) {
    return NextResponse.json({ error: `No hay apertura activa para el Ciclo ${ciclo}.` }, { status: 400 });
  }

  const updatePayload = {
    professor_id:     profesor_id,
    course_id:        curso_id,
    cycle_number:     parseInt(ciclo),
    day_of_week:      dayNumber,
    start_time:       hora_inicio,
    end_time:         hora_fin,
    duration_minutes: durationMinutes,
    location:         aula || null,
    start_date:       cycleOpening.start_date,
    end_date:         cycleOpening.fecha_fin ?? cycleOpening.start_date,
  };

  const { error } = await supabaseAdmin
    .from("class_schedules")
    .update(updatePayload)
    .eq("id", schedule_id);

  if (error) {
    console.error("[schedules PUT] Error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

/**
 * DELETE /api/admin/schedules
 * Body: { schedule_id }
 */
export async function DELETE(req: NextRequest) {
  const admin = await verifyAdmin(req);
  if (!admin) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const { schedule_id } = await req.json();
  if (!schedule_id) return NextResponse.json({ error: "schedule_id requerido" }, { status: 400 });

  const { error } = await supabaseAdmin
    .from("class_schedules")
    .delete()
    .eq("id", schedule_id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
