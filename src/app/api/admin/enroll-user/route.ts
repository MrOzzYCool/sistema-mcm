import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { supabase } from "@/lib/supabase";

/**
 * POST /api/admin/enroll-user
 * Asigna carrera y ciclo a un alumno existente.
 * Crea inscripción, historial de ciclo y genera cursos desde la malla.
 */
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.replace("Bearer ", "");
  const { data: { user: admin } } = await supabase.auth.getUser(token);

  if (!admin?.email || admin.email.toLowerCase() !== "admin@margaritacabrera.edu.pe") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { alumno_id, carrera_id, ciclo, fecha_inicio_ciclo } = await req.json();

  if (!alumno_id || !carrera_id || !ciclo) {
    return NextResponse.json({ error: "alumno_id, carrera_id y ciclo son requeridos" }, { status: 400 });
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

    // Verificar si ya tiene inscripción en esta carrera
    const { data: existente } = await supabaseAdmin
      .from("inscripciones")
      .select("id")
      .eq("alumno_id", alumno_id)
      .eq("carrera_id", carrera_id)
      .single();

    if (existente) {
      // Actualizar inscripción existente
      await supabaseAdmin.from("inscripciones").update({
        ciclo_actual: ciclo,
        fecha_inicio_ciclo: fechaInicio + "T00:00:00.000Z",
        estado: "activo",
        updated_at: ahora,
      }).eq("id", existente.id);
    } else {
      // Crear nueva inscripción
      const { error: inscErr } = await supabaseAdmin.from("inscripciones").insert({
        alumno_id,
        carrera_id,
        ciclo_actual: ciclo,
        fecha_inicio_ciclo: fechaInicio + "T00:00:00.000Z",
        fecha_matricula: ahora,
        estado: "activo",
      });
      if (inscErr) {
        return NextResponse.json({ error: `Error creando inscripción: ${inscErr.message}` }, { status: 500 });
      }
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
        fecha_inicio: fechaInicio,
        cursos_generados: creados,
        actualizado: !!existente,
      },
    });

    return NextResponse.json({
      success: true,
      message: cursosErr
        ? `Inscripción ${existente ? "actualizada" : "creada"} para ${profile.nombre_completo}, pero hubo un problema generando cursos: ${cursosErr}`
        : `Inscripción ${existente ? "actualizada" : "creada"} para ${profile.nombre_completo}. ${creados} cursos generados.`,
      cursos_generados: creados,
      cursos_error: cursosErr ?? null,
    });

  } catch (err) {
    console.error("Error en enroll-user:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error interno" },
      { status: 500 },
    );
  }
}
