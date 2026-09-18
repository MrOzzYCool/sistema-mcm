import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { supabase } from "@/lib/supabase";

const ALLOWED_ROLES = ["super_admin", "secretaria_atencion_academica"];

async function verifyAccess(req: NextRequest) {
  const token = (req.headers.get("authorization") ?? "").replace("Bearer ", "");
  if (!token) return null;
  const { data: { user } } = await supabase.auth.getUser(token);
  if (!user) return null;

  // Fallback: email admin hardcodeado
  if (user.email?.toLowerCase() === "admin@margaritacabrera.edu.pe") return user;

  // Verificar rol en profiles
  const { data: profile } = await supabaseAdmin
    .from("profiles").select("rol").eq("id", user.id).single();
  if (!profile || !ALLOWED_ROLES.includes(profile.rol)) return null;
  return user;
}

type TipoExamen = "sustitutorio" | "recuperacion" | "extraordinario";

const MONTOS_EXAMEN: Record<TipoExamen, number> = {
  sustitutorio: 50.0,
  recuperacion: 80.0,
  extraordinario: 100.0,
};

const CONCEPTO_EXAMEN: Record<TipoExamen, string> = {
  sustitutorio: "EXAMEN SUSTITUTORIO",
  recuperacion: "EXAMEN DE RECUPERACIÓN",
  extraordinario: "EXAMEN EXTRAORDINARIO",
};

function esTipoExamenValido(t: unknown): t is TipoExamen {
  return t === "sustitutorio" || t === "recuperacion" || t === "extraordinario";
}

/** Fecha de vencimiento: hoy + 15 días, en formato YYYY-MM-DD. */
function calcularDueDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 15);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * GET /api/admin/examenes
 *
 * Variantes:
 * - Sin parámetros → lista alumnos de CARRERA regular activos
 *   (excluye tipo_programa="actualizacion"): { id, nombre, carrera_id, carrera, ciclo_actual }.
 * - ?carreras=1 → carreras regulares: { id, nombre }.
 * - ?cursos_carrera_id=<uuid> → cursos de la malla de esa carrera: { id, nombre_curso }.
 */
export async function GET(req: NextRequest) {
  const user = await verifyAccess(req);
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const cursosCarreraId = req.nextUrl.searchParams.get("cursos_carrera_id");
  const soloCarreras = req.nextUrl.searchParams.get("carreras");

  try {
    // ── Variante: carreras regulares { id, nombre } ───────────────────────────
    if (soloCarreras) {
      const { data: carreras, error: carrerasError } = await supabaseAdmin
        .from("carreras")
        .select("id, nombre_carrera, tipo_programa")
        .neq("tipo_programa", "actualizacion");
      if (carrerasError) throw carrerasError;

      const lista = (carreras ?? [])
        .map((c) => ({ id: c.id, nombre: c.nombre_carrera ?? "—" }))
        .sort((a, b) => a.nombre.localeCompare(b.nombre));

      return NextResponse.json({ carreras: lista });
    }

    // ── Variante: cursos de la malla de una carrera ───────────────────────────
    if (cursosCarreraId) {
      const { data: malla, error: mallaError } = await supabaseAdmin
        .from("malla_curricular")
        .select("curso_id, cursos(id, nombre_curso, ciclo_perteneciente)")
        .eq("carrera_id", cursosCarreraId);
      if (mallaError) throw mallaError;

      const cursos = (malla ?? [])
        .map((m) => m.cursos as unknown as { id: string; nombre_curso: string; ciclo_perteneciente: number | null } | null)
        .filter((c): c is { id: string; nombre_curso: string; ciclo_perteneciente: number | null } => !!c)
        .map((c) => ({ id: c.id, nombre_curso: c.nombre_curso ?? "—", ciclo_perteneciente: c.ciclo_perteneciente ?? null }))
        .sort((a, b) => a.nombre_curso.localeCompare(b.nombre_curso));

      return NextResponse.json({ cursos });
    }

    // ── Variante por defecto: alumnos de carrera regular activos ──────────────
    const { data: carreras, error: carrerasError } = await supabaseAdmin
      .from("carreras")
      .select("id, nombre_carrera, tipo_programa")
      .neq("tipo_programa", "actualizacion");
    if (carrerasError) throw carrerasError;

    const carreraNombreMap: Record<string, string> = {};
    for (const c of carreras ?? []) {
      carreraNombreMap[c.id] = c.nombre_carrera ?? "—";
    }
    const carreraIds = Object.keys(carreraNombreMap);
    if (carreraIds.length === 0) {
      return NextResponse.json({ alumnos: [] });
    }

    const { data: inscripciones, error: inscError } = await supabaseAdmin
      .from("inscripciones")
      .select("alumno_id, carrera_id, ciclo_actual, estado")
      .eq("estado", "activo")
      .in("carrera_id", carreraIds);
    if (inscError) throw inscError;

    const inscMap: Record<string, { carrera_id: string; ciclo_actual: number | null }> = {};
    for (const i of inscripciones ?? []) {
      if (!i.alumno_id) continue;
      if (!inscMap[i.alumno_id]) {
        inscMap[i.alumno_id] = { carrera_id: i.carrera_id, ciclo_actual: i.ciclo_actual };
      }
    }
    const alumnoIds = Object.keys(inscMap);
    if (alumnoIds.length === 0) {
      return NextResponse.json({ alumnos: [] });
    }

    const alumnoNombreMap: Record<string, string> = {};
    const { data: profiles } = await supabaseAdmin
      .from("profiles").select("id, nombre_completo").in("id", alumnoIds);
    for (const p of profiles ?? []) {
      alumnoNombreMap[p.id] = p.nombre_completo ?? "—";
    }

    const alumnos = alumnoIds.map((id) => ({
      id,
      nombre: alumnoNombreMap[id] ?? "—",
      carrera_id: inscMap[id].carrera_id,
      carrera: carreraNombreMap[inscMap[id].carrera_id] ?? "—",
      ciclo_actual: inscMap[id].ciclo_actual,
    }));
    alumnos.sort((a, b) => a.nombre.localeCompare(b.nombre));

    return NextResponse.json({ alumnos });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[EXAMENES][GET]", msg);
    return NextResponse.json({ error: "Error interno", detail: msg }, { status: 500 });
  }
}

