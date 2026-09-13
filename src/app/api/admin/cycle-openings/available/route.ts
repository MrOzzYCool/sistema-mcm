import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { supabase } from "@/lib/supabase";

const ALLOWED_ROLES = ["super_admin", "cycle_manager"];

async function verifyAccess(req: NextRequest) {
  const token = (req.headers.get("authorization") ?? "").replace("Bearer ", "");
  if (!token) return null;
  const { data: { user } } = await supabase.auth.getUser(token);
  if (!user) return null;

  // Check hardcoded admin
  if (user.email?.toLowerCase() === "admin@margaritacabrera.edu.pe") return user;

  // Check profile role
  const { data: profile } = await supabaseAdmin
    .from("profiles").select("rol").eq("id", user.id).single();
  if (!profile || !ALLOWED_ROLES.includes(profile.rol)) return null;
  return user;
}

/**
 * GET /api/admin/cycle-openings/available?carrera_id=...&ciclo=...
 *
 * Devuelve las aperturas con status='activo' de la carrera/ciclo indicados,
 * cada una con su cupo disponible para poblar el desplegable de matrícula.
 *
 * Respuesta: { secciones: Array<{ id, seccion, tope, vinculadas, cupos_disponibles }> }
 */
export async function GET(req: NextRequest) {
  const admin = await verifyAccess(req);
  if (!admin) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const carreraId = searchParams.get("carrera_id");
  const cicloParam = searchParams.get("ciclo");

  if (!carreraId || !cicloParam) {
    return NextResponse.json({ error: "carrera_id y ciclo son requeridos" }, { status: 400 });
  }

  const ciclo = Number(cicloParam);
  if (!Number.isInteger(ciclo) || ciclo <= 0) {
    return NextResponse.json({ error: "ciclo debe ser un entero positivo" }, { status: 400 });
  }

  // Aperturas activas de esta carrera para el ciclo solicitado
  const { data: openings, error } = await supabaseAdmin
    .from("cycle_openings")
    .select("id, seccion, tope")
    .eq("carrera_id", carreraId)
    .eq("cycle_number", ciclo)
    .eq("status", "activo")
    .order("seccion", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const secciones = await Promise.all(
    (openings ?? []).map(async (opening) => {
      // vinculadas = inscripciones activas vinculadas a esta apertura
      const { count } = await supabaseAdmin
        .from("inscripciones")
        .select("id", { count: "exact", head: true })
        .eq("cycle_opening_id", opening.id)
        .eq("estado", "activo");

      const tope = opening.tope ?? 0;
      const vinculadas = count ?? 0;

      return {
        id: opening.id,
        seccion: opening.seccion,
        tope,
        vinculadas,
        cupos_disponibles: tope - vinculadas,
      };
    })
  );

  return NextResponse.json({ secciones });
}
