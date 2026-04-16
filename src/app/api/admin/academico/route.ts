import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { supabase } from "@/lib/supabase";

async function verifyAdmin(req: NextRequest) {
  const token = (req.headers.get("authorization") ?? "").replace("Bearer ", "");
  if (!token) return null;
  const { data: { user } } = await supabase.auth.getUser(token);
  if (!user?.email || user.email.toLowerCase() !== "admin@margaritacabrera.edu.pe") return null;
  return user;
}

// GET — listar carreras con sus cursos
export async function GET(req: NextRequest) {
  const admin = await verifyAdmin(req);
  if (!admin) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const tipo = new URL(req.url).searchParams.get("tipo");

  if (tipo === "cursos") {
    const { data, error } = await supabaseAdmin.from("cursos")
      .select("*, malla_curricular(carrera_id, carreras(nombre_carrera))")
      .order("ciclo_perteneciente");
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  }

  // Default: carreras con cursos via malla
  const { data, error } = await supabaseAdmin.from("carreras")
    .select("*, malla_curricular(curso_id, cursos(id, nombre_curso, ciclo_perteneciente, creditos))")
    .order("nombre_carrera");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// POST — crear carrera, curso o asignar malla
export async function POST(req: NextRequest) {
  const admin = await verifyAdmin(req);
  if (!admin) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const body = await req.json();
  const { accion } = body;

  try {
    if (accion === "crear_carrera") {
      const { nombre_carrera, codigo, duracion_ciclos } = body;
      const { data, error } = await supabaseAdmin.from("carreras")
        .insert({ nombre_carrera, codigo, duracion_ciclos: duracion_ciclos || 6 })
        .select().single();
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      return NextResponse.json(data, { status: 201 });
    }

    if (accion === "crear_curso") {
      const { nombre_curso, ciclo_perteneciente, creditos, carrera_ids } = body;
      const { data: curso, error } = await supabaseAdmin.from("cursos")
        .insert({ nombre_curso, ciclo_perteneciente: ciclo_perteneciente || 1, creditos: creditos || 3 })
        .select().single();
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });

      // Asignar a carreras si se proporcionaron
      if (carrera_ids?.length) {
        const rows = carrera_ids.map((cid: string) => ({ carrera_id: cid, curso_id: curso.id }));
        await supabaseAdmin.from("malla_curricular").insert(rows);
      }
      return NextResponse.json(curso, { status: 201 });
    }

    if (accion === "asignar_malla") {
      const { carrera_id, curso_id } = body;
      const { error } = await supabaseAdmin.from("malla_curricular")
        .insert({ carrera_id, curso_id });
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      return NextResponse.json({ success: true });
    }

    if (accion === "quitar_malla") {
      const { carrera_id, curso_id } = body;
      const { error } = await supabaseAdmin.from("malla_curricular")
        .delete().eq("carrera_id", carrera_id).eq("curso_id", curso_id);
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Acción no reconocida" }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error" }, { status: 500 });
  }
}

// PUT — editar carrera o curso
export async function PUT(req: NextRequest) {
  const admin = await verifyAdmin(req);
  if (!admin) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const body = await req.json();
  const { tipo, id, ...campos } = body;

  try {
    if (tipo === "carrera") {
      const { error } = await supabaseAdmin.from("carreras").update(campos).eq("id", id);
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    } else if (tipo === "curso") {
      const { error } = await supabaseAdmin.from("cursos").update(campos).eq("id", id);
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error" }, { status: 500 });
  }
}
