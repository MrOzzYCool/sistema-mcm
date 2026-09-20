import { supabase, GrupoActualizacionDB } from "./supabase";

// ─── Servicio cliente para Grupos de Actualización ───────────────────────────
// Sigue el patrón de solicitudes-service.ts: usa el token de sesión de Supabase
// para autenticar contra la API_Grupos (/api/admin/grupos-actualizacion).

async function getToken(): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ?? "";
}

/**
 * Lista los grupos de actualización. Opcionalmente filtra por programa.
 */
export async function getGrupos(programaId?: string): Promise<GrupoActualizacionDB[]> {
  const token = await getToken();
  const url = programaId
    ? `/api/admin/grupos-actualizacion?programa_id=${encodeURIComponent(programaId)}`
    : "/api/admin/grupos-actualizacion";

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new Error(json.error ?? `Error ${res.status}`);
  }

  const json = await res.json();
  return (json.grupos ?? []) as GrupoActualizacionDB[];
}

/**
 * Apertura un grupo (tanda) para un programa.
 */
export async function aperturarGrupo(datos: {
  programa_id: string;
  fecha_inicio: string;
  fecha_cierre_inscripcion?: string | null;
}): Promise<GrupoActualizacionDB> {
  const token = await getToken();

  const res = await fetch("/api/admin/grupos-actualizacion", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(datos),
  });

  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new Error(json.error ?? `Error ${res.status}`);
  }

  const json = await res.json();
  return json.grupo as GrupoActualizacionDB;
}

/**
 * Cierra un grupo activo (idempotente).
 */
export async function cerrarGrupo(id: string): Promise<void> {
  const token = await getToken();

  const res = await fetch("/api/admin/grupos-actualizacion", {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ id, estado: "cerrado" }),
  });

  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new Error(json.error ?? `Error ${res.status}`);
  }
}
