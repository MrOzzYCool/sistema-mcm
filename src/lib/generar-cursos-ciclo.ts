import { supabaseAdmin } from "./supabase-admin";

/**
 * Genera los registros en alumno_cursos para un alumno en un ciclo específico.
 * Busca los cursos de la malla curricular que correspondan a esa carrera y ciclo.
 */
export async function generarCursosCiclo(
  alumnoId: string,
  carreraId: string,
  ciclo: number
): Promise<{ creados: number; error?: string }> {
  // Buscar cursos del ciclo en la malla
  const { data: malla, error: mallaErr } = await supabaseAdmin
    .from("malla_curricular")
    .select("curso_id, cursos(ciclo_perteneciente)")
    .eq("carrera_id", carreraId);

  if (mallaErr) return { creados: 0, error: mallaErr.message };

  // Filtrar solo los cursos de este ciclo
  const cursosDelCiclo = (malla ?? []).filter(
    (m) => (m.cursos as unknown as { ciclo_perteneciente: number })?.ciclo_perteneciente === ciclo
  );

  if (!cursosDelCiclo.length) {
    return { creados: 0, error: `No hay cursos en la malla para ciclo ${ciclo}` };
  }

  // Crear registros en alumno_cursos (ignorar duplicados)
  const rows = cursosDelCiclo.map((m) => ({
    alumno_id:  alumnoId,
    carrera_id: carreraId,
    ciclo,
    curso_id:   m.curso_id,
    estado:     "en_curso",
  }));

  const { error: insertErr } = await supabaseAdmin
    .from("alumno_cursos")
    .upsert(rows, { onConflict: "alumno_id,curso_id,ciclo" });

  if (insertErr) return { creados: 0, error: insertErr.message };

  return { creados: rows.length };
}

/**
 * Cierra los cursos de un ciclo anterior (marca como completados si no tienen estado final).
 */
export async function cerrarCursosCiclo(
  alumnoId: string,
  carreraId: string,
  ciclo: number
): Promise<void> {
  // Los cursos que siguen "en_curso" al cerrar el ciclo se marcan como desaprobados
  await supabaseAdmin
    .from("alumno_cursos")
    .update({ estado: "desaprobado", updated_at: new Date().toISOString() })
    .eq("alumno_id", alumnoId)
    .eq("carrera_id", carreraId)
    .eq("ciclo", ciclo)
    .eq("estado", "en_curso");
}
