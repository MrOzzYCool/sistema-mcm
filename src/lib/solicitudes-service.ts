import { supabase, SolicitudDB } from "./supabase";

const BUCKET = "tramites-mcm";

// ─── URL: si ya es http la usa directo, si es path la construye via SDK ────────

export function getPublicUrl(pathOrUrl: string): string {
  if (pathOrUrl.startsWith("http")) return pathOrUrl;
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(pathOrUrl);
  return data.publicUrl;
}

// ─── Path con timestamp — garantiza unicidad y trazabilidad ──────────────────
// Formato: [DNI]/[tipo]-[timestamp].jpg
// Ejemplo: 10295289/voucher-1711700000.jpg

function buildPath(
  dni: string,
  tipo: "voucher" | "dni-anverso" | "dni-reverso",
  timestamp: number
): string {
  return `${dni}/${tipo}-${timestamp}.jpg`;
}

// ─── Subir un archivo y devolver su URL pública inmediatamente ────────────────

async function uploadFile(file: File, path: string): Promise<string> {
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { upsert: true, contentType: file.type });

  if (error) throw new Error(`Error subiendo ${path}: ${error.message}`);

  // URL construida por el SDK — es exactamente lo que se guardará en la tabla
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

// ─── Eliminar archivos (rollback) ─────────────────────────────────────────────

async function deleteFiles(paths: string[]) {
  await supabase.storage.from(BUCKET).remove(paths);
}

// ─── Subir múltiples vouchers y los 2 DNI ────────────────────────────────────

export async function uploadSolicitudFiles(
  dni: string,
  vouchers: File[],       // array de vouchers
  dniAnverso: File,
  dniReverso: File
): Promise<{
  voucherUrl: string;     // URLs separadas por coma si hay varios
  dniAnversoUrl: string;
  dniReversoUrl: string;
  paths: string[];
}> {
  const ts       = Math.floor(Date.now() / 1000);
  const uploaded: string[] = [];

  try {
    // Subir todos los vouchers
    const voucherUrls: string[] = [];
    for (let i = 0; i < vouchers.length; i++) {
      const path = `${dni}/voucher-${ts}-${i + 1}.jpg`;
      const url  = await uploadFile(vouchers[i], path);
      uploaded.push(path);
      voucherUrls.push(url);
    }

    const pathAnverso = buildPath(dni, "dni-anverso", ts);
    const pathReverso = buildPath(dni, "dni-reverso", ts);

    const dniAnversoUrl = await uploadFile(dniAnverso, pathAnverso); uploaded.push(pathAnverso);
    const dniReversoUrl = await uploadFile(dniReverso, pathReverso); uploaded.push(pathReverso);

    return {
      voucherUrl:    voucherUrls.join(","),   // guardamos todas las URLs separadas por coma
      dniAnversoUrl,
      dniReversoUrl,
      paths: uploaded,
    };
  } catch (err) {
    if (uploaded.length > 0) await deleteFiles(uploaded);
    throw err;
  }
}

// ─── Insertar solicitud ───────────────────────────────────────────────────────

export async function insertarSolicitud(
  datos: Omit<SolicitudDB, "id" | "created_at">
): Promise<SolicitudDB> {
  const { data, error } = await supabase
    .from("solicitudes")
    .insert(datos)
    .select()
    .single();

  if (error) throw new Error(`Error guardando solicitud: ${error.message}`);
  return data as SolicitudDB;
}

// ─── Obtener solicitudes ──────────────────────────────────────────────────────

export async function getSolicitudes(tipoFormulario: "tramite" | "actualizacion" = "tramite"): Promise<SolicitudDB[]> {
  const { data, error } = await supabase
    .from("solicitudes")
    .select("*")
    .eq("tipo_formulario", tipoFormulario)
    .order("created_at", { ascending: false })
    .limit(500);

  if (error) throw new Error(`Error cargando solicitudes: ${error.message}`);
  return (data ?? []) as SolicitudDB[];
}

// ─── Actualizar estado ────────────────────────────────────────────────────────

export async function actualizarEstado(
  id: string,
  estado: SolicitudDB["estado"],
  observacion?: string
): Promise<void> {
  const update: Partial<SolicitudDB> = { estado };
  if (observacion !== undefined) update.observacion = observacion;

  const { error } = await supabase
    .from("solicitudes")
    .update(update)
    .eq("id", id);

  if (error) throw new Error(`Error actualizando estado: ${error.message}`);
}

// ─── Borrar TODAS las solicitudes (limpieza de pruebas) ───────────────────────

export async function borrarTodasLasSolicitudes(): Promise<void> {
  const { error } = await supabase
    .from("solicitudes")
    .delete()
    .neq("id", "00000000-0000-0000-0000-000000000000"); // condición siempre true

  if (error) throw new Error(`Error borrando solicitudes: ${error.message}`);
}
