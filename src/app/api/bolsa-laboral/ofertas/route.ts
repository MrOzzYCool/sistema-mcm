import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { supabase } from "@/lib/supabase";
import { validateOferta } from "@/lib/bolsa-laboral/validations";

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
 * POST /api/bolsa-laboral/ofertas
 * Public: permite a empresas publicar una oferta (estado 'pendiente').
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Validar datos de la oferta
    const errors = validateOferta(body);
    if (Object.keys(errors).length > 0) {
      const missingFields = Object.keys(errors);
      return NextResponse.json(
        { error: `Campos requeridos faltantes: ${missingFields.join(", ")}` },
        { status: 400 }
      );
    }

    // Insertar oferta con estado 'pendiente'
    const { data, error } = await supabaseAdmin
      .from("ofertas_laborales")
      .insert({
        empresa_nombre: body.empresa_nombre.trim(),
        empresa_contacto: body.empresa_contacto.trim(),
        puesto: body.puesto.trim(),
        descripcion: body.descripcion.trim(),
        requisitos: body.requisitos?.trim() || null,
        sueldo_min: body.sueldo_min ?? null,
        sueldo_max: body.sueldo_max ?? null,
        modalidad: body.modalidad,
        ubicacion: body.ubicacion?.trim() || null,
        fecha_cierre: body.fecha_cierre || null,
        estado: "pendiente",
      })
      .select("id")
      .single();

    if (error) {
      console.error("Error insertando oferta:", error.message);
      return NextResponse.json(
        { error: "Error interno del servidor" },
        { status: 500 }
      );
    }

    return NextResponse.json({ id: data.id }, { status: 201 });
  } catch (err) {
    console.error("Error en POST /api/bolsa-laboral/ofertas:", err);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/bolsa-laboral/ofertas
 * Admin (super_admin): retorna todas las ofertas con conteo de postulaciones.
 */
export async function GET(req: NextRequest) {
  try {
    const admin = await verifyAdmin(req);
    if (!admin) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const { data, error } = await supabaseAdmin
      .from("ofertas_laborales")
      .select("*, postulaciones(count)")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error obteniendo ofertas:", error.message);
      return NextResponse.json(
        { error: "Error interno del servidor" },
        { status: 500 }
      );
    }

    // Transformar el conteo de postulaciones al formato esperado
    const ofertas = (data ?? []).map((oferta) => {
      const postulacionesCount =
        oferta.postulaciones?.[0]?.count ?? 0;
      // eslint-disable-next-line no-unused-vars
      const { postulaciones: _postulaciones, ...rest } = oferta;
      return { ...rest, postulaciones_count: postulacionesCount };
    });

    return NextResponse.json(ofertas, { status: 200 });
  } catch (err) {
    console.error("Error en GET /api/bolsa-laboral/ofertas:", err);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/bolsa-laboral/ofertas
 * Admin (super_admin): actualiza una oferta (aprobar, rechazar, cerrar, editar).
 */
export async function PATCH(req: NextRequest) {
  try {
    const admin = await verifyAdmin(req);
    if (!admin) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const body = await req.json();
    const { id, ...fields } = body;

    if (!id) {
      return NextResponse.json(
        { error: "El ID de la oferta es requerido" },
        { status: 400 }
      );
    }

    // Construir objeto de actualización
    const updateData: Record<string, unknown> = { ...fields };

    // Si se está aprobando (estado → activa), setear fecha_publicacion
    if (fields.estado === "activa") {
      updateData.fecha_publicacion = new Date().toISOString();
    }

    const { data, error } = await supabaseAdmin
      .from("ofertas_laborales")
      .update(updateData)
      .eq("id", id)
      .select("id")
      .single();

    if (error) {
      console.error("Error actualizando oferta:", error.message);
      // Si no se encontró la oferta
      if (error.code === "PGRST116") {
        return NextResponse.json(
          { error: "Oferta no encontrada" },
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
        { error: "Oferta no encontrada" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, id: data.id }, { status: 200 });
  } catch (err) {
    console.error("Error en PATCH /api/bolsa-laboral/ofertas:", err);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
