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
    const { data, error: cursosErr } = await supabaseAdmin
      .from("alumno_cursos")
      .select("*, cursos(nombre_curso, creditos)")
      .eq("alumno_id", user.id)
      .eq("ciclo", inscripcion.ciclo_actual)
      .order("created_at");
    if (cursosErr) console.error("Error leyendo cursos:", cursosErr.message);
    cursos = data ?? [];
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
