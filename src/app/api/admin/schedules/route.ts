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
    .select("*, profiles!professor_id(nombre_completo), cursos!course_id(nombre_curso, ciclo_perteneciente)")
    .order("day_of_week")
    .order("start_time");

  if (error) {
    console.error("[schedules GET] Error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Transformar para el frontend (agregar campos legibles)
  const schedules = (data ?? []).map(s => ({
    ...s,
    // Campos de compatibilidad para el frontend
    dia_semana: DAY_REVERSE[s.day_of_week] ?? "lunes",
    hora_inicio: s.start_time,
    hora_fin: s.end_time,
    aula: s.location,
    ciclo: s.cycle_number,
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
    .select("id, start_time, end_time, cursos!course_id(nombre_curso)")
    .eq("professor_id", profesor_id)
    .eq("day_of_week", dayNumber)
    .eq("cycle_number", parseInt(ciclo));

  const conflicto = (overlaps ?? []).find(s => {
    return hora_inicio < s.end_time && s.start_time < hora_fin;
  });

  if (conflicto) {
    const cursoConflicto = (conflicto.cursos as unknown as { nombre_curso: string })?.nombre_curso ?? "otro curso";
    return NextResponse.json(
      { error: `Conflicto: ${profesor.nombre_completo} ya tiene "${cursoConflicto}" ese día de ${conflicto.start_time} a ${conflicto.end_time}` },
      { status: 409 },
    );
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
