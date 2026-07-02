import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

/**
 * POST /api/admin/cron/generate-monthly-vouchers
 *
 * Genera boletas en Nubefact para todas las cuotas pendientes del mes actual.
 * La cuota sigue como 'pending' — solo se guarda el comprobante y se marca
 * boleta_pregenerada = true. El alumno NO ve la boleta hasta que el admin
 * apruebe su voucher.
 *
 * Seguridad: Protegido por CRON_API_KEY en header x-api-key.
 * Llamado desde Supabase cron el último día de cada mes.
 */
export async function POST(req: NextRequest) {
  // 1. Verificar API key
  const apiKey = req.headers.get("x-api-key") ?? req.nextUrl.searchParams.get("api_key");
  const expectedKey = process.env.CRON_API_KEY;

  if (!expectedKey || apiKey !== expectedKey) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    // 2. Determinar rango del mes actual
    const now = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Lima" }));
    const year = now.getFullYear();
    const month = now.getMonth(); // 0-indexed
    const firstDay = `${year}-${String(month + 1).padStart(2, "0")}-01`;
    const lastDay = new Date(year, month + 1, 0).getDate();
    const lastDayStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

    console.log(`[CRON] Generando boletas para cuotas pendientes del ${firstDay} al ${lastDayStr}`);

    // 3. Buscar cuotas pendientes del mes que NO tengan boleta pregenerada
    const { data: installments, error: queryError } = await supabaseAdmin
      .from("installments")
      .select(`
        id, concepto, amount, due_date, plan_id,
        payment_plans!inner(alumno_id)
      `)
      .gte("due_date", `${firstDay}T00:00:00`)
      .lte("due_date", `${lastDayStr}T23:59:59`)
      .eq("status", "pending")
      .or("boleta_pregenerada.is.null,boleta_pregenerada.eq.false");

    if (queryError) {
      console.error("[CRON] Error querying installments:", queryError.message);
      return NextResponse.json(
        { error: "Error al consultar cuotas", detail: queryError.message },
        { status: 500 }
      );
    }

    if (!installments || installments.length === 0) {
      console.log("[CRON] No hay cuotas pendientes para generar boletas");
      return NextResponse.json({ success: true, message: "No hay cuotas pendientes", generated: 0 });
    }

    console.log(`[CRON] Encontradas ${installments.length} cuotas pendientes`);

    // 4. Obtener datos de alumnos (DNI + nombre) — solo alumnos ACTIVOS
    const alumnoIds = [...new Set(
      installments.map((inst) => {
        const plan = inst.payment_plans as unknown as { alumno_id?: string } | null;
        return plan?.alumno_id;
      }).filter(Boolean)
    )] as string[];

    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id, nombre_completo, dni, is_active")
      .in("id", alumnoIds);

    // Filtrar: solo alumnos activos participan en facturación
    const activeProfiles = (profiles ?? []).filter(p => p.is_active !== false);
    const inactiveIds = new Set(
      (profiles ?? []).filter(p => p.is_active === false).map(p => p.id)
    );

    if (inactiveIds.size > 0) {
      console.log(`[CRON] Excluyendo ${inactiveIds.size} alumnos inactivos de la facturación`);
    }

    const profileMap = new Map(
      activeProfiles.map((p) => [p.id, { nombre: p.nombre_completo ?? "", dni: p.dni ?? "" }])
    );

    // 5. Códigos de producto Nubefact
    const NUBEFACT_CODES: Record<string, number> = {
      "MATRÍCULA": 16, "CUOTAS 01": 39, "CUOTAS 02": 40, "CUOTAS 03": 41, "CUOTAS 04": 42,
    };

    // 6. Generar boletas una por una
    const { generarBoleta } = await import("@/lib/nubefactService");

    let generated = 0;
    let errors = 0;
    const results: { id: string; concepto: string; status: string; error?: string }[] = [];

    for (const inst of installments) {
      const plan = inst.payment_plans as unknown as { alumno_id?: string } | null;
      const alumnoId = plan?.alumno_id ?? "";
      const alumnoData = profileMap.get(alumnoId);

      if (!alumnoData || !alumnoData.dni) {
        // Si el alumno está inactivo, saltamos sin warning
        if (inactiveIds.has(alumnoId)) {
          results.push({ id: inst.id, concepto: inst.concepto, status: "skipped", error: "Alumno inactivo/retirado" });
          continue;
        }
        console.warn(`[CRON] Alumno ${alumnoId} sin DNI, saltando cuota ${inst.id}`);
        results.push({ id: inst.id, concepto: inst.concepto, status: "skipped", error: "Sin DNI" });
        continue;
      }

      const amount = Number(inst.amount ?? 0);
      if (amount <= 0) {
        results.push({ id: inst.id, concepto: inst.concepto, status: "skipped", error: "Monto 0" });
        continue;
      }

      try {
        const resultado = await generarBoleta({
          tipoComprobante: "boleta",
          dniCliente: alumnoData.dni,
          nombreCliente: alumnoData.nombre,
          cantidad: 1,
          codigoProducto: NUBEFACT_CODES[inst.concepto] ?? 16,
          descripcion: inst.concepto ?? "PAGO ACADÉMICO",
          precioUnitario: amount,
          tipoIgv: 9, // Inafecto - Operación Onerosa (mismo que el flujo manual)
          codigoUnico: `CRON-${inst.id}-${Date.now()}`,
        });

        // Guardar comprobante en la cuota SIN cambiar el status
        await supabaseAdmin
          .from("installments")
          .update({
            comprobante_url: resultado.pdfUrl,
            comprobante_serie: resultado.serie,
            comprobante_numero: String(resultado.numero),
            tipo_comprobante: "boleta",
            boleta_pregenerada: true,
            // NO cambiar status — sigue como 'pending'
          })
          .eq("id", inst.id);

        generated++;
        results.push({ id: inst.id, concepto: inst.concepto, status: "generated" });
        console.log(`[CRON] ✅ Boleta generada: ${resultado.serie}-${resultado.numero} para ${alumnoData.nombre} (${inst.concepto})`);
      } catch (err) {
        errors++;
        const msg = err instanceof Error ? err.message : "Error desconocido";
        results.push({ id: inst.id, concepto: inst.concepto, status: "error", error: msg });
        console.error(`[CRON] ❌ Error generando boleta para cuota ${inst.id}:`, msg);
      }
    }

    console.log(`[CRON] Resultado: ${generated} generadas, ${errors} errores, ${installments.length - generated - errors} saltadas`);

    return NextResponse.json({
      success: true,
      message: `Boletas generadas: ${generated}/${installments.length}`,
      generated,
      errors,
      skipped: installments.length - generated - errors,
      details: results,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[CRON] Error inesperado:", msg);
    return NextResponse.json({ error: "Error interno", detail: msg }, { status: 500 });
  }
}

// Only POST allowed
export function GET() {
  return NextResponse.json({ error: "Use POST" }, { status: 405 });
}
