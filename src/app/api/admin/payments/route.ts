import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { supabase } from "@/lib/supabase";
import {
  UPDATE_PAGO_COMPLETO_ACTION,
  validarCamposComprobante,
  validarMonto,
  validarFecha,
  resolverArchivos,
  planificarEscrituras,
  construirAuditoria,
  type EditarPagoInput,
  type EstadoPago,
} from "@/lib/editar-pago";

const ADMIN_EMAIL = "admin@margaritacabrera.edu.pe";

async function verifyAdmin(req: NextRequest) {
  const token = (req.headers.get("authorization") ?? "").replace("Bearer ", "");
  if (!token) return null;
  const { data: { user } } = await supabase.auth.getUser(token);
  if (!user?.email || user.email.toLowerCase() !== ADMIN_EMAIL) return null;
  return user;
}

/**
 * GET /api/admin/payments?alumno_id=xxx
 */
export async function GET(req: NextRequest) {
  const admin = await verifyAdmin(req);
  if (!admin) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const alumnoId = req.nextUrl.searchParams.get("alumno_id");
  if (!alumnoId) return NextResponse.json({ error: "alumno_id requerido" }, { status: 400 });

  const { data: plans } = await supabaseAdmin
    .from("payment_plans")
    .select("*, installments(*)")
    .eq("alumno_id", alumnoId)
    .order("year", { ascending: false });

  return NextResponse.json({ plans: plans ?? [] });
}

/**
 * POST /api/admin/payments
 * Actions: generate-plan, mark-paid, update-amount
 */
