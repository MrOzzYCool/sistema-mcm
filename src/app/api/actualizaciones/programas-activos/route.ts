import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { programasActivos } from "@/lib/grupos-actualizacion/logic";

/**
 * GET /api/actualizaciones/programas-activos
 * Endpoint público (sin auth): devuelve los programas que tienen un grupo activo.
 */
export async function GET() {
  const { data, error } = await supabaseAdmin
    .from("grupos_actualizacion")
    .select("id, programa_id, programa_label, estado, fecha_inicio, fecha_cierre_inscripcion")
    .eq("estado", "activo");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const programas = programasActivos(data ?? []);

  return NextResponse.json({
    programas: programas.map((p) => ({
      programa_id: p.programa_id,
      programa_label: p.programa_label,
      grupo_id: p.grupo_id,
      fecha_inicio: p.fecha_inicio,
      fecha_cierre_inscripcion: p.fecha_cierre_inscripcion,
    })),
  });
}
