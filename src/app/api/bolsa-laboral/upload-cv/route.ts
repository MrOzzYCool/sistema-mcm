import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { verifyAlumnaBolsa } from "@/lib/bolsa-laboral/verify-alumna-bolsa";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

export async function POST(req: NextRequest) {
  try {
    const user = await verifyAlumnaBolsa(req);
    if (!user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const ofertaId = formData.get("oferta_id") as string | null;

    if (!file) {
      return NextResponse.json(
        { error: "Se requiere un archivo" },
        { status: 400 }
      );
    }

    if (!ofertaId) {
      return NextResponse.json(
        { error: "oferta_id es requerido" },
        { status: 400 }
      );
    }

    // Validate file type (PDF only)
    if (file.type !== "application/pdf") {
      return NextResponse.json(
        { error: "Solo se permiten archivos PDF" },
        { status: 400 }
      );
    }

    // Validate file size (max 5MB)
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "El archivo no debe exceder 5MB" },
        { status: 400 }
      );
    }

    // Read file into buffer for upload
    const buffer = Buffer.from(await file.arrayBuffer());
    const filePath = `${user.id}/${ofertaId}.pdf`;

    // Upload to Supabase Storage bucket 'cvs'
    const { data, error } = await supabaseAdmin.storage
      .from("cvs")
      .upload(filePath, buffer, {
        contentType: "application/pdf",
        upsert: true,
      });

    if (error) {
      console.error("Error uploading CV:", error.message);
      return NextResponse.json(
        { error: "Error subiendo archivo" },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { url: data.path, path: data.path },
      { status: 200 }
    );
  } catch (err) {
    console.error("Error in POST /api/bolsa-laboral/upload-cv:", err);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