export async function POST(req: NextRequest) {
  const admin = await verifyAdmin(req);
  if (!admin) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const body = await req.json();
  const { action } = body;

  if (action === "generate-plan") {
    const { alumno_id, ciclo, year } = body;
    if (!alumno_id || !ciclo || !year) {
      return NextResponse.json({ error: "alumno_id, ciclo y year son requeridos" }, { status: 400 });
    }

    try {
      const cicloNum = parseInt(ciclo);

      // Resolver la carrera del alumno para elegir la apertura de ciclo correcta.
      // Puede haber varias aperturas activas para el mismo ciclo (una por carrera).
      const { data: insc } = await supabaseAdmin
        .from("inscripciones")
        .select("carrera_id")
        .eq("alumno_id", alumno_id)
        .eq("estado", "activo")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      const carreraId = insc?.carrera_id ?? undefined;

      const { generateStudentPaymentPlan } = await import("@/lib/payment-service");
      const plan = await generateStudentPaymentPlan({
        alumnoId: alumno_id,
        ciclo: cicloNum,
        year: parseInt(year),
        carreraId,
      });

      await supabaseAdmin.from("historial_auditoria").insert({
        accion: "generar_plan_pagos",
        admin_id: admin.id, admin_email: admin.email, target_id: alumno_id,
        detalle: { ciclo, year, plan_id: plan.id },
      });

      return NextResponse.json({ success: true, planId: plan.id });
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "Error generando plan" },
        { status: 400 },
      );
    }
  }

  if (action === "mark-paid") {
    const { installment_id } = body;
    if (!installment_id) return NextResponse.json({ error: "installment_id requerido" }, { status: 400 });

    const { error } = await supabaseAdmin
      .from("installments")
      .update({ status: "paid", fecha_pago: new Date().toISOString() })
      .eq("id", installment_id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  if (action === "update-nota") {
    const { installment_id, nota_contabilidad } = body;
    if (!installment_id) {
      return NextResponse.json({ error: "installment_id requerido" }, { status: 400 });
    }
    const { error } = await supabaseAdmin
      .from("installments")
      .update({ nota_contabilidad: nota_contabilidad ?? null })
      .eq("id", installment_id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    await supabaseAdmin.from("historial_auditoria").insert({
      accion: "editar_nota_contabilidad",
      admin_id: admin.id, admin_email: admin.email,
      detalle: { installment_id },
    });
    return NextResponse.json({ success: true, message: "Nota guardada." });
  }

  if (action === "update-amount") {
    const { installment_id, monto, observacion } = body;
    if (!installment_id || monto == null) {
      return NextResponse.json({ error: "installment_id y monto requeridos" }, { status: 400 });
    }

    const nuevoMonto = Number(monto);

    // Obtener el status actual para decidir la transición
    const { data: instActual } = await supabaseAdmin
      .from("installments")
      .select("status")
      .eq("id", installment_id)
      .single();

    const statusActual = instActual?.status ?? "pending";

    const updateData: Record<string, unknown> = {
      amount: nuevoMonto,
      observacion: observacion ?? null,
    };

    if (nuevoMonto === 0) {
      // Monto 0 = exonerado (no genera deuda). Solo si no está ya pagada.
      if (statusActual !== "paid") {
        updateData.status = "exonerado";
        updateData.fecha_pago = new Date().toISOString();
      }
    } else {
      // Monto > 0: si estaba exonerado, revertir a pendiente para que sea cobrable.
      if (statusActual === "exonerado") {
        updateData.status = "pending";
        updateData.fecha_pago = null;
      }
    }

    const { error } = await supabaseAdmin
      .from("installments")
      .update(updateData)
      .eq("id", installment_id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    await supabaseAdmin.from("historial_auditoria").insert({
      accion: "editar_monto_cuota",
      admin_id: admin.id, admin_email: admin.email,
      detalle: { installment_id, monto: nuevoMonto, exonerado: nuevoMonto === 0 },
    });

    return NextResponse.json({ success: true });
  }

  if (action === "delete-plan") {
    const { plan_id } = body;
    if (!plan_id) return NextResponse.json({ error: "plan_id requerido" }, { status: 400 });

    // Delete installments first (FK cascade would handle it, but explicit is clearer)
    await supabaseAdmin.from("installments").delete().eq("plan_id", plan_id);
    const { error } = await supabaseAdmin.from("payment_plans").delete().eq("id", plan_id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    await supabaseAdmin.from("historial_auditoria").insert({
      accion: "eliminar_plan_pagos",
      admin_id: admin.id, admin_email: admin.email,
      detalle: { plan_id },
    });

    return NextResponse.json({ success: true, message: "Plan de pagos eliminado." });
  }

  if (action === "change-ciclo") {
    const { alumno_id, plan_id, nuevo_ciclo } = body;
    if (!alumno_id || !nuevo_ciclo) {
      return NextResponse.json({ error: "alumno_id y nuevo_ciclo requeridos" }, { status: 400 });
    }

    // Update payment_plan ciclo
    if (plan_id) {
      await supabaseAdmin.from("payment_plans").update({ ciclo: Number(nuevo_ciclo) }).eq("id", plan_id);
    }

    // Update inscripciones
    await supabaseAdmin.from("inscripciones").update({ ciclo_actual: Number(nuevo_ciclo) }).eq("alumno_id", alumno_id);

    return NextResponse.json({ success: true, message: `Ciclo actualizado a ${nuevo_ciclo}. Recuerda regenerar el plan de pagos.` });
  }

  if (action === "manual-comprobante") {
    const { installment_id, comprobante_url, comprobante_serie, comprobante_numero, tipo_comprobante, fecha_pago, voucher_url } = body;
    if (!installment_id || !comprobante_url || !comprobante_serie || !comprobante_numero) {
      return NextResponse.json({ error: "installment_id, comprobante_url, comprobante_serie y comprobante_numero son requeridos" }, { status: 400 });
    }
    if (!voucher_url) {
      return NextResponse.json({ error: "El voucher es obligatorio" }, { status: 400 });
    }

    const reviewedAt = new Date().toISOString();

    // Update installment to paid with comprobante info
    const { error: instErr } = await supabaseAdmin.from("installments").update({
      status: "paid",
      fecha_pago: fecha_pago ?? reviewedAt,
      tipo_comprobante: tipo_comprobante ?? "boleta",
      comprobante_serie,
      comprobante_numero: String(comprobante_numero),
      comprobante_url,
    }).eq("id", installment_id);

    if (instErr) return NextResponse.json({ error: instErr.message }, { status: 500 });

    // Resolve alumno_id of the installment (needed if we must insert a new voucher)
    const { data: instRow } = await supabaseAdmin
      .from("installments")
      .select("id, plan_id, payment_plans!inner(alumno_id)")
      .eq("id", installment_id)
      .single();
    const alumnoId = (instRow?.payment_plans as unknown as { alumno_id: string } | null)?.alumno_id ?? null;

    // Manage the voucher: reuse a pending one if present, otherwise insert a new approved voucher
    const { data: existingVouchers } = await supabaseAdmin
      .from("payment_vouchers")
      .select("id")
      .eq("installment_id", installment_id)
      .eq("status", "pending_review");

    if (existingVouchers && existingVouchers.length > 0) {
      await supabaseAdmin.from("payment_vouchers").update({
        status: "approved",
        voucher_url,
        reviewed_by: admin.id,
        reviewed_at: reviewedAt,
      }).eq("installment_id", installment_id).eq("status", "pending_review");
    } else if (alumnoId) {
      await supabaseAdmin.from("payment_vouchers").insert({
        installment_id,
        alumno_id: alumnoId,
        voucher_url,
        status: "approved",
        tipo_comprobante: tipo_comprobante ?? "boleta",
        reviewed_by: admin.id,
        reviewed_at: reviewedAt,
      });
    }

    await supabaseAdmin.from("historial_auditoria").insert({
      accion: "comprobante_manual",
      admin_id: admin.id, admin_email: admin.email,
      detalle: { installment_id, comprobante_serie, comprobante_numero, tipo_comprobante, voucher_registrado: true },
    });

    return NextResponse.json({ success: true, message: `Comprobante ${comprobante_serie}-${comprobante_numero} adjuntado con voucher. Cuota marcada como pagada.` });
  }

  if (action === "update-fecha-pago") {
    const { installment_id, fecha_pago } = body;
    if (!installment_id || !fecha_pago) {
      return NextResponse.json({ error: "installment_id y fecha_pago son requeridos" }, { status: 400 });
    }
    const { error } = await supabaseAdmin
      .from("installments")
      .update({ fecha_pago })
      .eq("id", installment_id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    await supabaseAdmin.from("historial_auditoria").insert({
      accion: "editar_fecha_pago",
      admin_id: admin.id, admin_email: admin.email,
      detalle: { installment_id, fecha_pago },
    });

    return NextResponse.json({ success: true, message: "Fecha de emisión actualizada." });
  }

  if (action === "cancel-by-opening") {
    // Cancelar todas las cuotas pendientes de alumnos de un ciclo/apertura específica
    const { cycle_number, carrera_id } = body;
    if (!cycle_number) {
      return NextResponse.json({ error: "cycle_number es requerido" }, { status: 400 });
    }

    try {
      // Buscar alumnos inscritos en ese ciclo (y opcionalmente carrera)
      let query = supabaseAdmin
        .from("inscripciones")
        .select("alumno_id")
        .eq("ciclo_actual", parseInt(cycle_number));

      if (carrera_id) {
        query = query.eq("carrera_id", carrera_id);
      }

      const { data: inscripciones } = await query;
      const alumnoIds = [...new Set((inscripciones ?? []).map(i => i.alumno_id).filter(Boolean))];

      if (alumnoIds.length === 0) {
        return NextResponse.json({ success: true, message: "No se encontraron alumnos para ese ciclo.", cancelled: 0 });
      }

      // Buscar planes de pago de esos alumnos
      const { data: plans } = await supabaseAdmin
        .from("payment_plans")
        .select("id")
        .in("alumno_id", alumnoIds);

      const planIds = (plans ?? []).map(p => p.id);

      if (planIds.length === 0) {
        return NextResponse.json({ success: true, message: "No hay planes de pago para esos alumnos.", cancelled: 0 });
      }

      // Cancelar todas las cuotas pendientes de esos planes
      const { data: updated, error: cancelErr } = await supabaseAdmin
        .from("installments")
        .update({ status: "cancelled" })
        .in("plan_id", planIds)
        .eq("status", "pending")
        .select("id");

      if (cancelErr) {
        return NextResponse.json({ error: cancelErr.message }, { status: 500 });
      }

      const cancelled = updated?.length ?? 0;

      await supabaseAdmin.from("historial_auditoria").insert({
        accion: "cancelar_cuotas_masivo",
        admin_id: admin.id, admin_email: admin.email,
        detalle: { cycle_number, carrera_id, alumnos: alumnoIds.length, cuotas_canceladas: cancelled },
      });

      return NextResponse.json({
        success: true,
        message: `${cancelled} cuotas pendientes canceladas para ${alumnoIds.length} alumnos del Ciclo ${cycle_number}.`,
        cancelled,
        alumnos: alumnoIds.length,
      });
    } catch (err) {
      return NextResponse.json({ error: err instanceof Error ? err.message : "Error" }, { status: 500 });
    }
  }

  if (action === UPDATE_PAGO_COMPLETO_ACTION) {
    // ─── Tarea 4.1: validación de campos + lectura de estado ────────────────
    const {
      installment_id,
      tipo_comprobante,
      comprobante_serie,
      comprobante_numero,
      amount,
      fecha_pago,
      nota_contabilidad,
      comprobante_url,
      voucher_url,
      swap_archivos,
    } = body;

    // Armar el input tipado de la lógica pura.
    const input: EditarPagoInput = {
      action: UPDATE_PAGO_COMPLETO_ACTION,
      installment_id,
      tipo_comprobante,
      comprobante_serie,
      comprobante_numero,
      amount: Number(amount),
      fecha_pago,
      nota_contabilidad: nota_contabilidad ?? null,
      comprobante_url,
      voucher_url,
      swap_archivos: swap_archivos === true,
    };

    // Validaciones de campos con las funciones puras (400 sin tocar datos).
    const errorCampos = validarCamposComprobante(input);
    if (errorCampos !== null) {
      return NextResponse.json({ error: errorCampos }, { status: 400 });
    }
    const errorMonto = validarMonto(input.amount);
    if (errorMonto !== null) {
      return NextResponse.json({ error: errorMonto }, { status: 400 });
    }
    const errorFecha = validarFecha(fecha_pago, new Date());
    if (errorFecha !== null) {
      return NextResponse.json({ error: errorFecha }, { status: 400 });
    }

    // Leer la Cuota con join a payment_plans para resolver alumno_id
    // (mismo patrón que la acción "manual-comprobante").
    const { data: instRow } = await supabaseAdmin
      .from("installments")
      .select("id, status, comprobante_url, payment_plans!inner(alumno_id)")
      .eq("id", installment_id)
      .maybeSingle();

    if (!instRow) {
      return NextResponse.json({ error: "Cuota no encontrada" }, { status: 404 });
    }
    if (instRow.status !== "paid") {
      return NextResponse.json(
        { error: "Solo se pueden editar pagos ya registrados." },
        { status: 400 },
      );
    }

    const alumnoId =
      (instRow.payment_plans as unknown as { alumno_id: string } | null)?.alumno_id ?? null;

    // Leer el Voucher_Registro asociado (el más reciente si hay varios).
    const { data: voucherRow } = await supabaseAdmin
      .from("payment_vouchers")
      .select("id, voucher_url")
      .eq("installment_id", installment_id)
      .order("reviewed_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const estado: EstadoPago = {
      installmentId: installment_id,
      status: instRow.status,
      alumnoId,
      boletaActual: instRow.comprobante_url ?? null,
      voucherId: voucherRow?.id ?? null,
      voucherActual: voucherRow?.voucher_url ?? null,
    };

    // ─── Tarea 4.2: resolución + persistencia + reversión + auditoría ───────
    const resultado = resolverArchivos({
      boletaActual: estado.boletaActual,
      voucherActual: estado.voucherActual,
      comprobanteUrl: input.comprobante_url,
      voucherUrl: input.voucher_url,
      swap: input.swap_archivos === true,
    });

    if (resultado.errores.length > 0) {
      return NextResponse.json({ error: resultado.errores[0] }, { status: 400 });
    }

    const plan = planificarEscrituras(estado, input, {
      now: new Date(),
      adminId: admin.id,
      reviewedAt: new Date().toISOString(),
    });

    if (plan.length === 0) {
      return NextResponse.json({ error: "No hay cambios para aplicar." }, { status: 400 });
    }

    // Ejecutar las escrituras en orden con reversión best-effort del swap.
    // 1) update de installments (nada que revertir si falla).
    const cmdInstallments = plan.find(
      (c) => c.tabla === "installments" && c.operacion === "update",
    );
    if (cmdInstallments && cmdInstallments.tabla === "installments") {
      const { error: instErr } = await supabaseAdmin
        .from("installments")
        .update(cmdInstallments.datos)
        .eq("id", cmdInstallments.match.id);
      if (instErr) {
        return NextResponse.json({ error: "No se pudo guardar el pago." }, { status: 500 });
      }
    }

    // 2) update/insert de payment_vouchers.
    const cmdVoucher = plan.find((c) => c.tabla === "payment_vouchers");
    if (cmdVoucher && cmdVoucher.tabla === "payment_vouchers") {
      let voucherErr: { message: string } | null = null;
      if (cmdVoucher.operacion === "update") {
        const { error } = await supabaseAdmin
          .from("payment_vouchers")
          .update(cmdVoucher.datos)
          .eq("id", cmdVoucher.match.id);
        voucherErr = error;
      } else {
        const { error } = await supabaseAdmin
          .from("payment_vouchers")
          .insert(cmdVoucher.datos);
        voucherErr = error;
      }

      if (voucherErr) {
        // Reversión best-effort de la primera escritura: restaurar comprobante_url.
        const { error: revertErr } = await supabaseAdmin
          .from("installments")
          .update({ comprobante_url: estado.boletaActual })
          .eq("id", estado.installmentId);

        if (revertErr) {
          console.error(
            "[update-pago-completo] Fallo al revertir installments tras error de voucher",
            { installment_id: estado.installmentId, revertErr: revertErr.message },
          );
          return NextResponse.json(
            {
              error:
                "El guardado no se completó y el registro quedó en estado inconsistente. Requiere intervención manual.",
            },
            { status: 500 },
          );
        }

        return NextResponse.json(
          { error: "El guardado no se completó. Revise el registro." },
          { status: 500 },
        );
      }
    }

    // Auditoría (no aborta el éxito si falla).
    const flags = {
      swap: swap_archivos === true,
      boletaReemplazada: resultado.boletaReemplazada,
      voucherReemplazada: resultado.voucherReemplazada,
    };
    const reg = construirAuditoria(input, flags, {
      id: admin.id,
      // verifyAdmin garantiza un email no vacío e igual a ADMIN_EMAIL.
      email: admin.email ?? ADMIN_EMAIL,
    });
    const { error: auditErr } = await supabaseAdmin
      .from("historial_auditoria")
      .insert(reg);
    if (auditErr) {
      console.error("[update-pago-completo] Fallo al registrar auditoría", {
        installment_id: estado.installmentId,
        auditErr: auditErr.message,
      });
    }

    return NextResponse.json({
      success: true,
      message: "Pago actualizado.",
      swap: flags.swap,
      boleta_reemplazada: flags.boletaReemplazada,
      voucher_reemplazado: flags.voucherReemplazada,
    });
  }

  return NextResponse.json({ error: "Acción no reconocida" }, { status: 400 });
}
