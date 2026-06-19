import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { generatePresignedUrl, extractPathFromUrl } from "@/lib/storage-service";

/**
 * GET /api/portal/materiales/presigned?material_id=xxx
 *
 * Genera una URL firmada temporal para acceder a un material privado en MinIO.
 * - Alumnos: 1 hora de expiración
 * - Docentes/Admin: 24 horas de expiración
 */
export async function GET(req: NextRequest) {
  const token = (req.headers.get("authorization") ?? "").replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { data: { user } } = await supabaseAdmin.auth.getUser(token);
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const materialId = req.nextUrl.searchParams.get("material_id");
  if (!materialId) return NextResponse.json({ error: "material_id requerido" }, { status: 400 });

  // Get material from DB
  const { data: material } = await supabaseAdmin
    .from("material_curso")
    .select("id, url, nombre_archivo")
    .eq("id", materialId)
    .single();

  if (!material) return NextResponse.json({ error: "Material no encontrado" }, { status: 404 });

  // Determine role for expiration
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("rol, es_profesor")
    .eq("id", user.id)
    .single();

  const isDocente = profile?.rol === "profesor" || profile?.es_profesor || profile?.rol === "super_admin";
  const expiresIn = isDocente ? 86400 : 3600; // 24h docentes, 1h alumnos

  try {
    // Extract the storage path from the stored URL
    const path = extractPathFromUrl(material.url);

    if (!path) {
      return NextResponse.json({ error: "Path de archivo no válido" }, { status: 400 });
    }

    // Generate presigned URL
    const signedUrl = await generatePresignedUrl(path, expiresIn);

    return NextResponse.json({
      url: signedUrl,
      nombre: material.nombre_archivo,
      expires_in: expiresIn,
    });
  } catch (err) {
    console.error("[PRESIGNED] Error:", err);
    return NextResponse.json({ error: "Error generando URL de acceso" }, { status: 500 });
  }
}
