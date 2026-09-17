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

interface CuotaPendiente {
  concepto: string;
  amount: number;
  due_date: string | null;
  status: string;
}

interface AlumnoDeuda {
  alumno_id: string;
  nombre: string;
  carrera_id: string;
  carrera: string;
  ciclo_actual: number | null;
  cuotas: CuotaPendiente[];
  total_adeudado: number;
}

/**
 * GET /api/admin/cobranza?ciclo=3&carrera_id=<uuid>
 *
 * Retorna alumnos de CARRERA regular (excluyendo tipo_programa="actualizacion")
 * con cuotas pendientes (status ∉ {paid, exonerado}), agrupadas por alumno.
 *
 * Query params (opcionales):
 * - ciclo (número): filtra por inscripciones.ciclo_actual
 * - carrera_id (uuid): filtra por carrera
 */
export async function GET(req: NextRequest) {
  const user = await verifyAccess(req);
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const cicloParam = req.nextUrl.searchParams.get("ciclo");
  const carreraIdParam = req.nextUrl.searchParams.get("carrera_id");
  const cicloFiltro = cicloParam !== null && cicloParam !== "" ? Number(cicloParam) : null;

  try {
    // ── 1. Carreras regulares (excluir actualización) ─────────────────────────
    const { data: carreras, error: carrerasError } = await supabaseAdmin
      .from("carreras")
      .select("id, nombre_carrera, tipo_programa")
      .neq("tipo_programa", "actualizacion");
    if (carrerasError) throw carrerasError;

    const carreraNombreMap: Record<string, string> = {};
    for (const c of carreras ?? []) {
      carreraNombreMap[c.id] = c.nombre_carrera ?? "—";
    }
    let carreraIdsPermitidos = Object.keys(carreraNombreMap);

    // Aplicar filtro de carrera_id (si viene y está permitido)
    if (carreraIdParam) {
      carreraIdsPermitidos = carreraIdsPermitidos.filter((id) => id === carreraIdParam);
    }

    if (carreraIdsPermitidos.length === 0) {
      return NextResponse.json({ alumnos: [], resumen: { total_alumnos: 0, total_adeudado: 0 } });
    }

    // ── 2. Inscripciones activas de esas carreras ─────────────────────────────
    let inscQuery = supabaseAdmin
      .from("inscripciones")
      .select("alumno_id, carrera_id, ciclo_actual, estado")
      .eq("estado", "activo")
      .in("carrera_id", carreraIdsPermitidos);
    if (cicloFiltro !== null && !Number.isNaN(cicloFiltro)) {
      inscQuery = inscQuery.eq("ciclo_actual", cicloFiltro);
    }
    const { data: inscripciones, error: inscError } = await inscQuery;
    if (inscError) throw inscError;

    // Mapa alumno_id → inscripción (carrera + ciclo actual)
    const inscMap: Record<string, { carrera_id: string; ciclo_actual: number | null }> = {};
    for (const i of inscripciones ?? []) {
      if (!i.alumno_id) continue;
      // Si un alumno tuviera múltiples inscripciones activas, conservar la primera
      if (!inscMap[i.alumno_id]) {
        inscMap[i.alumno_id] = { carrera_id: i.carrera_id, ciclo_actual: i.ciclo_actual };
      }
    }
    const alumnoIds = Object.keys(inscMap);
    if (alumnoIds.length === 0) {
      return NextResponse.json({ alumnos: [], resumen: { total_alumnos: 0, total_adeudado: 0 } });
    }

    // ── 3. Payment plans de esos alumnos ──────────────────────────────────────
    const { data: planes, error: planesError } = await supabaseAdmin
      .from("payment_plans")
      .select("id, alumno_id, ciclo, year")
      .in("alumno_id", alumnoIds);
    if (planesError) throw planesError;

    const planAlumnoMap: Record<string, string> = {};
    for (const p of planes ?? []) {
      planAlumnoMap[p.id] = p.alumno_id;
    }
    const planIds = Object.keys(planAlumnoMap);
    if (planIds.length === 0) {
      return NextResponse.json({ alumnos: [], resumen: { total_alumnos: 0, total_adeudado: 0 } });
    }

    // ── 4. Cuotas pendientes (status ∉ paid/exonerado) ────────────────────────
    const { data: cuotas, error: cuotasError } = await supabaseAdmin
      .from("installments")
      .select("concepto, amount, due_date, status, plan_id")
      .in("plan_id", planIds)
      .not("status", "in", "(paid,exonerado)");
    if (cuotasError) throw cuotasError;

    if (!cuotas || cuotas.length === 0) {
      return NextResponse.json({ alumnos: [], resumen: { total_alumnos: 0, total_adeudado: 0 } });
    }

    // ── 5. Resolver nombres de alumnos por lote ───────────────────────────────
    const alumnoNombreMap: Record<string, string> = {};
    const { data: profiles } = await supabaseAdmin
      .from("profiles").select("id, nombre_completo").in("id", alumnoIds);
    for (const p of profiles ?? []) {
      alumnoNombreMap[p.id] = p.nombre_completo ?? "—";
    }

    // ── 6. Agrupar cuotas por alumno ──────────────────────────────────────────
    const deudaMap: Record<string, AlumnoDeuda> = {};
    for (const c of cuotas) {
      const alumnoId = planAlumnoMap[c.plan_id];
      if (!alumnoId) continue;
      const insc = inscMap[alumnoId];
      if (!insc) continue; // cuota de un alumno fuera del alcance (carrera/ciclo filtrados)

      if (!deudaMap[alumnoId]) {
        deudaMap[alumnoId] = {
          alumno_id: alumnoId,
          nombre: alumnoNombreMap[alumnoId] ?? "—",
          carrera_id: insc.carrera_id,
          carrera: carreraNombreMap[insc.carrera_id] ?? "—",
          ciclo_actual: insc.ciclo_actual,
          cuotas: [],
          total_adeudado: 0,
        };
      }

      const amount = Number(c.amount ?? 0);
      deudaMap[alumnoId].cuotas.push({
        concepto: c.concepto ?? "Cuota",
        amount,
        due_date: (c.due_date as string) ?? null,
        status: c.status ?? "pending",
      });
      deudaMap[alumnoId].total_adeudado += amount;
    }

    // ── 7. Construir respuesta (omitir alumnos sin cuotas pendientes) ─────────
    const alumnos = Object.values(deudaMap).filter((a) => a.cuotas.length > 0);
    alumnos.sort((a, b) => a.nombre.localeCompare(b.nombre));

    const resumen = {
      total_alumnos: alumnos.length,
      total_adeudado: alumnos.reduce((acc, a) => acc + a.total_adeudado, 0),
    };

    return NextResponse.json({ alumnos, resumen });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[COBRANZA]", msg);
    return NextResponse.json({ error: "Error interno", detail: msg }, { status: 500 });
  }
}
