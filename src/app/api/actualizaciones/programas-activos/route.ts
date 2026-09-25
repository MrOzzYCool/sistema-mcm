import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { programasActivos, inscripcionCerradaPorFecha } from "@/lib/grupos-actualizacion/logic";

/**
 * GET /api/actualizaciones/programas-activos
 * Endpoint público (sin auth): devuelve los programas que tienen un grupo activo
 * y cuya inscripción no esté cerrada por fecha.
 */
export async function GET() {
  const { data, error } = await supabaseAdmin
    .from("grupos_actualizacion")
    .select(
      "id, programa_id, programa_label, estado, fecha_inicio, fecha_inicio_inscripcion, fecha_cierre_inscripcion, fecha_inicio_actualizacion, fecha_fin_actualizacion"
    )
    .eq("estado", "activo");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const hoy = new Date();
  // Excluir grupos cuya inscripción ya esté cerrada por fecha: un programa cuyo
  // único grupo activo ya pasó su fecha de cierre no debe ofrecerse.
  const disponibles = (data ?? []).filter(
    (g) => !inscripcionCerradaPorFecha(g, hoy)
  );

  const programas = programasActivos(disponibles);

  return NextResponse.json({
    programas: programas.map((p) => ({
      programa_id: p.programa_id,
      programa_label: p.programa_label,
      grupo_id: p.grupo_id,
      fecha_inicio: p.fecha_inicio,
      fecha_inicio_inscripcion: p.fecha_inicio_inscripcion,
      fecha_cierre_inscripcion: p.fecha_cierre_inscripcion,
      fecha_inicio_actualizacion: p.fecha_inicio_actualizacion,
      fecha_fin_actualizacion: p.fecha_fin_actualizacion,
    })),
  });
}
