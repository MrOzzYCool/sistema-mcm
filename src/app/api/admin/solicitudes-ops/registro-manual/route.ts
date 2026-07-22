import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { supabase } from "@/lib/supabase";

/**
 * POST /api/admin/solicitudes-ops/registro-manual
 *
 * Registra una inscripción de actualización que ya fue gestionada fuera del sistema.
 * Se inserta directo como "aprobado" con la URL del comprobante (boleta/factura) ya existente.
 * NO genera un nuevo comprobante en Nubefact.
 */

const ADMIN_EMAILS = [
  "admin@margaritacabrera.edu.pe",
  "milnarvaez@margaritacabrera.edu.pe",
];

async function verifyAccess(req: NextRequest) {
  const token = (req.headers.get("authorization") ?? "").replace("Bearer ", "");
  if (!token) return null;
  const { data: { user } } = await supabase.auth.getUser(token);
  if (!user?.email) return null;
  const email = user.email.toLowerCase();
  if (ADMIN_EMAILS.includes(email)) return user;
  // Fallback: check profile role
  const { data: profile } = await supabaseAdmin
    .from("profiles").select("rol").eq("id", user.id).single();
  if (profile?.rol === "super_admin") return user;
  return null;
}

export async function POST(req: NextRequest) {
  const admin = await verifyAccess(req);
  if (!admin) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  try {
    const body = await req.json();

    const {
      nombres, apellidos, dni, email, celular,
      tipo_tramite, monto_pagado,
      tipo_comprobante, ruc, razon_social, direccion_fiscal,
      pdf_boleta_url,
    } = body;

    // Validaciones básicas
    if (!nombres || !apellidos || !dni || !tipo_tramite) {
      return NextResponse.json(
        { error: "Campos requeridos: nombres, apellidos, dni, tipo_tramite" },
        { status: 400 }
      );
    }

    const registro = {
      nombres:          nombres.trim(),
      apellidos:        apellidos.trim(),
      dni:              dni.trim(),
      email:            (email ?? "").trim().toLowerCase(),
      celular:          (celular ?? "").trim(),
      tipo_tramite,
      costo_tramite:    monto_pagado ?? 0,
      monto_pagado:     monto_pagado ?? 0,
      tipo_comprobante: tipo_comprobante ?? "boleta",
      tipo_formulario:  "actualizacion",
      estado:           "aprobado",
      pdf_boleta_url:   (pdf_boleta_url ?? "").trim() || null,
      anio_egreso:      "—",
      // Campos opcionales de factura
      ...(tipo_comprobante === "factura" && {
        ruc:              ruc ?? null,
        razon_social:     razon_social ?? null,
        direccion_fiscal: direccion_fiscal ?? null,
      }),
      // Sin voucher ni DNI porque fue registrado manualmente
      voucher_url:      "registro-manual",
      dni_anverso_url:  "registro-manual",
      dni_reverso_url:  "registro-manual",
    };

    const { data, error } = await supabaseAdmin
      .from("solicitudes")
      .insert(registro)
      .select("id")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, id: data.id }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error interno" },
      { status: 500 }
    );
  }
}
