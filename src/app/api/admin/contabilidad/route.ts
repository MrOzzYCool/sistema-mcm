import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

/** Convierte un timestamp UTC a fecha en zona horaria Lima (UTC-5) formato YYYY-MM-DD */
function toFechaLima(isoString: string | null | undefined): string | null {
  if (!isoString) return null;
  const date = new Date(isoString);
  if (isNaN(date.getTime())) return null;
  return date.toLocaleDateString("en-CA", { timeZone: "America/Lima" }); // en-CA da formato YYYY-MM-DD
}

/**
 * GET /api/admin/contabilidad?month=2026-07&banco=BCP
 *
 * Retorna todos los ingresos del mes indicado, combinando:
 * 1. Cuotas académicas (installments con status=paid)
 * 2. Actualizaciones (solicitudes tipo_formulario=actualizacion, estado=aprobado)
 * 3. Trámites externos (solicitudes tipo_formulario=tramite, estado=aprobado)
 *
 * Query params:
 * - month (required): formato YYYY-MM
 * - banco (optional): filtra por banco detectado por OCR (ej: "BCP", "Yape", "Interbank")
 *
 * Cada registro incluye campos OCR: banco, operation_number, ocr_status
 */

const ALLOWED_EMAILS = [
  "admin@margaritacabrera.edu.pe",
  "contabilidad@margaritacabrera.edu.pe",
];

async function verifyContabilidadAccess(req: NextRequest) {
  const token = (req.headers.get("authorization") ?? "").replace("Bearer ", "");
  if (!token) return null;
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user?.email) return null;
  const email = user.email.toLowerCase();
  if (ALLOWED_EMAILS.includes(email)) return user;
  // Fallback: check profile role
  const { data: profile } = await supabaseAdmin
    .from("profiles").select("rol").eq("id", user.id).single();
  if (profile?.rol === "super_admin" || profile?.rol === "contabilidad") return user;
  return null;
}

