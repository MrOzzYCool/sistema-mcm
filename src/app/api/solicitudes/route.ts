import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { enviarConfirmacionRecepcion } from "@/lib/emailService";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Generar token único de subsanación
    const token_subsanacion = crypto.randomUUID();

    // Insertar en Supabase con el token
    const { data, error } = await supabase
      .from("solicitudes")
      .insert({ ...body, token_subsanacion, estado: "pendiente" })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Enviar correo de confirmación (no bloqueante — si falla el email, la solicitud ya está guardada)
    try {
      await enviarConfirmacionRecepcion({
        email:       body.email,
        nombres:     body.nombres,
        apellidos:   body.apellidos,
        tipoTramite: body.tipo_tramite,
        token:       token_subsanacion,
      });
    } catch (emailErr) {
      // Log del error pero no falla la solicitud
      console.error("Error enviando email de confirmación:", emailErr);
    }

    return NextResponse.json({ success: true, id: data.id }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error interno" },
      { status: 500 }
    );
  }
}
