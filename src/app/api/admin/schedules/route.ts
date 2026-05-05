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
    .select("*, profiles!profesor_id(nombre_completo, rol), cursos!course_id(nombre_curso, ciclo_perteneciente)")
    .order("dia_semana")
    .order("hora_inicio");

  const profesorId = req.nextUrl.searchParams.get("profesor_id");
  const cursoId = req.nextUrl.searchParams.get("curso_id");
  const ciclo = req.nextUrl.searchParams.get("ciclo");

  if (profesorId) query = query.eq("profesor_id", profesorId);
  if (cursoId) query = query.eq("course_id", cursoId);
  if (ciclo) query = query.eq("ciclo", parseInt(ciclo));

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
    .eq("profesor_id", profesor_id)
    .eq("dia_semana", dia_semana.toLowerCase());

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

  console.log("[schedules POST] Insertando:", {
    profesor_id, curso_id, ciclo, dia_semana, hora_inicio, hora_fin, aula,
  });

  // Validación extra: curso_id no puede ser vacío
  if (!curso_id || curso_id === "undefined" || curso_id === "null") {
    return NextResponse.json({ error: "curso_id es obligatorio y debe ser un UUID válido" }, { status: 400 });
  }

  const { data: schedule, error: insertErr } = await supabaseAdmin
    .from("class_schedules")
    .insert({
      profesor_id,
      course_id: curso_id,
      ciclo: parseInt(ciclo),
      dia_semana: dia_semana.toLowerCase(),
      hora_inicio,
      hora_fin,
      aula: aula ?? null,
    })
    .select()
    .single();

  if (insertErr) {
    console.error("[schedules POST] Error insert:", insertErr.message);
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