export async function GET(req: NextRequest) {
  const user = await verifyContabilidadAccess(req);
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const monthParam = req.nextUrl.searchParams.get("month"); // formato: 2026-07
  if (!monthParam || !/^\d{4}-\d{2}$/.test(monthParam)) {
    return NextResponse.json({ error: "Parámetro 'month' requerido (formato: YYYY-MM)" }, { status: 400 });
  }

  const bancoParam = req.nextUrl.searchParams.get("banco"); // filtro por banco (opcional)

  const [yearStr, monthStr] = monthParam.split("-");
  const year = Number(yearStr);
  const month = Number(monthStr);
  const lastDay = new Date(year, month, 0).getDate();
  const from = `${monthParam}-01T00:00:00`;
  const to = `${monthParam}-${String(lastDay).padStart(2, "0")}T23:59:59`;

  // Para cuotas: filtrar por fecha_pago en zona horaria Lima (UTC-5)
  // El mes en Lima empieza a las 05:00 UTC del día 1, y termina a las 04:59:59 UTC del día 1 del siguiente mes
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonthFrom = `${nextYear}-${String(nextMonth).padStart(2, "0")}-01T05:00:00`;

  try {
    // ── 1. Cuotas académicas pagadas ──────────────────────────────────────────
    // Filtrar por fecha_pago (fecha real de ingreso del dinero), NO por due_date.
    // Contabilidad corta por mes según cuándo se recibió el pago.
    // Usar zona horaria Lima (UTC-5) para el filtro, ya que los timestamps se guardan en UTC.
    const { data: cuotas } = await supabaseAdmin
      .from("installments")
      .select(`
        id, amount, due_date, fecha_pago, concepto, status,
        comprobante_url, comprobante_serie, comprobante_numero, tipo_comprobante,
        plan_id, payment_plans!inner(alumno_id)
      `)
      .eq("status", "paid")
      .gte("fecha_pago", `${monthParam}-01T05:00:00`)
      .lt("fecha_pago", nextMonthFrom)
      .order("fecha_pago", { ascending: false });

    // Resolver nombres de alumnos
    const alumnoIds = [...new Set(
      (cuotas ?? []).map((c) => {
        const plan = c.payment_plans as unknown as { alumno_id?: string } | null;
        return plan?.alumno_id;
      }).filter(Boolean)
    )] as string[];

    let alumnoMap: Record<string, string> = {};
    if (alumnoIds.length > 0) {
      const { data: profiles } = await supabaseAdmin
        .from("profiles").select("id, nombre_completo").in("id", alumnoIds);
      for (const p of profiles ?? []) {
        alumnoMap[p.id] = p.nombre_completo ?? "—";
      }
    }

    // Resolver vouchers de alumnos para cada cuota (incluye campos OCR)
    const cuotaIds = (cuotas ?? []).map(c => c.id);
    let voucherMap: Record<string, { voucher_url: string; banco: string | null; operation_number: string | null; ocr_status: string | null }> = {};
    if (cuotaIds.length > 0) {
      const { data: vouchers } = await supabaseAdmin
        .from("payment_vouchers")
        .select("installment_id, voucher_url, banco, operation_number, ocr_status, status")
        .in("installment_id", cuotaIds)
        .in("status", ["approved", "pending_review"])
        .order("created_at", { ascending: false });
      for (const v of vouchers ?? []) {
        // Priorizar voucher approved sobre pending_review para el mismo installment
        if (!voucherMap[v.installment_id] || v.status === "approved") {
          voucherMap[v.installment_id] = {
            voucher_url: v.voucher_url ?? "",
            banco: v.banco ?? null,
            operation_number: v.operation_number ?? null,
            ocr_status: v.ocr_status ?? null,
          };
        }
      }
    }

    const ingresosCuotas = (cuotas ?? []).map((c) => {
      const plan = c.payment_plans as unknown as { alumno_id?: string } | null;
      const alumnoId = plan?.alumno_id ?? "";
      const voucherData = voucherMap[c.id] ?? null;
      return {
        id: c.id,
        tipo: "cuota_academica" as const,
        nombre: alumnoMap[alumnoId] ?? "—",
        concepto: c.concepto ?? "Cuota",
        monto: Number(c.amount ?? 0),
        fecha: toFechaLima(c.fecha_pago as string) ?? (c.due_date as string)?.slice(0, 10) ?? "—",
        voucher_url: voucherData?.voucher_url ?? null,
        banco: voucherData?.banco ?? null,
        operation_number: voucherData?.operation_number ?? null,
        ocr_status: voucherData?.ocr_status ?? null,
        comprobante_url: c.comprobante_url ?? null,
        comprobante_tipo: c.tipo_comprobante ?? "boleta",
        comprobante_serie: c.comprobante_serie ?? null,
        comprobante_numero: c.comprobante_numero ?? null,
      };
    });

    // ── 2. Actualizaciones aprobadas ──────────────────────────────────────────
    const { data: actualizaciones } = await supabaseAdmin
      .from("solicitudes")
      .select("*")
      .eq("tipo_formulario", "actualizacion")
      .eq("estado", "aprobado")
      .gte("created_at", from)
      .lte("created_at", to)
      .order("created_at", { ascending: false });

    const ingresosActualizaciones = (actualizaciones ?? []).map((s) => ({
      id: s.id,
      tipo: "actualizacion" as const,
      nombre: `${s.nombres ?? ""} ${s.apellidos ?? ""}`.trim(),
      concepto: s.tipo_tramite ?? "Actualización",
      monto: Number(s.monto_pagado ?? 0),
      fecha: (s.created_at as string)?.slice(0, 10) ?? "—",
      voucher_url: (s.voucher_url && s.voucher_url !== "registro-manual") ? s.voucher_url : null,
      banco: null as string | null,
      operation_number: null as string | null,
      ocr_status: null as string | null,
      comprobante_url: s.pdf_boleta_url ?? null,
      comprobante_tipo: s.tipo_comprobante ?? "boleta",
      comprobante_serie: null,
      comprobante_numero: null,
    }));

    // ── 3. Trámites externos aprobados ────────────────────────────────────────
    const { data: tramites } = await supabaseAdmin
      .from("solicitudes")
      .select("*")
      .eq("tipo_formulario", "tramite")
      .eq("estado", "aprobado")
      .gte("created_at", from)
      .lte("created_at", to)
      .order("created_at", { ascending: false });

    const ingresosTramites = (tramites ?? []).map((s) => ({
      id: s.id,
      tipo: "tramite" as const,
      nombre: `${s.nombres ?? ""} ${s.apellidos ?? ""}`.trim(),
      concepto: s.tipo_tramite ?? "Trámite",
      monto: Number(s.monto_pagado ?? 0),
      fecha: (s.created_at as string)?.slice(0, 10) ?? "—",
      voucher_url: (s.voucher_url && s.voucher_url !== "registro-manual") ? s.voucher_url : null,
      banco: null as string | null,
      operation_number: null as string | null,
      ocr_status: null as string | null,
      comprobante_url: s.pdf_boleta_url ?? null,
      comprobante_tipo: s.tipo_comprobante ?? "boleta",
      comprobante_serie: null,
      comprobante_numero: null,
    }));

    // ── 4. Combinar y calcular resumen ────────────────────────────────────────
    let todos = [...ingresosCuotas, ...ingresosActualizaciones, ...ingresosTramites];

    // Aplicar filtro por banco si se proporciona el parámetro
    if (bancoParam) {
      todos = todos.filter((i) => i.banco === bancoParam);
    }

    const resumen = {
      total: todos.reduce((acc, i) => acc + i.monto, 0),
      cuotas: ingresosCuotas.reduce((acc, i) => acc + i.monto, 0),
      actualizaciones: ingresosActualizaciones.reduce((acc, i) => acc + i.monto, 0),
      tramites: ingresosTramites.reduce((acc, i) => acc + i.monto, 0),
      cantidad_boletas: todos.filter(i => i.comprobante_tipo === "boleta" && i.comprobante_url).length,
      cantidad_facturas: todos.filter(i => i.comprobante_tipo === "factura" && i.comprobante_url).length,
      total_registros: todos.length,
    };

    return NextResponse.json({ ingresos: todos, resumen });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[CONTABILIDAD]", msg);
    return NextResponse.json({ error: "Error interno", detail: msg }, { status: 500 });
  }
}