/**
 * POST /api/admin/examenes
 * Body: { alumno_id, curso_id, curso_nombre, tipo_examen }
 *
 * Crea un Cargo_Examen en `installments` (tipo="examen", status="pending")
 * enlazado al payment_plan del ciclo actual del alumno.
 */
export async function POST(req: NextRequest) {
  const user = await verifyAccess(req);
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  try {
    const body = await req.json();
    const { alumno_id, curso_id, curso_nombre, tipo_examen } = body ?? {};

    // ── Validaciones de entrada ───────────────────────────────────────────────
    if (!esTipoExamenValido(tipo_examen)) {
      return NextResponse.json(
        { error: "tipo_examen inválido. Debe ser sustitutorio, recuperacion o extraordinario." },
        { status: 400 }
      );
    }
    if (!alumno_id || !curso_nombre) {
      return NextResponse.json(
        { error: "alumno_id y curso_nombre son requeridos." },
        { status: 400 }
      );
    }

    // ── 1. Inscripción activa del alumno ──────────────────────────────────────
    const { data: inscripcion, error: inscError } = await supabaseAdmin
      .from("inscripciones")
      .select("carrera_id, ciclo_actual, estado")
      .eq("alumno_id", alumno_id)
      .eq("estado", "activo")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (inscError) throw inscError;

    if (!inscripcion) {
      return NextResponse.json(
        { error: "El alumno no tiene una inscripción activa." },
        { status: 400 }
      );
    }

    // ── 2. La carrera no puede ser de actualización ───────────────────────────
    const { data: carrera, error: carreraError } = await supabaseAdmin
      .from("carreras")
      .select("tipo_programa, nombre_carrera")
      .eq("id", inscripcion.carrera_id)
      .maybeSingle();
    if (carreraError) throw carreraError;

    if (carrera?.tipo_programa === "actualizacion") {
      return NextResponse.json(
        { error: "No se pueden habilitar exámenes para alumnos de un programa de actualización." },
        { status: 400 }
      );
    }

    // ── 3. Payment plan del ciclo actual del alumno (el más reciente) ─────────
    const { data: planes, error: planesError } = await supabaseAdmin
      .from("payment_plans")
      .select("id, ciclo, year")
      .eq("alumno_id", alumno_id)
      .eq("ciclo", inscripcion.ciclo_actual)
      .order("year", { ascending: false });
    if (planesError) throw planesError;

    const plan = planes && planes.length > 0 ? planes[0] : null;
    if (!plan) {
      return NextResponse.json(
        { error: "El alumno no tiene un plan de pagos para su ciclo actual." },
        { status: 400 }
      );
    }

    // ── 4. Insertar el Cargo_Examen en installments ───────────────────────────
    const monto = MONTOS_EXAMEN[tipo_examen];
    const concepto = `${CONCEPTO_EXAMEN[tipo_examen]} - ${curso_nombre}`;
    const dueDate = calcularDueDate();

    const { data: installment, error: instError } = await supabaseAdmin
      .from("installments")
      .insert({
        plan_id: plan.id,
        tipo: "examen",
        numero: null,
        concepto,
        amount_original: monto,
        amount: monto,
        due_date: dueDate,
        status: "pending",
        fecha_pago: null,
      })
      .select("id")
      .single();
    if (instError) throw instError;

    // ── 5. Auditoría ──────────────────────────────────────────────────────────
    await supabaseAdmin.from("historial_auditoria").insert({
      accion: "habilitar_examen",
      admin_id: user.id,
      admin_email: user.email,
      target_id: alumno_id,
      detalle: {
        alumno_id,
        tipo_examen,
        curso_id: curso_id ?? null,
        curso_nombre,
        monto,
        concepto,
        installment_id: installment.id,
      },
    });

    return NextResponse.json({
      success: true,
      installment_id: installment.id,
      message: `Cargo creado: ${concepto} por S/ ${monto.toFixed(2)}`,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[EXAMENES][POST]", msg);
    return NextResponse.json({ error: "Error interno", detail: msg }, { status: 500 });
  }
}
