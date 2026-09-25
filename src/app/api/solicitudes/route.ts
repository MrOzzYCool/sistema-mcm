import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { enviarConfirmacionRecepcion } from "@/lib/emailService";
import { ACTUALIZACIONES_CATALOGO } from "@/lib/mock-data";
import { resolverGrupoActivo, inscripcionCerradaPorFecha } from "@/lib/grupos-actualizacion/logic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Generar token único de subsanación
    const token_subsanacion = crypto.randomUUID();

    // Para inscripciones de actualización, vincular al grupo (tanda) activo del programa.
    // Otros tipos de formulario mantienen el comportamiento previo sin cambios.
    let grupo_actualizacion_id: string | null = null;
    if (body.tipo_formulario === "actualizacion") {
      // Determinar el programa_id: del body si viene; si no, resolverlo por label
      let programaId: string | undefined = body.programa_id;
      if (!programaId) {
        const catItem = ACTUALIZACIONES_CATALOGO.find(
          (p) => p.label === body.tipo_tramite
        );
        programaId = catItem?.id;
      }

      // Consultar el grupo activo de ese programa (incluir fecha de cierre)
      const { data: grupos, error: gruposError } = await supabaseAdmin
        .from("grupos_actualizacion")
        .select("id, programa_id, estado, fecha_cierre_inscripcion")
        .eq("programa_id", programaId ?? "")
        .eq("estado", "activo");

      if (gruposError) {
        return NextResponse.json({ error: gruposError.message }, { status: 500 });
      }

      const grupoId = resolverGrupoActivo(programaId ?? "", grupos ?? []);
      if (!grupoId) {
        return NextResponse.json(
          { error: "No hay una tanda abierta para este programa" },
          { status: 400 }
        );
      }

      // Bloqueo por fecha: aunque el grupo siga 'activo', si su fecha de cierre
      // de inscripción ya pasó no se admiten nuevas inscripciones.
      const grupoActivo = (grupos ?? []).find((g) => g.id === grupoId);
      if (grupoActivo && inscripcionCerradaPorFecha(grupoActivo, new Date())) {
        return NextResponse.json(
          { error: "Las inscripciones para esta tanda ya cerraron" },
          { status: 400 }
        );
      }

      grupo_actualizacion_id = grupoId;
    }

    // No pasar programa_id al insert de solicitudes (esa columna no existe).
    const { programa_id: _programaIdIgnorado, ...datosSolicitud } = body;

    // Insertar en Supabase con el token
    const { data, error } = await supabaseAdmin
      .from("solicitudes")
      .insert({
        ...datosSolicitud,
        token_subsanacion,
        estado: "pendiente",
        ...(grupo_actualizacion_id ? { grupo_actualizacion_id } : {}),
      })
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
