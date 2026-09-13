import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { supabase } from "@/lib/supabase";
import {
  decidirPromocion,
  nuevoCiclo,
  detectarDeudaPendiente,
  type CuotaLite,
} from "@/lib/gestion-ciclos-secciones/promocion-grupal";
import type { PromocionGrupalResult } from "@/lib/gestion-ciclos-secciones/types";
import { proximoLunes } from "@/lib/fecha-utils";
import { cerrarCursosCiclo, generarCursosCiclo } from "@/lib/generar-cursos-ciclo";
import { generateStudentPaymentPlan } from "@/lib/payment-service";

const ALLOWED_ROLES = ["super_admin", "cycle_manager"];

async function verifyAccess(req: NextRequest) {
  const token = (req.headers.get("authorization") ?? "").replace("Bearer ", "");
  if (!token) return null;
  const { data: { user } } = await supabase.auth.getUser(token);
  if (!user) return null;

  // Admin fijo
  if (user.email?.toLowerCase() === "admin@margaritacabrera.edu.pe") return user;

  // Rol del perfil
  const { data: profile } = await supabaseAdmin
    .from("profiles").select("rol").eq("id", user.id).single();
  if (!profile || !ALLOWED_ROLES.includes(profile.rol)) return null;
  return user;
}

/**
 * Autogenera el número de `seccion` para una nueva apertura de la misma carrera,
 * replicando la numeración por rango del `POST /api/admin/cycle-openings`.
 */
async function siguienteSeccion(carreraId: string): Promise<number> {
  let baseSeccion = 410; // default histórico

  const { data: carrera } = await supabaseAdmin
    .from("carreras")
    .select("codigo, tipo_programa, nombre_carrera")
    .eq("id", carreraId)
    .single();

  if (carrera?.codigo === "ACT-SEC") baseSeccion = 210;
  else if (carrera?.codigo === "ACT-IA") baseSeccion = 80;
  else if (carrera?.codigo === "AA" || carrera?.nombre_carrera?.toLowerCase().includes("asistencia")) baseSeccion = 410;
  else if (carrera?.codigo === "RRHH" || carrera?.nombre_carrera?.toLowerCase().includes("recursos humanos")) baseSeccion = 10;
  else if (carrera?.tipo_programa === "actualizacion") baseSeccion = 200;
  else baseSeccion = 1;

  const { data: maxInRange } = await supabaseAdmin
    .from("cycle_openings")
    .select("seccion")
    .eq("carrera_id", carreraId)
    .order("seccion", { ascending: false })
    .limit(1);

  return (maxInRange && maxInRange.length > 0 && maxInRange[0].seccion)
    ? maxInRange[0].seccion + 1
    : baseSeccion;
}

/**
 * Localiza (o crea) la apertura `activo` del nuevo ciclo para una carrera.
 * Reutiliza una apertura activa existente; si no hay, crea una nueva heredando
 * el `tope` del origen (o 20) y con la numeración por rango de carrera (Req 8.3).
 */
async function obtenerOCrearAperturaNuevoCiclo(
  carreraId: string,
  nuevoCycleNumber: number,
  startDate: string,
  topeHeredado: number,
  adminId: string,
): Promise<string> {
  const { data: existente } = await supabaseAdmin
    .from("cycle_openings")
    .select("id")
    .eq("carrera_id", carreraId)
    .eq("cycle_number", nuevoCycleNumber)
    .eq("status", "activo")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existente?.id) return existente.id;

  const seccion = await siguienteSeccion(carreraId);

  const { data: creada, error } = await supabaseAdmin
    .from("cycle_openings")
    .insert({
      cycle_number: nuevoCycleNumber,
      start_date: startDate,
      fecha_fin: null,
      status: "activo",
      seccion,
      tope: topeHeredado >= 1 ? topeHeredado : 20,
      carrera_id: carreraId,
      created_by: adminId,
    })
    .select("id")
    .single();

  if (error || !creada) {
    throw new Error(`No se pudo crear la apertura del nuevo ciclo: ${error?.message ?? "desconocido"}`);
  }
  return creada.id;
}

