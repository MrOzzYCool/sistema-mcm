import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET(req: NextRequest) {
  const token = (req.headers.get("authorization") ?? "").replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  // Verificar identidad del usuario con el token
  const { data: { user } } = await supabase.auth.getUser(token);
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  // Usar supabaseAdmin para leer datos (bypassa RLS — ya verificamos la identidad arriba)
  // Inscripción — buscar la más reciente del alumno (no filtrar solo por "activo")
  const { data: inscripciones, error: inscErr } = await supabaseAdmin
    .from("inscripciones")
    .select("*, carreras(nombre_carrera, duracion_ciclos)")
    .eq("alumno_id", user.id)
    .order("created_at", { ascending: false });

  if (inscErr) {
    console.error("Error leyendo inscripciones:", inscErr.message);
  }

  // Priorizar inscripción activa, si no hay usar la más reciente
  const inscripcion = inscripciones?.find(i => i.estado === "activo")
    ?? inscripciones?.[0]
    ?? null;

  // Cursos — traer del ciclo actual o todos si no hay inscripción
  let cursos = [];
  if (inscripcion) {
    // Primero intentar desde alumno_cursos (registros generados)
    const { data, error: cursosErr } = await supabaseAdmin
      .from("alumno_cursos")
      .select("*, cursos(nombre_curso, creditos)")
      .eq("alumno_id", user.id)
      .eq("ciclo", inscripcion.ciclo_actual)
      .order("created_at");
    if (cursosErr) console.error("Error leyendo cursos:", cursosErr.message);
    cursos = data ?? [];

    // Fallback: si no hay registros en alumno_cursos, buscar directamente en la malla
    if (cursos.length === 0 && inscripcion.carrera_id) {
      console.log(`[mis-cursos] No hay alumno_cursos para ciclo ${inscripcion.ciclo_actual}, buscando en malla...`);
      const { data: mallaCursos } = await supabaseAdmin
        .from("malla_curricular")
        .select("curso_id, cursos(id, nombre_curso, creditos, ciclo_perteneciente)")
        .eq("carrera_id", inscripcion.carrera_id);

      const cursosDelCiclo = (mallaCursos ?? [])
        .filter(m => (m.cursos as unknown as { ciclo_perteneciente: number })?.ciclo_perteneciente === inscripcion.ciclo_actual)
        .map(m => ({
          id: (m.cursos as unknown as { id: string }).id,
          curso_id: m.curso_id,
          ciclo: inscripcion.ciclo_actual,
          estado: "en_curso",
          cursos: m.cursos as unknown as { nombre_curso: string; creditos: number },
        }));

      cursos = cursosDelCiclo;
      console.log(`[mis-cursos] Encontrados ${cursosDelCiclo.length} cursos desde malla`);
    }
  } else {
    // Fallback: traer todos los cursos del alumno
    const { data, error: cursosErr } = await supabaseAdmin
      .from("alumno_cursos")
      .select("*, cursos(nombre_curso, creditos)")
      .eq("alumno_id", user.id)
      .order("ciclo")
      .order("created_at");
    if (cursosErr) console.error("Error leyendo cursos (fallback):", cursosErr.message);
    cursos = data ?? [];
  }

  // Historial de ciclos
  const { data: historial, error: histErr } = await supabaseAdmin
    .from("historial_ciclos")
    .select("*")
    .eq("alumno_id", user.id)
    .order("ciclo");

  if (histErr) console.error("Error leyendo historial:", histErr.message);

  return NextResponse.json({
    inscripcion,
    cursos,
    historial: historial ?? [],
  });
}
