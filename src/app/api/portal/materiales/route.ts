import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { uploadToStorage, deleteFromStorage, validateFile, buildStoragePath, getFileExtension } from "@/lib/storage-service";

/**
 * GET /api/portal/materiales?curso_id=xxx&semana=N
 */
export async function GET(req: NextRequest) {
  const token = (req.headers.get("authorization") ?? "").replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { data: { user } } = await supabaseAdmin.auth.getUser(token);
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const cursoId = req.nextUrl.searchParams.get("curso_id");
  if (!cursoId) return NextResponse.json({ error: "curso_id requerido" }, { status: 400 });

  const semana = req.nextUrl.searchParams.get("semana");

  let query = supabaseAdmin
    .from("material_curso")
    .select("*")
    .eq("curso_id", cursoId)
    .order("semana")
    .order("created_at", { ascending: false });

  if (semana) query = query.eq("semana", Number(semana));

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ materiales: data ?? [] });
}

/**
 * POST /api/portal/materiales
 * FormData: file, curso_id, semana (optional), seccion (optional)
 */
export async function POST(req: NextRequest) {
  const token = (req.headers.get("authorization") ?? "").replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { data: { user } } = await supabaseAdmin.auth.getUser(token);
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  // Verify role
  const { data: profile } = await supabaseAdmin
    .from("profiles").select("rol, es_profesor").eq("id", user.id).single();

  if (!profile || (profile.rol !== "profesor" && !profile.es_profesor && profile.rol !== "super_admin")) {
    return NextResponse.json({ error: "Solo docentes pueden subir materiales" }, { status: 403 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const cursoId = formData.get("curso_id") as string | null;
    const semana = formData.get("semana") as string | null;
    const seccion = formData.get("seccion") as string | null;

    if (!file || !cursoId) {
      return NextResponse.json({ error: "file y curso_id son requeridos" }, { status: 400 });
    }

    // Validate
    const validation = validateFile({ name: file.name, size: file.size, type: file.type });
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    // Get curso info for path structure
    const { data: curso } = await supabaseAdmin
      .from("cursos")
      .select("id, nombre_curso, ciclo_perteneciente")
      .eq("id", cursoId)
      .single();

    if (!curso) return NextResponse.json({ error: "Curso no encontrado" }, { status: 404 });

    // Get carrera name via malla_curricular
    let carreraNombre = "general";
    const { data: malla } = await supabaseAdmin
      .from("malla_curricular")
      .select("carreras:carrera_id(nombre_carrera)")
      .eq("curso_id", cursoId)
      .limit(1);

    if (malla && malla.length > 0) {
      const carreraObj = malla[0].carreras as unknown as { nombre_carrera?: string } | null;
      if (carreraObj?.nombre_carrera) carreraNombre = carreraObj.nombre_carrera;
    }

    // Build path with new structure: {carrera}/{ciclo}/{curso}/semana-{n}/{archivo}
    const path = buildStoragePath({
      carrera: carreraNombre,
      ciclo: curso.ciclo_perteneciente,
      cursoNombre: curso.nombre_curso,
      semana: semana ? Number(semana) : null,
      fileName: file.name,
    });

    // Upload
    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await uploadToStorage(buffer, path, file.type);

    // Save metadata
    const { data: material, error: dbError } = await supabaseAdmin
      .from("material_curso")
      .insert({
        curso_id: cursoId,
        semana: semana ? Number(semana) : null,
        seccion: seccion || "material",
        nombre_archivo: file.name,
        tipo_archivo: getFileExtension(file.name),
        tamano: file.size,
        url: result.url,
        usuario_subida: user.id,
      })
      .select()
      .single();

    if (dbError) {
      await deleteFromStorage(path);
      return NextResponse.json({ error: `Error guardando: ${dbError.message}` }, { status: 500 });
    }

    return NextResponse.json({ success: true, material }, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[MATERIALES] Upload error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/**
 * PATCH /api/portal/materiales
 * Body: { material_id, visible }
 * Toggle visibility of a material (only docentes/admin)
 */
export async function PATCH(req: NextRequest) {
  const token = (req.headers.get("authorization") ?? "").replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { data: { user } } = await supabaseAdmin.auth.getUser(token);
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  // Verify role
  const { data: profile } = await supabaseAdmin
    .from("profiles").select("rol, es_profesor").eq("id", user.id).single();

  if (!profile || (profile.rol !== "profesor" && !profile.es_profesor && profile.rol !== "super_admin")) {
    return NextResponse.json({ error: "Solo docentes pueden modificar visibilidad" }, { status: 403 });
  }

  const { material_id, visible } = await req.json();
  if (!material_id || typeof visible !== "boolean") {
    return NextResponse.json({ error: "material_id y visible (boolean) son requeridos" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("material_curso")
    .update({ visible })
    .eq("id", material_id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true, material: data });
}

/**
 * DELETE /api/portal/materiales
 * Body: { material_id }
 */
export async function DELETE(req: NextRequest) {
  const token = (req.headers.get("authorization") ?? "").replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { data: { user } } = await supabaseAdmin.auth.getUser(token);
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { material_id } = await req.json();
  if (!material_id) return NextResponse.json({ error: "material_id requerido" }, { status: 400 });

  const { data: material } = await supabaseAdmin
    .from("material_curso")
    .select("id, url, usuario_subida")
    .eq("id", material_id)
    .single();

  if (!material) return NextResponse.json({ error: "Material no encontrado" }, { status: 404 });

  // Permission check
  const { data: profile } = await supabaseAdmin
    .from("profiles").select("rol").eq("id", user.id).single();

  if (material.usuario_subida !== user.id && profile?.rol !== "super_admin") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  // Extract path from URL: remove base + bucket prefix
  const url = material.url as string;
  const bucketPrefix = `/aula-virtual/`;
  const idx = url.indexOf(bucketPrefix);
  const storagePath = idx >= 0 ? url.substring(idx + bucketPrefix.length) : "";

  if (storagePath) {
    await deleteFromStorage(storagePath);
  }

  await supabaseAdmin.from("material_curso").delete().eq("id", material_id);

  return NextResponse.json({ success: true });
}
