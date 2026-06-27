/**
 * StorageService — Servicio desacoplado de almacenamiento de archivos.
 *
 * Conectado a MinIO (S3-compatible) para materiales académicos.
 * Los buckets de Supabase (tramites-mcm, vouchers) NO se tocan.
 *
 * Estructura de almacenamiento:
 * {carrera_slug}/ciclo-{numero}/{curso_slug}/semana-{numero}/{timestamp}-{archivo}
 * Ejemplo: idiomas/ciclo-4/basic-spelling-skills/semana-1/1718900000-separata.pdf
 */

import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export interface UploadResult {
  url: string;
  path: string;
  size: number;
}

export interface StorageConfig {
  provider: "supabase" | "minio";
  bucket: string;
  endpoint: string;
}

// ─── Configuración ───────────────────────────────────────────────────────────

const config: StorageConfig = {
  provider: (process.env.STORAGE_PROVIDER as "minio" | "supabase") || "minio",
  bucket: "aula-virtual",
  endpoint: process.env.MINIO_ENDPOINT ?? "http://192.168.1.42:9000",
};

// URL pública base (sin duplicar bucket)
// Formato final: {MINIO_PUBLIC_URL}/{bucket}/{path}
const PUBLIC_BASE = process.env.MINIO_PUBLIC_URL ?? process.env.MINIO_ENDPOINT ?? "http://192.168.1.42:9000";

// ─── S3 Client para MinIO ────────────────────────────────────────────────────

function getS3Client(): S3Client {
  return new S3Client({
    endpoint: config.endpoint,
    region: "us-east-1",
    credentials: {
      accessKeyId: process.env.MINIO_ACCESS_KEY ?? "",
      secretAccessKey: process.env.MINIO_SECRET_KEY ?? "",
    },
    forcePathStyle: true,
  });
}

// ─── Tipos de archivo permitidos ─────────────────────────────────────────────

export const ALLOWED_EXTENSIONS = ["pdf", "docx", "xlsx", "pptx", "jpg", "jpeg", "png", "mp4", "url", "mp3", "zip", "rar", "doc", "ppt", "xls"];
export const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB

/**
 * Valida un archivo antes de subirlo
 */
export function validateFile(file: { name: string; size: number; type: string }): { valid: boolean; error?: string } {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";

  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return { valid: false, error: `Tipo no permitido (.${ext}). Permitidos: ${ALLOWED_EXTENSIONS.join(", ")}` };
  }
  if (file.size > MAX_FILE_SIZE) {
    return { valid: false, error: `Archivo muy grande (${(file.size / 1024 / 1024).toFixed(1)}MB). Máx: 100MB` };
  }
  if (file.size === 0) {
    return { valid: false, error: "El archivo está vacío" };
  }
  return { valid: true };
}

/**
 * Genera un slug seguro para nombres de carpeta
 */
export function toSlug(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // quitar tildes
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Genera la ruta de almacenamiento con la nueva estructura legible.
 *
 * Formato: {carrera_slug}/ciclo-{n}/seccion-{nnn}/{curso_slug}/semana-{n}/{timestamp}-{archivo}
 * Ejemplo: asistencia-administrativa/ciclo-1/seccion-410/basic-spelling-skills/semana-1/1718900000-separata.pdf
 */
export function buildStoragePath(opts: {
  carrera: string;
  ciclo: number;
  cursoNombre: string;
  semana: number | null;
  fileName: string;
  seccion?: number | null;
}): string {
  const { carrera, ciclo, cursoNombre, semana, fileName, seccion } = opts;
  const timestamp = Date.now();
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_").toLowerCase();
  const carreraSlug = toSlug(carrera);
  const cursoSlug = toSlug(cursoNombre);
  const semanaPath = semana ? `semana-${semana}` : "general";
  const seccionPath = seccion ? `seccion-${seccion}` : "sin-seccion";

  return `${carreraSlug}/ciclo-${ciclo}/${seccionPath}/${cursoSlug}/${semanaPath}/${timestamp}-${safeName}`;
}

/**
 * Genera ruta legacy (para compatibilidad con archivos anteriores)
 */
export function buildStoragePathLegacy(cursoId: string, semana: number | null, fileName: string): string {
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
 * Construye la URL pública correcta (sin duplicar bucket)
 * Resultado: http://192.168.1.42:9000/aula-virtual/{path}
 */
function buildPublicUrl(path: string): string {
  // Asegurar que no haya doble slash ni bucket duplicado
  const base = PUBLIC_BASE.replace(/\/$/, "");
  return `${base}/${config.bucket}/${path}`;
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

    return { url: buildPublicUrl(path), path, size: fileBuffer.length };
  }

  // Fallback: Supabase Storage
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
    await s3.send(new DeleteObjectCommand({ Bucket: config.bucket, Key: path }));
    return;
  }

  const { createClient } = await import("@supabase/supabase-js");
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
  await supabaseAdmin.storage.from("materiales-academicos").remove([path]);
}

/**
 * Obtiene la URL pública de un archivo dado su path
 */
export function getPublicUrl(path: string): string {
  return buildPublicUrl(path);
}


/**
 * Genera una URL firmada temporal para acceder a un archivo privado en MinIO.
 *
 * @param path - El Key del objeto en el bucket (almacenado en material_curso.url o extraído de ella)
 * @param expiresIn - Duración en segundos (3600 = 1h para alumnos, 86400 = 24h para docentes)
 * @returns URL firmada temporal
 */
export async function generatePresignedUrl(path: string, expiresIn: number = 3600): Promise<string> {
  if (config.provider !== "minio") {
    // Supabase: devolver URL directa (buckets públicos)
    return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/materiales-academicos/${path}`;
  }

  const s3 = getS3Client();

  const command = new GetObjectCommand({
    Bucket: config.bucket,
    Key: path,
  });

  const signedUrl = await getSignedUrl(s3, command, { expiresIn });
  return signedUrl;
}

/**
 * Extrae el path/key del archivo a partir de la URL almacenada en la DB.
 *
 * URLs posibles almacenadas:
 * - https://archivos.mcm-storage.com/aula-virtual/cursos/123/semana-1/archivo.pdf
 * - http://192.168.1.42:9000/aula-virtual/idiomas/ciclo-4/basic-spelling-skills/semana-1/1718900000-separata.pdf
 * - cursos/123/semana-1/archivo.pdf (path directo)
 *
 * Resultado esperado: cursos/123/semana-1/archivo.pdf (sin el bucket)
 */
export function extractPathFromUrl(url: string): string {
  // Si no es una URL completa, ya es un path directo
  if (!url.startsWith("http")) {
    // Pero verificar que no empiece con el bucket name
    if (url.startsWith("aula-virtual/")) return url.substring("aula-virtual/".length);
    return url;
  }

  try {
    const parsed = new URL(url);
    // pathname será: /aula-virtual/cursos/123/semana-1/archivo.pdf
    let path = parsed.pathname;

    // Quitar slash inicial
    if (path.startsWith("/")) path = path.substring(1);

    // Quitar el nombre del bucket del inicio del path
    if (path.startsWith("aula-virtual/")) {
      return path.substring("aula-virtual/".length);
    }

    // Si no tiene el bucket en el path, devolver todo el path
    return path;
  } catch {
    // Si falla el parse, intentar split directo
    const marker = "/aula-virtual/";
    const idx = url.indexOf(marker);
    if (idx >= 0) return url.substring(idx + marker.length);
    return url;
  }
}
