import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { supabase } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  // Verificar admin
  const token = (req.headers.get("authorization") ?? "").replace("Bearer ", "");
  const { data: { user: admin } } = await supabase.auth.getUser(token);
  if (!admin?.email || admin.email.toLowerCase() !== "admin@margaritacabrera.edu.pe") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { alumno_id, carrera_id } = await req.json();
  if (!alumno_id || !carrera_id) {
    return NextResponse.json({ error: "alumno_id y carrera_id son obligatorios" }, { status: 400 });
  }

  try {
    // Obtener inscripción actual
    const { data: insc, error: inscErr } = await supabaseAdmin.from("inscripciones")
      .select("*, carreras(duracion_ciclos)")
      .eq("alumno_id", alumno_id).eq("carrera_id", carrera_id).single();

    if (inscErr || !insc) {
      return NextResponse.json({ error: "Inscripción no encontrada" }, { status: 404 });
    }

    // Verificar que han pasado 4 meses
    const inicio = new Date(insc.fecha_inicio_ciclo);
    const ahora  = new Date();
    const mesesTranscurridos = (ahora.getFullYear() - inicio.getFullYear()) * 12 + (ahora.getMonth() - inicio.getMonth());

    if (mesesTranscurridos < 4) {
      const faltan = 4 - mesesTranscurridos;
      return NextResponse.json({
        error: `No se puede promover aún. Faltan ${faltan} mes(es) para completar el ciclo (inicio: ${inicio.toLocaleDateString("es-PE")}).`,
      }, { status: 400 });
    }

    // TODO: Verificar notas >= 13 en todos los cursos del ciclo
    // const { data: cursosCiclo } = await supabaseAdmin.from("malla_curricular")
    //   .select("curso_id").eq("carrera_id", carrera_id);
    // const cursosDelCiclo = cursosCiclo?.filter(c => c.ciclo_perteneciente === insc.ciclo_actual);
    // Verificar notas cuando la tabla de notas exista

    const duracion = (insc.carreras as { duracion_ciclos: number })?.duracion_ciclos ?? 6;
    const esUltimoCiclo = insc.ciclo_actual >= duracion;
    const nuevoEstado   = esUltimoCiclo ? "egresado" : "activo";
    const nuevoCiclo    = esUltimoCiclo ? insc.ciclo_actual : insc.ciclo_actual + 1;

    // Cerrar ciclo actual en historial
    await supabaseAdmin.from("historial_ciclos")
      .update({ fecha_fin: ahora.toISOString(), estado: "completado" })
      .eq("alumno_id", alumno_id).eq("carrera_id", carrera_id)
      .eq("ciclo", insc.ciclo_actual).is("fecha_fin", null);

    // Cerrar cursos del ciclo anterior y generar nuevos
    const { cerrarCursosCiclo, generarCursosCiclo } = await import("@/lib/generar-cursos-ciclo");
    const { proximoLunes } = await import("@/lib/fecha-utils");
    await cerrarCursosCiclo(alumno_id, carrera_id, insc.ciclo_actual);

    const nuevaFechaInicio = proximoLunes() + "T00:00:00.000Z";

    // Actualizar inscripción
    await supabaseAdmin.from("inscripciones").update({
      ciclo_actual: nuevoCiclo,
      fecha_inicio_ciclo: nuevaFechaInicio,
      estado: nuevoEstado,
      updated_at: ahora.toISOString(),
    }).eq("id", insc.id);

    // Crear nuevo registro en historial y generar cursos (si no es egresado)
    if (!esUltimoCiclo) {
      await supabaseAdmin.from("historial_ciclos").insert({
        alumno_id, carrera_id, ciclo: nuevoCiclo,
        fecha_inicio: nuevaFechaInicio, estado: "activo",
      });
      await generarCursosCiclo(alumno_id, carrera_id, nuevoCiclo);
    }

    // Auditoría
    await supabaseAdmin.from("historial_auditoria").insert({
      accion: esUltimoCiclo ? "egreso_alumno" : "promocion_ciclo",
      admin_id: admin.id, admin_email: admin.email, target_id: alumno_id,
      detalle: { carrera_id, ciclo_anterior: insc.ciclo_actual, ciclo_nuevo: nuevoCiclo, estado: nuevoEstado },
    });

    return NextResponse.json({
      success: true,
      ciclo_anterior: insc.ciclo_actual,
      ciclo_nuevo: nuevoCiclo,
      estado: nuevoEstado,
      mensaje: esUltimoCiclo
        ? "¡Alumno egresado exitosamente!"
        : `Promovido al ciclo ${nuevoCiclo}`,
    });

  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error" }, { status: 500 });
  }
}