/**
 * POST /api/admin/cycle-openings/close  (alias: promover-seccion)
 * Body: { opening_id: string, confirmar: boolean }
 *
 * Cierra una sección y promueve en bloque a sus alumnas activas al siguiente
 * ciclo (política de deuda OPCIÓN B: promover con advertencia, conservar cuotas
 * impagas). Egresa a quienes alcanzaron el último ciclo. Idempotente y con
 * control de concurrencia (Req 6, 7, 8, 9, 10, 11).
 */
export async function POST(req: NextRequest) {
  const admin = await verifyAccess(req);
  if (!admin) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const { opening_id, confirmar } = await req.json();

  if (!opening_id) {
    return NextResponse.json({ error: "opening_id es requerido" }, { status: 400 });
  }
  if (confirmar !== true) {
    return NextResponse.json({ error: "Debe confirmar la operación (confirmar: true)" }, { status: 400 });
  }

  // Cargar la apertura de origen.
  const { data: opening, error: openingErr } = await supabaseAdmin
    .from("cycle_openings")
    .select("id, cycle_number, carrera_id, tope, start_date, status")
    .eq("id", opening_id)
    .single();

  if (openingErr || !opening) {
    return NextResponse.json({ error: "Apertura no encontrada" }, { status: 404 });
  }

  // Precondición de idempotencia: si ya está concluida, no reprocesar (Req 6.10).
  if (opening.status === "concluido") {
    return NextResponse.json(
      { error: "La sección ya está concluida; no se reprocesa (idempotencia).", status_final: "concluido" },
      { status: 409 },
    );
  }

  // Control de concurrencia (Req 6.12): como PRIMER paso, transición condicional
  // del estado fuera de 'activo'/'llena' hacia 'concluido'. Solo afecta filas que
  // sigan promovibles; si afecta 0 filas, otra ejecución ya la tomó.
  const { data: claimed, error: claimErr } = await supabaseAdmin
    .from("cycle_openings")
    .update({ status: "concluido" })
    .eq("id", opening_id)
    .in("status", ["activo", "llena"])
    .select("id");

  if (claimErr) {
    return NextResponse.json({ error: `Error al cerrar la sección: ${claimErr.message}` }, { status: 500 });
  }
  if (!claimed || claimed.length === 0) {
    // Otra ejecución concurrente ya tomó la apertura: no reprocesar.
    return NextResponse.json(
      { error: "La sección ya fue procesada por otra ejecución (idempotencia).", status_final: "concluido" },
      { status: 409 },
    );
  }

  // Identificar todas las inscripciones activas vinculadas a la sección (Req 6.1).
  const { data: inscripciones, error: inscErr } = await supabaseAdmin
    .from("inscripciones")
    .select("id, alumno_id, carrera_id, ciclo_actual, estado, carreras(duracion_ciclos)")
    .eq("cycle_opening_id", opening_id)
    .eq("estado", "activo");

  if (inscErr) {
    return NextResponse.json({ error: `Error al leer inscripciones: ${inscErr.message}` }, { status: 500 });
  }

  const activas = inscripciones ?? [];

  const result: PromocionGrupalResult = {
    opening_id,
    total_activas: activas.length,
    promovidas: [],
    egresadas: [],
    omitidas: [],
    errores: [],
    advertencias_deuda: [],
    status_final: "concluido",
  };

  const ahoraISO = new Date().toISOString();

  // Caso sin alumnas activas: concluir igual y reportar (Req 6.9).
  if (activas.length === 0) {
    await supabaseAdmin.from("historial_auditoria").insert({
      accion: "promover_seccion",
      admin_id: admin.id, admin_email: admin.email, target_id: opening_id,
      detalle: {
        opening_id,
        carrera_id: opening.carrera_id,
        cycle_number: opening.cycle_number,
        total_activas: 0,
        mensaje: "sin alumnas por promover",
        status_final: "concluido",
      },
    });

    return NextResponse.json({
      success: true,
      mensaje: "Sección concluida sin alumnas por promover.",
      result,
    });
  }

  // Fecha de inicio del nuevo ciclo (regla del lunes) — común a todas las promovidas.
  const nuevaFechaInicio = proximoLunes();
  const nuevaFechaInicioTs = nuevaFechaInicio + "T00:00:00.000Z";
  const nuevoYear = new Date(nuevaFechaInicio + "T00:00:00").getFullYear();

  // Procesar cada alumna en su propio try/catch (Req 6.7).
  for (const insc of activas) {
    const alumnoId = insc.alumno_id as string;
    const carreraId = insc.carrera_id as string;
    const cicloActual = insc.ciclo_actual as number;
    const duracion = (insc.carreras as unknown as { duracion_ciclos: number } | null)?.duracion_ciclos ?? 6;

    try {
      // ¿Ya fue promovida? (idempotencia por alumna, Req 6.11)
      // Si la inscripción ya avanzó más allá del ciclo de esta sección, otra
      // ejecución la promovió: se omite sin reprocesar.
      if (cicloActual > opening.cycle_number) {
        result.omitidas.push(alumnoId);
        continue;
      }

      const decision = decidirPromocion(cicloActual, duracion);
      const cicloDestino = nuevoCiclo(cicloActual, duracion);

      // Detectar deuda pendiente (para advertencias, Req 10.1/10.2).
      const { data: cuotas } = await supabaseAdmin
        .from("installments")
        .select("status, due_date, payment_plans!inner(alumno_id)")
        .eq("payment_plans.alumno_id", alumnoId);

      const cuotasLite: CuotaLite[] = (cuotas ?? []).map((c) => ({
        status: c.status as string,
        due_date: c.due_date as string,
      }));
      const conDeuda = detectarDeudaPendiente(cuotasLite);

      if (decision === "egreso") {
        // Egreso: sin plan ni cursos (Req 6.4, 9.1, 9.2).
        // Cerrar historial del ciclo actual (Req 6.6).
        await supabaseAdmin.from("historial_ciclos")
          .update({ fecha_fin: ahoraISO, estado: "completado" })
          .eq("alumno_id", alumnoId).eq("carrera_id", carreraId)
          .eq("ciclo", cicloActual).is("fecha_fin", null);

        await supabaseAdmin.from("inscripciones")
          .update({ estado: "egresado", updated_at: ahoraISO })
          .eq("id", insc.id as string);

        // Auditar el egreso (Req 9.3).
        await supabaseAdmin.from("historial_auditoria").insert({
          accion: "egreso_alumno",
          admin_id: admin.id, admin_email: admin.email, target_id: alumnoId,
          detalle: {
            opening_id,
            carrera_id: carreraId,
            ciclo_final: cicloActual,
            duracion_ciclos: duracion,
            via: "promover_seccion",
          },
        });

        result.egresadas.push(alumnoId);
        if (conDeuda) result.advertencias_deuda.push(alumnoId);
        continue;
      }

      // Promoción al siguiente ciclo -----------------------------------------

      // ¿El plan del nuevo ciclo ya existe? (idempotencia, Req 6.11 / 7.6)
      const { data: planExistente } = await supabaseAdmin
        .from("payment_plans")
        .select("id")
        .eq("alumno_id", alumnoId)
        .eq("ciclo", cicloDestino)
        .eq("year", nuevoYear)
        .limit(1)
        .maybeSingle();

      if (planExistente?.id) {
        result.omitidas.push(alumnoId);
        continue;
      }

      // Cerrar historial del ciclo anterior (Req 6.6).
      await supabaseAdmin.from("historial_ciclos")
        .update({ fecha_fin: ahoraISO, estado: "completado" })
        .eq("alumno_id", alumnoId).eq("carrera_id", carreraId)
        .eq("ciclo", cicloActual).is("fecha_fin", null);

      // Cerrar los cursos del ciclo anterior.
      await cerrarCursosCiclo(alumnoId, carreraId, cicloActual);

      // Localizar o crear la apertura del nuevo ciclo (Req 8.3).
      const nuevoCycleNumber = opening.cycle_number + 1;
      const nuevaAperturaId = await obtenerOCrearAperturaNuevoCiclo(
        carreraId,
        nuevoCycleNumber,
        nuevaFechaInicio,
        opening.tope as number,
        admin.id,
      );

      // Vincular la inscripción a la nueva sección respetando el tope vía RPC
      // atómica (Req 8.2, 8.4). La RPC actualiza la inscripción existente
      // (mismo alumno+carrera) al nuevo ciclo con cycle_opening_id.
      const { error: enrollErr } = await supabaseAdmin.rpc("enroll_into_opening", {
        p_alumno_id: alumnoId,
        p_carrera_id: carreraId,
        p_ciclo: cicloDestino,
        p_opening_id: nuevaAperturaId,
        p_fecha_inicio: nuevaFechaInicioTs,
        p_fecha_matricula: ahoraISO,
      });

      if (enrollErr) {
        const msg = enrollErr.message ?? "";
        if (msg.includes("SECCION_LLENA")) throw new Error("La sección del nuevo ciclo alcanzó su tope");
        if (msg.includes("SECCION_NO_ADMITE_MATRICULAS")) throw new Error("La sección del nuevo ciclo no admite matrículas");
        if (msg.includes("MATRICULA_DUPLICADA")) throw new Error("La alumna ya está matriculada en el nuevo ciclo");
        if (msg.includes("APERTURA_NO_ENCONTRADA")) throw new Error("Apertura del nuevo ciclo no encontrada");
        throw new Error(`Error al vincular al nuevo ciclo: ${msg}`);
      }

      // Registrar el nuevo ciclo en historial_ciclos.
      const { data: histExistente } = await supabaseAdmin
        .from("historial_ciclos")
        .select("id")
        .eq("alumno_id", alumnoId)
        .eq("carrera_id", carreraId)
        .eq("ciclo", cicloDestino)
        .limit(1)
        .maybeSingle();

      if (!histExistente) {
        await supabaseAdmin.from("historial_ciclos").insert({
          alumno_id: alumnoId,
          carrera_id: carreraId,
          ciclo: cicloDestino,
          fecha_inicio: nuevaFechaInicioTs,
          estado: "activo",
        });
      }

      // Generar el plan de pagos del nuevo ciclo conservando montos/beneficios
      // (Req 7.1–7.6). NO se tocan las cuotas impagas del ciclo anterior (Req 10.4).
      await generateStudentPaymentPlan({
        alumnoId,
        ciclo: cicloDestino,
        year: nuevoYear,
        carreraId,
      });

      // Generar los cursos del nuevo ciclo (Req 8.1).
      await generarCursosCiclo(alumnoId, carreraId, cicloDestino);

      result.promovidas.push({ alumno_id: alumnoId, ciclo_nuevo: cicloDestino, con_deuda: conDeuda });

      if (conDeuda) {
        result.advertencias_deuda.push(alumnoId);
        // Auditar la promoción con advertencia de deuda (Req 10.3).
        await supabaseAdmin.from("historial_auditoria").insert({
          accion: "promover_seccion",
          admin_id: admin.id, admin_email: admin.email, target_id: alumnoId,
          detalle: {
            opening_id,
            carrera_id: carreraId,
            ciclo_anterior: cicloActual,
            ciclo_nuevo: cicloDestino,
            advertencia: "Deuda_Pendiente",
            nota: "Promovida con deuda; cuotas impagas conservadas.",
          },
        });
      }
    } catch (err) {
      // Acumular el error identificando a la alumna y continuar (Req 6.7).
      result.errores.push({
        alumno_id: alumnoId,
        error: err instanceof Error ? err.message : "Error desconocido",
      });
    }
  }

  // La apertura ya quedó 'concluido' en el paso de concurrencia (Req 6.5).
  // Auditar la operación grupal (Req 6.8).
  await supabaseAdmin.from("historial_auditoria").insert({
    accion: "promover_seccion",
    admin_id: admin.id, admin_email: admin.email, target_id: opening_id,
    detalle: {
      opening_id,
      carrera_id: opening.carrera_id,
      cycle_number: opening.cycle_number,
      total_activas: result.total_activas,
      promovidas: result.promovidas.length,
      egresadas: result.egresadas.length,
      omitidas: result.omitidas.length,
      errores: result.errores.length,
      advertencias_deuda: result.advertencias_deuda,
      status_final: "concluido",
    },
  });

  return NextResponse.json({ success: true, result });
}
