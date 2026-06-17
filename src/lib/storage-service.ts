/**
 * StorageService — Servicio desacoplado de almacenamiento de archivos.
 *
 * Conectado a MinIO (S3-compatible) para materiales académicos.
 * Los buckets de Supabase (tramites-mcm, vouchers) NO se tocan.
 */

import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";

export interface UploadResult {
  url: string;
  path: string;
  size: number;
}

export interface StorageConfig {
  provider: "supabase" | "minio";
  bucket: string;
  publicBaseUrl: string;
}

// ─── Configuración: MinIO activo ─────────────────────────────────────────────

const config: StorageConfig = {
  provider: (process.env.STORAGE_PROVIDER as "minio" | "supabase") || "minio",
  bucket: "aula-virtual",
  publicBaseUrl: process.env.MINIO_PUBLIC_URL ?? "http://192.168.1.42:9000",
};

// ─── S3 Client para MinIO ────────────────────────────────────────────────────

function getS3Client(): S3Client {
  return new S3Client({
    endpoint: process.env.MINIO_ENDPOINT ?? "http://192.168.1.42:9000",
    region: "us-east-1",
    credentials: {
      accessKeyId: process.env.MINIO_ACCESS_KEY ?? "",
      secretAccessKey: process.env.MINIO_SECRET_KEY ?? "",
    },
    forcePathStyle: true, // Requerido para MinIO
  });
}

// ─── Tipos de archivo permitidos ─────────────────────────────────────────────

export const ALLOWED_MIME_TYPES: Record<string, string> = {
  "application/pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
  "image/jpeg": "jpg",
  "image/png": "png",
  "video/mp4": "mp4",
};

export const ALLOWED_EXTENSIONS = ["pdf", "docx", "xlsx", "pptx", "jpg", "jpeg", "png", "mp4"];
export const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB

/**
 * Valida un archivo antes de subirlo
 */
export function validateFile(file: { name: string; size: number; type: string }): { valid: boolean; error?: string } {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";

  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return { valid: false, error: `Tipo de archivo no permitido (.${ext}). Permitidos: ${ALLOWED_EXTENSIONS.join(", ")}` };
  }

  if (file.size > MAX_FILE_SIZE) {
    return { valid: false, error: `Archivo demasiado grande (${(file.size / 1024 / 1024).toFixed(1)}MB). Máximo: 100MB` };
  }

  if (file.size === 0) {
    return { valid: false, error: "El archivo está vacío" };
  }

  return { valid: true };
}

/**
 * Genera la ruta de almacenamiento para un material
 * Formato: cursos/{curso_id}/semana-{N}/{timestamp}-{nombre}
 */
export function buildStoragePath(cursoId: string, semana: number | null, fileName: string): string {
  const timestamp = Date.now();
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_").toLowerCase();
  const semanaPath = semana ? `semana-${semana}` : "general";
  return `cursos/${cursoId}/${semanaPath}/${timestamp}-${safeName}`;
}

/**
 * Obtiene la extensión del tipo de archivo
 */
export function getFileExtension(fileName: string): string {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "jpeg") return "jpg";
  return ext;
}

/**
 * Sube un archivo al almacenamiento (MinIO/S3)
 */
export async function uploadToStorage(
  fileBuffer: Buffer,
  path: string,
  contentType: string
): Promise<UploadResult> {
  if (config.provider === "minio") {
    const s3 = getS3Client();

    await s3.send(new PutObjectCommand({
      Bucket: config.bucket,
      Key: path,
      Body: fileBuffer,
      ContentType: contentType,
    }));

    const url = `${config.publicBaseUrl}/${config.bucket}/${path}`;
    return { url, path, size: fileBuffer.length };
  }

  // Fallback: Supabase Storage (no debería usarse para materiales)
  const { createClient } = await import("@supabase/supabase-js");
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const { error } = await supabaseAdmin.storage
    .from("materiales-academicos")
    .upload(path, fileBuffer, { contentType, upsert: true });

  if (error) throw new Error(`Error subiendo archivo: ${error.message}`);

  const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/materiales-academicos/${path}`;
  return { url, path, size: fileBuffer.length };
}

/**
 * Elimina un archivo del almacenamiento
 */
export async function deleteFromStorage(path: string): Promise<void> {
  if (config.provider === "minio") {
    const s3 = getS3Client();

    await s3.send(new DeleteObjectCommand({
      Bucket: config.bucket,
      Key: path,
    }));

    return;
  }

  // Fallback: Supabase
  const { createClient } = await import("@supabase/supabase-js");
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  await supabaseAdmin.storage.from("materiales-academicos").remove([path]);
}

/**
 * Obtiene la URL pública de un archivo
 * Formato MinIO: http://192.168.1.42:9000/aula-virtual/{path}
 */
export function getPublicUrl(path: string): string {
  return `${config.publicBaseUrl}/${config.bucket}/${path}`;
}
