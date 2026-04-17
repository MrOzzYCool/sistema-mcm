import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  const token = (req.headers.get("authorization") ?? "").replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { data: { user } } = await supabase.auth.getUser(token);
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  // Inscripción — buscar la más reciente del alumno (no filtrar solo por "activo")
  const { data: inscripciones } = await supabase
    .from("inscripciones")
    .select("*, carreras(nombre_carrera, duracion_ciclos)")
    .eq("alumno_id", user.id)
    .order("created_at", { ascending: false });

  // Priorizar inscripción activa, si no hay usar la más reciente
  const inscripcion = inscripciones?.find(i => i.estado === "activo")
    ?? inscripciones?.[0]
    ?? null;

  // Cursos — traer todos los del alumno si no hay inscripción, o filtrar por ciclo actual
  let cursos = [];
  if (inscripcion) {
    const { data } = await supabase
      .from("alumno_cursos")
      .select("*, cursos(nombre_curso, creditos)")
      .eq("alumno_id", user.id)
      .eq("ciclo", inscripcion.ciclo_actual)
      .order("created_at");
    cursos = data ?? [];
  } else {
    // Fallback: traer todos los cursos del alumno (por si la inscripción no existe pero los cursos sí)
    const { data } = await supabase
      .from("alumno_cursos")
      .select("*, cursos(nombre_curso, creditos)")
      .eq("alumno_id", user.id)
      .order("ciclo")
      .order("created_at");
    cursos = data ?? [];
  }

  // Historial de ciclos
  const { data: historial } = await supabase
    .from("historial_ciclos")
    .select("*")
    .eq("alumno_id", user.id)
    .order("ciclo");

  return NextResponse.json({
    inscripcion,
    cursos,
    historial: historial ?? [],
  });
}
