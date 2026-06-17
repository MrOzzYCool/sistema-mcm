/**
 * StorageService — Servicio desacoplado de almacenamiento de archivos.
 *
 * Actualmente usa Supabase Storage como fallback temporal.
 * Diseñado para ser reemplazado por MinIO/S3 sin cambiar el resto del código.
 *
 * Para migrar a MinIO:
 * 1. Instalar: npm install @aws-sdk/client-s3
 * 2. Configurar env vars: MINIO_ENDPOINT, MINIO_ACCESS_KEY, MINIO_SECRET_KEY, MINIO_BUCKET
 * 3. Reemplazar las implementaciones de upload/delete/getUrl en este archivo
 */

export interface UploadResult {
  url: string;
  path: string;
  size: number;
}

export interface StorageConfig {
  provider: "supabase" | "minio" | "local";
  bucket: string;
  publicBaseUrl?: string;
}

// ─── Configuración actual ────────────────────────────────────────────────────
// TODO: Cuando MinIO esté listo, cambiar provider a "minio" y agregar env vars
const config: StorageConfig = {
  provider: "supabase", // Temporal hasta que MinIO esté configurado
  bucket: "materiales-academicos",
  publicBaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL
    ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/materiales-academicos`
    : "",
};

// Tipos de archivo permitidos para materiales académicos
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
 * Sube un archivo al almacenamiento
 *
 * NOTA: Esta función se ejecuta en el SERVER (API route).
 * Cuando se migre a MinIO, aquí se reemplaza por S3Client.putObject()
 */
export async function uploadToStorage(
  fileBuffer: Buffer,
  path: string,
  contentType: string
): Promise<UploadResult> {
  if (config.provider === "minio") {
    // TODO: Implementar cuando MinIO esté listo
    // const s3 = new S3Client({
    //   endpoint: process.env.MINIO_ENDPOINT,
    //   region: "us-east-1",
    //   credentials: {
    //     accessKeyId: process.env.MINIO_ACCESS_KEY!,
    //     secretAccessKey: process.env.MINIO_SECRET_KEY!,
    //   },
    //   forcePathStyle: true,
    // });
    // await s3.send(new PutObjectCommand({
    //   Bucket: config.bucket,
    //   Key: path,
    //   Body: fileBuffer,
    //   ContentType: contentType,
    // }));
    // return { url: `${process.env.MINIO_PUBLIC_URL}/${config.bucket}/${path}`, path, size: fileBuffer.length };
    throw new Error("MinIO no configurado aún. Usa Supabase Storage temporalmente.");
  }

  // Supabase Storage (temporal)
  const { createClient } = await import("@supabase/supabase-js");
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const { error } = await supabaseAdmin.storage
    .from(config.bucket)
    .upload(path, fileBuffer, { contentType, upsert: true });

  if (error) throw new Error(`Error subiendo archivo: ${error.message}`);

  const url = `${config.publicBaseUrl}/${path}`;
  return { url, path, size: fileBuffer.length };
}

/**
 * Elimina un archivo del almacenamiento
 */
export async function deleteFromStorage(path: string): Promise<void> {
  if (config.provider === "minio") {
    // TODO: s3.send(new DeleteObjectCommand({ Bucket, Key: path }))
    throw new Error("MinIO no configurado aún.");
  }

  const { createClient } = await import("@supabase/supabase-js");
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const { error } = await supabaseAdmin.storage
    .from(config.bucket)
    .remove([path]);

  if (error) console.error(`Error eliminando archivo: ${error.message}`);
}

/**
 * Obtiene la URL pública de un archivo
 */
export function getPublicUrl(path: string): string {
  if (config.provider === "minio") {
    return `${process.env.MINIO_PUBLIC_URL ?? ""}/${config.bucket}/${path}`;
  }
  return `${config.publicBaseUrl}/${path}`;
}
