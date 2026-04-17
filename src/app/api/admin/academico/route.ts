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

// GET — listar carreras o cursos
export async function GET(req: NextRequest) {
  const admin = await verifyAdmin(req);
  if (!admin) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const tipo = new URL(req.url).searchParams.get("tipo");

  if (tipo === "cursos") {
    const { data, error } = await supabaseAdmin.from("cursos")
      .select("*, malla_curricular(carrera_id, carreras(nombre_carrera, codigo))")
      .order("ciclo_perteneciente");
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  }

  const { data, error } = await supabaseAdmin.from("carreras")
    .select("*, malla_curricular(curso_id, cursos(id, nombre_curso, ciclo_perteneciente, creditos))")
    .order("nombre_carrera");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// POST — crear carrera, curso, asignar/quitar malla, import CSV
export async function POST(req: NextRequest) {
  const admin = await verifyAdmin(req);
  if (!admin) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const body = await req.json();
  const { accion } = body;

  try {
    if (accion === "crear_carrera") {
      const { nombre_carrera, codigo, duracion_ciclos } = body;
      if (!nombre_carrera || !codigo) return NextResponse.json({ error: "Nombre y código son obligatorios" }, { status: 400 });
      const { data, error } = await supabaseAdmin.from("carreras")
        .insert({ nombre_carrera, codigo, duracion_ciclos: duracion_ciclos || 6 })
        .select().single();
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      await supabaseAdmin.from("historial_auditoria").insert({
        accion: "crear_carrera", admin_id: admin.id, admin_email: admin.email,
        detalle: { nombre_carrera, codigo },
      });
      return NextResponse.json(data, { status: 201 });
    }

    if (accion === "crear_curso") {
      const { nombre_curso, ciclo_perteneciente, creditos, carrera_ids } = body;
      if (!nombre_curso) return NextResponse.json({ error: "Nombre del curso es obligatorio" }, { status: 400 });
      if (!carrera_ids?.length) return NextResponse.json({ error: "Debes seleccionar al menos 1 carrera" }, { status: 400 });

      const { data: curso, error } = await supabaseAdmin.from("cursos")
        .insert({ nombre_curso, ciclo_perteneciente: ciclo_perteneciente || 1, creditos: creditos || 3 })
        .select().single();
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });

      const rows = carrera_ids.map((cid: string) => ({ carrera_id: cid, curso_id: curso.id }));
      const { error: mallaErr } = await supabaseAdmin.from("malla_curricular").insert(rows);
      if (mallaErr) console.error("Error malla:", mallaErr.message);

      await supabaseAdmin.from("historial_auditoria").insert({
        accion: "crear_curso", admin_id: admin.id, admin_email: admin.email,
        detalle: { nombre_curso, carrera_ids },
      });
      return NextResponse.json(curso, { status: 201 });
    }

    if (accion === "asignar_malla") {
      const { carrera_id, curso_id } = body;
      const { error } = await supabaseAdmin.from("malla_curricular").insert({ carrera_id, curso_id });
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

    if (accion === "import_cursos") {
      const { rows } = body as { rows: { nombre_curso: string; ciclo: number; creditos: number; career_codes: string[] }[] };
      if (!rows?.length) return NextResponse.json({ error: "Sin datos" }, { status: 400 });

      // Cargar carreras existentes para mapear códigos
      const { data: allCarreras } = await supabaseAdmin.from("carreras").select("id, codigo");
      const codeMap = new Map((allCarreras ?? []).map(c => [c.codigo.toUpperCase(), c.id]));

      const results: { nombre: string; status: "ok" | "error"; message?: string }[] = [];

      for (const row of rows) {
        try {
          if (!row.nombre_curso?.trim()) { results.push({ nombre: "—", status: "error", message: "Nombre vacío" }); continue; }

          const carreraIds = row.career_codes
            .map(code => codeMap.get(code.toUpperCase()))
            .filter(Boolean) as string[];

          if (!carreraIds.length) {
            results.push({ nombre: row.nombre_curso, status: "error", message: `Carreras no encontradas: ${row.career_codes.join(";")}` });
            continue;
          }

          const { data: curso, error } = await supabaseAdmin.from("cursos")
            .insert({ nombre_curso: row.nombre_curso.trim(), ciclo_perteneciente: row.ciclo || 1, creditos: row.creditos || 3 })
            .select().single();

          if (error) { results.push({ nombre: row.nombre_curso, status: "error", message: error.message }); continue; }

          const mallaRows = carreraIds.map(cid => ({ carrera_id: cid, curso_id: curso.id }));
          await supabaseAdmin.from("malla_curricular").insert(mallaRows);

          results.push({ nombre: row.nombre_curso, status: "ok" });
        } catch (e) {
          results.push({ nombre: row.nombre_curso ?? "—", status: "error", message: e instanceof Error ? e.message : "Error" });
        }
      }

      await supabaseAdmin.from("historial_auditoria").insert({
        accion: "import_cursos", admin_id: admin.id, admin_email: admin.email,
        detalle: { total: rows.length, ok: results.filter(r => r.status === "ok").length, errores: results.filter(r => r.status === "error").length },
      });

      return NextResponse.json({ results });
    }

    return NextResponse.json({ error: "Acción no reconocida" }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error" }, { status: 500 });
  }
}

// PUT — editar carrera o curso + actualizar malla
export async function PUT(req: NextRequest) {
  const admin = await verifyAdmin(req);
  if (!admin) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const body = await req.json();
  const { tipo, id, carrera_ids, ...campos } = body;

  try {
    if (tipo === "carrera") {
      const { error } = await supabaseAdmin.from("carreras").update(campos).eq("id", id);
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    } else if (tipo === "curso") {
      // Actualizar datos del curso
      const updateFields: Record<string, unknown> = {};
      if (campos.nombre_curso) updateFields.nombre_curso = campos.nombre_curso;
      if (campos.ciclo_perteneciente) updateFields.ciclo_perteneciente = campos.ciclo_perteneciente;
      if (campos.creditos) updateFields.creditos = campos.creditos;

      if (Object.keys(updateFields).length) {
        const { error } = await supabaseAdmin.from("cursos").update(updateFields).eq("id", id);
        if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      }

      // Actualizar relaciones de malla si se proporcionaron
      if (Array.isArray(carrera_ids)) {
        // Borrar relaciones actuales
        await supabaseAdmin.from("malla_curricular").delete().eq("curso_id", id);
        // Insertar nuevas
        if (carrera_ids.length) {
          const rows = carrera_ids.map((cid: string) => ({ carrera_id: cid, curso_id: id }));
          await supabaseAdmin.from("malla_curricular").insert(rows);
        }
      }

      await supabaseAdmin.from("historial_auditoria").insert({
        accion: "editar_curso", admin_id: admin.id, admin_email: admin.email,
        detalle: { curso_id: id, ...updateFields, carrera_ids },
      });
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error" }, { status: 500 });
  }
}
