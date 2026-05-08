import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { supabase } from "@/lib/supabase";

const ALLOWED_ROLES = ["super_admin", "administradora", "secretaria_academica"];

async function verifyStaff(req: NextRequest) {
  const token = (req.headers.get("authorization") ?? "").replace("Bearer ", "");
  if (!token) return null;
  const { data: { user } } = await supabase.auth.getUser(token);
  if (!user) return null;
  if (user.email?.toLowerCase() === "admin@margaritacabrera.edu.pe") return user;
  const { data: profile } = await supabaseAdmin.from("profiles").select("rol").eq("id", user.id).single();
  if (!profile || !ALLOWED_ROLES.includes(profile.rol)) return null;
  return user;
}

/**
 * GET /api/admin/voucher-review — list pending vouchers
 */
export async function GET(req: NextRequest) {
  const admin = await verifyStaff(req);
  if (!admin) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const status = req.nextUrl.searchParams.get("status") ?? "pending_review";

  let query = supabaseAdmin
    .from("payment_vouchers")
    .select("*, profiles!alumno_id(nombre_completo), installments(concepto, amount, due_date, comprobante_url, comprobante_serie, comprobante_numero, plan_id, payment_plans(ciclo, year))")
    .order("created_at", { ascending: false });

  if (status !== "all") {
    query = query.eq("status", status);
  }

  const { data } = await query;
  return NextResponse.json({ vouchers: data ?? [] });
}

/**
 * POST /api/admin/voucher-review
 * Body: { voucher_id, action: "approve" | "reject", reason? }
 */
