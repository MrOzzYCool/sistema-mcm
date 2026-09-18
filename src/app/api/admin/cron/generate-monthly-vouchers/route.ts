import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

// Códigos de producto Nubefact por concepto (igualdad exacta)
const NUBEFACT_CODES: Record<string, number> = {
  "MATRÍCULA": 16, "CUOTAS 01": 39, "CUOTAS 02": 40, "CUOTAS 03": 41, "CUOTAS 04": 42,
};

/**
 * Resuelve el código de producto Nubefact para un concepto.
 * Los conceptos de examen incluyen el nombre del curso (ej. "EXAMEN SUSTITUTORIO - MATEMATICA"),
 * por lo que se resuelven por prefijo. Para el resto se usa la igualdad exacta y el fallback 16.
 */
function resolverCodigoNubefact(concepto: string | null | undefined): number {
  const c = (concepto ?? "").trim();
  if (c.startsWith("EXAMEN SUSTITUTORIO")) return 5;
  if (c.startsWith("EXAMEN DE RECUPERACIÓN")) return 29;
  if (c.startsWith("EXAMEN EXTRAORDINARIO")) return 30;
  return NUBEFACT_CODES[c] ?? 16;
}

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

    // Guarda: solo facturar el ÚLTIMO DÍA DEL MES.
    // El cron corre a diario (23:50), así que salimos temprano si hoy no es el
    // último día. Se permite un bypass manual para pruebas con ?force=true.
    const today = now.getDate();
    const force = req.nextUrl.searchParams.get("force") === "true";
    const dryRun = req.nextUrl.searchParams.get("dry_run") === "true";

    // dry_run también permite continuar cualquier día (para poder simular),
    // igual que force, pero sin emitir comprobantes ni tocar la BD.
    if (today !== lastDay && !force && !dryRun) {
      console.log(`[CRON] Hoy (${today}) no es el último día del mes (${lastDay}). Saltando generación.`);
      return NextResponse.json({
        success: true,
        skipped_reason: "No es el último día del mes",
        today,
        lastDay,
        generated: 0,
      });
    }

    console.log(`[CRON] Generando boletas para cuotas pendientes del ${firstDay} al ${lastDayStr}`);

    // 3. Buscar cuotas pendientes del mes que NO tengan boleta pregenerada
    const { data: installments, error: queryError } = await supabaseAdmin
      .from("installments")
      .select(`
        id, concepto, amount, amount_original, due_date, plan_id,
        comprobante_serie, comprobante_numero,
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
      .select("id, nombre_completo, dni, estado")
      .in("id", alumnoIds);

    // Filtrar: solo alumnos activos participan en facturación.
    // La columna real es `estado` ('activo' | 'inactivo'). Se considera inactivo
    // únicamente si estado === 'inactivo'; cualquier otro valor cuenta como activo.
    const activeProfiles = (profiles ?? []).filter(p => p.estado !== "inactivo");
    const inactiveIds = new Set(
      (profiles ?? []).filter(p => p.estado === "inactivo").map(p => p.id)
    );

    if (inactiveIds.size > 0) {
      console.log(`[CRON] Excluyendo ${inactiveIds.size} alumnos inactivos de la facturación`);
    }

    const profileMap = new Map(
      activeProfiles.map((p) => [p.id, { nombre: p.nombre_completo ?? "", dni: p.dni ?? "" }])
    );

    // 5. Los códigos de producto Nubefact se resuelven con resolverCodigoNubefact (module scope)

    // 6. Modo simulación (dry_run): aplicar TODOS los filtros pero sin emitir ni tocar la BD.
    if (dryRun) {
      const aFacturar: { concepto: string; nombre: string; amount: number; codigo_nubefact: number }[] = [];
      const omitidas: { concepto: string; nombre: string; razon: string }[] = [];

      for (const inst of installments) {
        const plan = inst.payment_plans as unknown as { alumno_id?: string } | null;
        const alumnoId = plan?.alumno_id ?? "";
        const alumnoData = profileMap.get(alumnoId);
        const concepto = inst.concepto ?? "";
        const nombre = alumnoData?.nombre ?? "";

        // Alumno inactivo o sin datos
        if (!alumnoData || !alumnoData.dni) {
          if (inactiveIds.has(alumnoId)) {
            omitidas.push({ concepto, nombre, razon: "Alumno inactivo/retirado" });
            continue;
          }
          omitidas.push({ concepto, nombre, razon: "Sin DNI" });
          continue;
        }

        // Protección anti-duplicado: ya tiene comprobante emitido
        if (
          (inst.comprobante_serie != null && String(inst.comprobante_serie).trim() !== "") ||
          (inst.comprobante_numero != null && String(inst.comprobante_numero).trim() !== "")
        ) {
          omitidas.push({ concepto, nombre, razon: "Ya tiene comprobante" });
          continue;
        }

        const amount = Number(inst.amount ?? 0);
        if (amount <= 0) {
          omitidas.push({ concepto, nombre, razon: "Monto 0" });
          continue;
        }

        aFacturar.push({
          concepto,
          nombre,
          amount,
          codigo_nubefact: resolverCodigoNubefact(inst.concepto),
        });
      }

      console.log(`[CRON][DRY_RUN] ${aFacturar.length} cuotas a facturar, ${omitidas.length} omitidas`);

      return NextResponse.json({
        success: true,
        dry_run: true,
        a_facturar: aFacturar,
        omitidas,
        total_a_facturar: aFacturar.length,
      });
    }

    // 7. Generar boletas una por una
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

      // Protección anti-duplicado: si la cuota ya tiene comprobante emitido,
      // no re-emitir (salvaguarda por si se registró manualmente sin marcar
      // boleta_pregenerada).
      if (
        (inst.comprobante_serie != null && String(inst.comprobante_serie).trim() !== "") ||
        (inst.comprobante_numero != null && String(inst.comprobante_numero).trim() !== "")
      ) {
        console.warn(`[CRON] Cuota ${inst.id} ya tiene comprobante, saltando para evitar duplicado`);
        results.push({ id: inst.id, concepto: inst.concepto, status: "skipped", error: "Ya tiene comprobante" });
        continue;
      }

      const amount = Number(inst.amount ?? 0);
      if (amount <= 0) {
        results.push({ id: inst.id, concepto: inst.concepto, status: "skipped", error: "Monto 0" });
        continue;
      }

      try {
        const amountOriginal = Number(inst.amount_original ?? amount);
        const descuento = amountOriginal > amount ? Math.round((amountOriginal - amount) * 100) / 100 : 0;

        const resultado = await generarBoleta({
          tipoComprobante: "boleta",
          dniCliente: alumnoData.dni,
          nombreCliente: alumnoData.nombre,
          cantidad: 1,
          codigoProducto: resolverCodigoNubefact(inst.concepto),
          descripcion: inst.concepto ?? "PAGO ACADÉMICO",
          precioUnitario: amountOriginal,
          tipoIgv: 9, // Inafecto - Operación Onerosa (mismo que el flujo manual)
          ...(descuento > 0 && { descuento }),
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
