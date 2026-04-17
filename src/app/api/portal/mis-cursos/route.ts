import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  const token = (req.headers.get("authorization") ?? "").replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { data: { user } } = await supabase.auth.getUser(token);
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  // Inscripción actual
  const { data: inscripcion } = await supabase
    .from("inscripciones")
    .select("*, carreras(nombre_carrera, duracion_ciclos)")
    .eq("alumno_id", user.id)
    .eq("estado", "activo")
    .single();

  // Cursos del ciclo actual
  const { data: cursos } = await supabase
    .from("alumno_cursos")
    .select("*, cursos(nombre_curso, creditos)")
    .eq("alumno_id", user.id)
    .eq("ciclo", inscripcion?.ciclo_actual ?? 0)
    .order("created_at");

  // Historial de ciclos
  const { data: historial } = await supabase
    .from("historial_ciclos")
    .select("*")
    .eq("alumno_id", user.id)
    .order("ciclo");

  return NextResponse.json({
    inscripcion,
    cursos: cursos ?? [],
    historial: historial ?? [],
  });
}