export async function POST(req: NextRequest) {
  const admin = await verifyStaff(req);
  if (!admin) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const { voucher_id, action, reason, tipo_comprobante, ruc } = await req.json();
  if (!voucher_id || !action) {
    return NextResponse.json({ error: "voucher_id y action requeridos" }, { status: 400 });
  }

  const { data: voucher } = await supabaseAdmin
    .from("payment_vouchers")
    .select("id, installment_id, alumno_id, status, tipo_comprobante, ruc_factura, razon_social, direccion_fiscal, email_empresa")
    .eq("id", voucher_id)
    .single();

  if (!voucher) return NextResponse.json({ error: "Voucher no encontrado" }, { status: 404 });

  // For approve/reject, voucher must be pending. For restore, it must be approved/rejected.
  if ((action === "approve" || action === "reject") && voucher.status !== "pending_review") {
    return NextResponse.json({ error: "Este voucher ya fue procesado" }, { status: 400 });
  }
  if (action === "restore" && voucher.status === "pending_review") {
    return NextResponse.json({ error: "Este voucher ya está pendiente" }, { status: 400 });
  }

  if (action === "approve") {
    // Use comprobante type from voucher (alumno's choice) or admin override
    const finalTipoComprobante = tipo_comprobante || voucher.tipo_comprobante || "boleta";
    const finalRuc = ruc || voucher.ruc_factura || "";

    if (!["boleta", "factura"].includes(finalTipoComprobante)) {
      return NextResponse.json({ error: "tipo_comprobante requerido (boleta o factura)" }, { status: 400 });
    }
    if (finalTipoComprobante === "factura" && finalRuc.length !== 11) {
      return NextResponse.json({ error: "RUC de 11 dígitos requerido para factura" }, { status: 400 });
    }

    // Get installment details
    const { data: inst } = await supabaseAdmin
      .from("installments")
      .select("id, concepto, amount, numero, plan_id")
      .eq("id", voucher.installment_id)
      .single();

    // Get alumno profile
    const { data: alumno } = await supabaseAdmin
      .from("profiles")
      .select("nombre_completo, dni")
      .eq("id", voucher.alumno_id)
      .single();

    // Get alumno email
    const { data: { user: alumnoAuth } } = await supabaseAdmin.auth.admin.getUserById(voucher.alumno_id);
    const alumnoEmail = alumnoAuth?.email ?? "";

    // Nubefact codes by concepto
    const NUBEFACT_CODES: Record<string, number> = {
      "MATRÍCULA": 16, "CUOTAS 01": 39, "CUOTAS 02": 40, "CUOTAS 03": 41, "CUOTAS 04": 42,
    };
    const codigoProducto = NUBEFACT_CODES[inst?.concepto ?? ""] ?? 16;

    // Generate comprobante via Nubefact
    let comprobanteUrl = "";
    let comprobanteSerie = "";
    let comprobanteNumero = "";

    try {
      const { generarBoleta } = await import("@/lib/nubefactService");
      const resultado = await generarBoleta({
        tipoComprobante: finalTipoComprobante as "boleta" | "factura",
        dniCliente: finalTipoComprobante === "boleta" ? (alumno?.dni ?? "") : "",
        ruc: finalTipoComprobante === "factura" ? finalRuc : undefined,
        razonSocial: finalTipoComprobante === "factura" ? (voucher.razon_social ?? alumno?.nombre_completo ?? "") : undefined,
        direccionFiscal: finalTipoComprobante === "factura" ? (voucher.direccion_fiscal ?? "") : undefined,
        nombreCliente: finalTipoComprobante === "boleta" ? (alumno?.nombre_completo ?? "") : (voucher.razon_social ?? ""),
        cantidad: 1,
        codigoProducto,
        descripcion: inst?.concepto ?? "PAGO ACADÉMICO",
        precioUnitario: Number(inst?.amount ?? 0),
        tipoIgv: 9, // Inafecto - Operación Onerosa
        codigoUnico: Date.now().toString(),
      });

      comprobanteUrl = resultado.pdfUrl ?? "";
      comprobanteSerie = resultado.serie ?? "";
      comprobanteNumero = resultado.numero?.toString() ?? "";
    } catch (nubErr) {
      console.error("Error Nubefact:", nubErr);
      return NextResponse.json({
        error: `Error al emitir comprobante en Nubefact: ${nubErr instanceof Error ? nubErr.message : "Error desconocido"}. El voucher NO fue aprobado.`,
      }, { status: 500 });
    }

    // Only update AFTER Nubefact succeeds
    // Update voucher to approved
    await supabaseAdmin.from("payment_vouchers").update({
      status: "approved", reviewed_by: admin.id, reviewed_at: new Date().toISOString(),
    }).eq("id", voucher_id);

    // Update installment to paid + comprobante info
    await supabaseAdmin.from("installments").update({
      status: "paid",
      fecha_pago: new Date().toISOString(),
      tipo_comprobante: finalTipoComprobante,
      comprobante_serie: comprobanteSerie || null,
      comprobante_numero: comprobanteNumero || null,
      comprobante_url: comprobanteUrl || null,
    }).eq("id", voucher.installment_id);

    return NextResponse.json({
      success: true,
      message: `Comprobante emitido: ${comprobanteSerie}-${comprobanteNumero}`,
      comprobante_url: comprobanteUrl,
    });
  }

  if (action === "reject") {
    await supabaseAdmin.from("payment_vouchers").update({
      status: "rejected", reviewed_by: admin.id, reviewed_at: new Date().toISOString(),
      rejection_reason: reason ?? "Voucher no válido",
    }).eq("id", voucher_id);

    await supabaseAdmin.from("installments").update({ status: "pending" }).eq("id", voucher.installment_id);

    return NextResponse.json({ success: true, message: "Voucher rechazado. Cuota vuelve a pendiente." });
  }

  if (action === "restore") {
    // Restore voucher to pending_review
    await supabaseAdmin.from("payment_vouchers").update({
      status: "pending_review", reviewed_by: null, reviewed_at: null, rejection_reason: null,
    }).eq("id", voucher_id);

    // Revert installment: clear comprobante fields, set status back to in_review
    await supabaseAdmin.from("installments").update({
      status: "in_review",
      fecha_pago: null,
      tipo_comprobante: null,
      comprobante_serie: null,
      comprobante_numero: null,
      comprobante_url: null,
    }).eq("id", voucher.installment_id);

    return NextResponse.json({ success: true, message: "Voucher restablecido a pendiente." });
  }

  return NextResponse.json({ error: "Acción no válida" }, { status: 400 });
}
