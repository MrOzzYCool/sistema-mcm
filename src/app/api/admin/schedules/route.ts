import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { supabase } from "@/lib/supabase";

const ADMIN_EMAIL = "admin@margaritacabrera.edu.pe";
const ALLOWED_ROLES = ["super_admin", "cycle_manager"];
const VALID_DAYS = ["lunes", "martes", "miercoles", "jueves", "viernes", "sabado"];

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

/**
 * GET /api/admin/schedules?profesor_id=xxx  OR  ?curso_id=xxx  OR  ?ciclo=x
 * Returns class schedules with profesor and curso details.
 */
export async function GET(req: NextRequest) {
  const admin = await verifyAdmin(req);
  if (!admin) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  let query = supabaseAdmin
    .from("class_schedules")
    .select("*, profiles!professor_id(nombre_completo, rol), cursos!course_id(nombre_curso, ciclo_perteneciente)")
    .order("dia_semana")
    .order("hora_inicio");

  const profesorId = req.nextUrl.searchParams.get("profesor_id");
  const cursoId = req.nextUrl.searchParams.get("curso_id");
  const ciclo = req.nextUrl.searchParams.get("ciclo");

  if (profesorId) query = query.eq("professor_id", profesorId);
  if (cursoId) query = query.eq("course_id", cursoId);
  if (ciclo) query = query.eq("cycle_number", parseInt(ciclo));

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ schedules: data ?? [] });
}

/**
 * POST /api/admin/schedules
 * Creates a new class schedule. Validates overlap for the same profesor.
 *
 * Body: { profesor_id, curso_id, ciclo, dia_semana, hora_inicio, hora_fin, aula? }
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

  if (!VALID_DAYS.includes(dia_semana.toLowerCase())) {
    return NextResponse.json(
      { error: `Día inválido. Valores permitidos: ${VALID_DAYS.join(", ")}` },
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

  // Verify profesor exists and is a profesor
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

  // ── Check for overlapping schedules (same profesor, same day) ─────────────

  const { data: overlaps } = await supabaseAdmin
    .from("class_schedules")
    .select("id, hora_inicio, hora_fin, cursos!course_id(nombre_curso)")
    .eq("professor_id", profesor_id)
    .eq("dia_semana", dia_semana.toLowerCase())
    .eq("cycle_number", parseInt(ciclo));

  const conflicto = (overlaps ?? []).find(s => {
    // Two time ranges overlap if: start1 < end2 AND start2 < end1
    return hora_inicio < s.hora_fin && s.hora_inicio < hora_fin;
  });

  if (conflicto) {
    const cursoConflicto = (conflicto.cursos as unknown as { nombre_curso: string })?.nombre_curso ?? "otro curso";
    return NextResponse.json(
      {
        error: `Conflicto de horario: ${profesor.nombre_completo} ya tiene clase de "${cursoConflicto}" el ${dia_semana} de ${conflicto.hora_inicio} a ${conflicto.hora_fin}`,
      },
      { status: 409 },
    );
  }

  // ── Insert ────────────────────────────────────────────────────────────────

  // Obtener fechas del ciclo seleccionado
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
      { error: `No se encontró una apertura activa para el Ciclo ${ciclo}. Debes aperturar el ciclo primero.` },
      { status: 400 },
    );
  }

  const startDate = cycleOpening.start_date;
  const endDate = cycleOpening.fecha_fin ?? cycleOpening.start_date; // fallback si no tiene fecha_fin

  // Objeto que se enviará a Supabase — verificar que ningún campo sea null
  const insertPayload = {
    professor_id: profesor_id,
    course_id: curso_id,
    cycle_number: parseInt(ciclo),
    dia_semana: dia_semana.toLowerCase(),
    hora_inicio,
    hora_fin,
    aula: aula || null,
    start_date: startDate,
    end_date: endDate,
  };

  console.log("[schedules POST] Payload completo para INSERT:", JSON.stringify(insertPayload, null, 2));

  // Validación final: ningún campo obligatorio puede ser nulo
  if (!insertPayload.professor_id) {
    return NextResponse.json({ error: "professor_id es obligatorio (UUID del profesor)" }, { status: 400 });
  }
  if (!insertPayload.course_id) {
    return NextResponse.json({ error: "course_id es obligatorio (UUID del curso)" }, { status: 400 });
  }
  if (!insertPayload.cycle_number || isNaN(insertPayload.cycle_number)) {
    return NextResponse.json({ error: "cycle_number es obligatorio (número de ciclo)" }, { status: 400 });
  }
  if (!insertPayload.dia_semana) {
    return NextResponse.json({ error: "dia_semana es obligatorio" }, { status: 400 });
  }
  if (!insertPayload.hora_inicio || !insertPayload.hora_fin) {
    return NextResponse.json({ error: "hora_inicio y hora_fin son obligatorios" }, { status: 400 });
  }

  const { data: schedule, error: insertErr } = await supabaseAdmin
    .from("class_schedules")
    .insert(insertPayload)
    .select()
    .single();

  if (insertErr) {
    console.error("[schedules POST] Error insert:", insertErr.message, "| Payload:", JSON.stringify(insertPayload));
    return NextResponse.json({ error: insertErr.message }, { status: 500 });
  }

  // Audit
  await supabaseAdmin.from("historial_auditoria").insert({
    accion: "crear_horario",
    admin_id: admin.id,
    admin_email: admin.email,
    target_id: profesor_id,
    detalle: {
      profesor: profesor.nombre_completo,
      curso: curso.nombre_curso,
      dia_semana,
      hora_inicio,
      hora_fin,
      aula,
      ciclo,
    },
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
