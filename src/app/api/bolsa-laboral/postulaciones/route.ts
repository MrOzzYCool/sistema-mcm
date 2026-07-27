import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { supabase } from "@/lib/supabase";
import { verifyAlumnaBolsa } from "@/lib/bolsa-laboral/verify-alumna-bolsa";

const ADMIN_EMAILS = ["admin@margaritacabrera.edu.pe"];

async function verifyAdmin(req: NextRequest) {
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.replace("Bearer ", "");
  if (!token) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser(token);
  if (!user?.email || !ADMIN_EMAILS.includes(user.email.toLowerCase()))
    return null;
  return user;
}

/**
 * POST /api/bolsa-laboral/postulaciones
 * Alumna (alumna_bolsa): crea una nueva postulación a una oferta activa.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await verifyAlumnaBolsa(req);
    if (!user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const body = await req.json();
    const { oferta_id, mensaje, cv_url } = body;

    if (!oferta_id) {
      return NextResponse.json(
        { error: "oferta_id es requerido" },
        { status: 400 }
      );
    }

    // Verificar que la oferta existe y está activa
    const { data: offer } = await supabaseAdmin
      .from("ofertas_laborales")
      .select("estado")
      .eq("id", oferta_id)
      .single();

    if (!offer || offer.estado !== "activa") {
      return NextResponse.json(
        { error: "La oferta no está aceptando postulaciones" },
        { status: 400 }
      );
    }

    // Verificar que la alumna no se haya postulado antes a esta oferta
    const { data: existing } = await supabaseAdmin
      .from("postulaciones")
      .select("id")
      .eq("oferta_id", oferta_id)
      .eq("alumna_id", user.id)
      .limit(1);

    if (existing && existing.length > 0) {
      return NextResponse.json(
        { error: "Ya te postulaste a esta oferta" },
        { status: 409 }
      );
    }

    // Insertar postulación con estado 'enviada'
    const { data, error } = await supabaseAdmin
      .from("postulaciones")
      .insert({
        oferta_id,
        alumna_id: user.id,
        mensaje: mensaje?.trim() || null,
        cv_url: cv_url || null,
        estado: "enviada",
      })
      .select("id")
      .single();

    if (error) {
      console.error("Error insertando postulación:", error.message);
      return NextResponse.json(
        { error: "Error interno del servidor" },
        { status: 500 }
      );
    }

    return NextResponse.json({ id: data.id }, { status: 201 });
  } catch (err) {
    console.error("Error en POST /api/bolsa-laboral/postulaciones:", err);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/bolsa-laboral/postulaciones
 * Alumna (alumna_bolsa): retorna solo sus propias postulaciones con oferta join.
 * Admin (super_admin): retorna todas con alumna_nombre y offer details.
 * Soporta filtro ?oferta_id= para admin.
 */
export async function GET(req: NextRequest) {
  try {
    // Intentar verificar como alumna primero
    const alumna = await verifyAlumnaBolsa(req);
    if (alumna) {
      // Alumna: retornar solo sus postulaciones con datos de oferta
      const { data, error } = await supabaseAdmin
        .from("postulaciones")
        .select("*, ofertas_laborales(puesto, empresa_nombre)")
        .eq("alumna_id", alumna.id)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error obteniendo postulaciones alumna:", error.message);
        return NextResponse.json(
          { error: "Error interno del servidor" },
          { status: 500 }
        );
      }

      return NextResponse.json(data ?? [], { status: 200 });
    }

    // Intentar verificar como admin
    const admin = await verifyAdmin(req);
    if (admin) {
      // Admin: retornar todas con alumna nombre y datos de oferta
      let query = supabaseAdmin
        .from("postulaciones")
        .select(
          "*, ofertas_laborales(puesto, empresa_nombre), profiles!postulaciones_alumna_id_fkey(nombre)"
        )
        .order("created_at", { ascending: false });

      // Soporte para filtro por oferta_id
      const ofertaId = req.nextUrl.searchParams.get("oferta_id");
      if (ofertaId) {
        query = query.eq("oferta_id", ofertaId);
      }

      const { data, error } = await query;

      if (error) {
        console.error("Error obteniendo postulaciones admin:", error.message);
        return NextResponse.json(
          { error: "Error interno del servidor" },
          { status: 500 }
        );
      }

      return NextResponse.json(data ?? [], { status: 200 });
    }

    // Ningún rol autorizado
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  } catch (err) {
    console.error("Error en GET /api/bolsa-laboral/postulaciones:", err);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/bolsa-laboral/postulaciones
 * Admin (super_admin): actualiza el estado de una postulación.
 * Cuerpo: { id, estado } donde estado es 'vista', 'seleccionada', o 'descartada'.
 */
export async function PATCH(req: NextRequest) {
  try {
    const admin = await verifyAdmin(req);
    if (!admin) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const body = await req.json();
    const { id, estado } = body;

    if (!id) {
      return NextResponse.json(
        { error: "El ID de la postulación es requerido" },
        { status: 400 }
      );
    }

    const validEstados = ["vista", "seleccionada", "descartada"];
    if (!estado || !validEstados.includes(estado)) {
      return NextResponse.json(
        { error: "Estado inválido. Valores permitidos: vista, seleccionada, descartada" },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from("postulaciones")
      .update({ estado })
      .eq("id", id)
      .select("id")
      .single();

    if (error) {
      console.error("Error actualizando postulación:", error.message);
      if (error.code === "PGRST116") {
        return NextResponse.json(
          { error: "Postulación no encontrada" },
          { status: 404 }
        );
      }
      return NextResponse.json(
        { error: "Error interno del servidor" },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json(
        { error: "Postulación no encontrada" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, id: data.id }, { status: 200 });
  } catch (err) {
    console.error("Error en PATCH /api/bolsa-laboral/postulaciones:", err);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
