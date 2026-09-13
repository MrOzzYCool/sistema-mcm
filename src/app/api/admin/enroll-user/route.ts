import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { supabase } from "@/lib/supabase";

/**
 * POST /api/admin/enroll-user
 * Asigna carrera y ciclo a un alumno existente, vinculándolo a una sección
 * concreta (cycle_opening_id) mediante la RPC atómica `enroll_into_opening`,
 * que controla estado de la sección, duplicados y cupo.
 * Tras el vínculo: registra historial de ciclo y genera cursos desde la malla.
 */
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.replace("Bearer ", "");
  const { data: { user: admin } } = await supabase.auth.getUser(token);

  if (!admin?.email || admin.email.toLowerCase() !== "admin@margaritacabrera.edu.pe") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { alumno_id, carrera_id, ciclo, cycle_opening_id, fecha_inicio_ciclo } = await req.json();

  if (!alumno_id || !carrera_id || !ciclo) {
    return NextResponse.json({ error: "alumno_id, carrera_id y ciclo son requeridos" }, { status: 400 });
  }

  if (!cycle_opening_id) {
    return NextResponse.json({ error: "cycle_opening_id es requerido" }, { status: 400 });
  }

  try {
    // Verificar que el alumno existe y es alumno
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("id, nombre_completo, rol")
      .eq("id", alumno_id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
    }

    // Calcular fecha de inicio (regla del lunes)
    const { proximoLunes, esLunes } = await import("@/lib/fecha-utils");
    let fechaInicio: string;
    if (fecha_inicio_ciclo) {
      fechaInicio = esLunes(fecha_inicio_ciclo) ? fecha_inicio_ciclo : proximoLunes(new Date(fecha_inicio_ciclo));
    } else {
      fechaInicio = proximoLunes();
    }

    const ahora = new Date().toISOString();

    // Detectar si la inscripción ya existía (para el mensaje final).
    const { data: existente } = await supabaseAdmin
      .from("inscripciones")
      .select("id")
      .eq("alumno_id", alumno_id)
      .eq("carrera_id", carrera_id)
      .single();

    // Matrícula atómica por sección vía RPC: control de estado de la sección,
    // duplicados, cupo, insert/update de la inscripción con cycle_opening_id
    // y transición a 'llena' al alcanzar el tope.
    const { data: enrollData, error: enrollErr } = await supabaseAdmin.rpc("enroll_into_opening", {
      p_alumno_id: alumno_id,
      p_carrera_id: carrera_id,
      p_ciclo: ciclo,
      p_opening_id: cycle_opening_id,
      p_fecha_inicio: fechaInicio + "T00:00:00.000Z",
      p_fecha_matricula: ahora,
    });

    if (enrollErr) {
      const msg = enrollErr.message ?? "";
      if (msg.includes("SECCION_LLENA")) {
        return NextResponse.json({ error: "La sección alcanzó su tope" }, { status: 409 });
      }
      if (msg.includes("SECCION_NO_ADMITE_MATRICULAS")) {
        return NextResponse.json({ error: "La sección no admite matrículas" }, { status: 400 });
      }
      if (msg.includes("MATRICULA_DUPLICADA")) {
        return NextResponse.json({ error: "La alumna ya está matriculada en ese ciclo" }, { status: 409 });
      }
      if (msg.includes("APERTURA_NO_ENCONTRADA")) {
        return NextResponse.json({ error: "Apertura no encontrada" }, { status: 404 });
      }
      return NextResponse.json({ error: `Error en la matrícula: ${msg}` }, { status: 500 });
    }

    // Crear/actualizar historial de ciclo
    const { data: histExistente } = await supabaseAdmin
      .from("historial_ciclos")
      .select("id")
      .eq("alumno_id", alumno_id)
      .eq("carrera_id", carrera_id)
      .eq("ciclo", ciclo)
      .single();

    if (!histExistente) {
      await supabaseAdmin.from("historial_ciclos").insert({
        alumno_id,
        carrera_id,
        ciclo,
        fecha_inicio: fechaInicio + "T00:00:00.000Z",
        estado: "activo",
      });
    }

    // Generar cursos del ciclo desde la malla
    const { generarCursosCiclo } = await import("@/lib/generar-cursos-ciclo");
    const { creados, error: cursosErr } = await generarCursosCiclo(alumno_id, carrera_id, ciclo);

    // Auditoría
    await supabaseAdmin.from("historial_auditoria").insert({
      accion: "asignar_inscripcion",
      admin_id: admin.id,
      admin_email: admin.email,
      target_id: alumno_id,
      detalle: {
        nombre_completo: profile.nombre_completo,
        carrera_id,
        ciclo,
        cycle_opening_id,
        fecha_inicio: fechaInicio,
        cursos_generados: creados,
        actualizado: !!existente,
        enroll: enrollData,
      },
    });

    return NextResponse.json({
      success: true,
      message: cursosErr
        ? `Inscripción ${existente ? "actualizada" : "creada"} para ${profile.nombre_completo}, pero hubo un problema generando cursos: ${cursosErr}`
        : `Inscripción ${existente ? "actualizada" : "creada"} para ${profile.nombre_completo}. ${creados} cursos generados.`,
      cursos_generados: creados,
      cursos_error: cursosErr ?? null,
      enroll: enrollData,
    });

  } catch (err) {
    console.error("Error en enroll-user:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error interno" },
      { status: 500 },
    );
  }
}
