// Feature: gestion-ciclos-secciones
// Modelo de referencia PURO del plan de pagos.
//
// Este módulo replica EXACTAMENTE la lógica de fechas, montos y estados de
// `generateStudentPaymentPlan` en `src/lib/payment-service.ts`, pero SIN acceso
// a la base de datos. Sirve como oráculo determinista para los property-based
// tests de la promoción grupal (Propiedades 6, 7 y 8).
//
// Cualquier cambio en la lógica de `payment-service.ts` (montos por defecto,
// regla de corte del día 16, secuencia de fechas o exoneración por monto cero)
// debe reflejarse aquí para que los tests sigan siendo un espejo fiel.
// Requisitos: 7.2, 7.3, 7.4, 7.5

/** Montos por defecto del sistema cuando la alumna no tiene beneficio activo. */
export const DEFAULT_MATRICULA = 250.0;
export const DEFAULT_CUOTA = 400.0;

/** Configuración de beneficios activos aplicables a la alumna. */
export interface BenefitConfig {
  /** `monto_final` del beneficio activo de matrícula, si existe. */
  matricula?: number;
  /** `monto_final` del beneficio activo de cuota, si existe. */
  cuota?: number;
}

/** Forma de una cuota generada por el modelo de referencia. */
export interface PlanItem {
  tipo: "matricula" | "cuota";
  /** 0 para matrícula, 1..4 para cuotas. */
  numero: number;
  concepto: string;
  amount_original: number;
  /** Monto efectivo tras aplicar el beneficio (o el default). */
  amount: number;
  /** Fecha de vencimiento en formato `YYYY-MM-DD`. */
  due_date: string;
  status: "pending" | "exonerado";
  /** Fecha del proceso cuando la cuota queda exonerada; `null` en otro caso. */
  fecha_pago: string | null;
}

/**
 * Primer día de un mes dado en formato `YYYY-MM-DD`.
 * `month` es 0-indexed (0 = Enero, 11 = Diciembre) y admite desbordes (>= 12),
 * que se normalizan avanzando el año — igual que en `payment-service.ts`.
 */
export function getFirstDayOfMonth(year: number, month: number): string {
  const realMonth = month % 12;
  const realYear = year + Math.floor(month / 12);
  return `${realYear}-${String(realMonth + 1).padStart(2, "0")}-01`;
}

/**
 * Genera los 5 items del plan de pagos (matrícula + cuotas 01-04) a partir de
 * una `start_date` (`YYYY-MM-DD`) y la configuración de beneficios activos.
 *
 * Replica la lógica de `generateStudentPaymentPlan` para el caso en que existe
 * una apertura activa con `start_date` (rama `opening?.start_date`).
 *
 * @param startDate Fecha de inicio de la nueva sección (`YYYY-MM-DD`).
 * @param benefits Beneficios activos aplicables (matrícula/cuota).
 * @param ahora Fecha del proceso usada como `fecha_pago` de las cuotas exoneradas.
 */
export function generarPlanModel(
  startDate: string,
  benefits: BenefitConfig = {},
  ahora: string = new Date().toISOString()
): PlanItem[] {
  const d = new Date(startDate + "T00:00:00");
  let startMonthIndex = d.getMonth();
  let startYear = d.getFullYear();

  // Regla de corte de fin de mes: si el ciclo inicia el día 16 o después,
  // el primer pago (matrícula + cuota 01) corre al mes siguiente.
  const startDay = d.getDate();
  if (startDay >= 16) {
    startMonthIndex += 1;
    if (startMonthIndex > 11) {
      startMonthIndex = 0;
      startYear += 1;
    }
  }

  const montoMatricula =
    benefits.matricula !== undefined ? Number(benefits.matricula) : DEFAULT_MATRICULA;
  const montoCuota =
    benefits.cuota !== undefined ? Number(benefits.cuota) : DEFAULT_CUOTA;

  const items: PlanItem[] = [];

  // Matrícula — día 01 del mes de inicio. Si monto = 0 → exonerado.
  items.push({
    tipo: "matricula",
    numero: 0,
    concepto: "MATRÍCULA",
    amount_original: 250.0,
    amount: montoMatricula,
    due_date: getFirstDayOfMonth(startYear, startMonthIndex),
    status: montoMatricula === 0 ? "exonerado" : "pending",
    fecha_pago: montoMatricula === 0 ? ahora : null,
  });

  // Cuotas 01..04 — día 01 de meses consecutivos (cuota 01 = mes de inicio).
  for (let i = 0; i < 4; i++) {
    const monthIndex = startMonthIndex + i;
    const addYears = Math.floor(monthIndex / 12);
    const realMonthIndex = monthIndex % 12;
    const dueYear = startYear + addYears;

    const numero = i + 1;
    items.push({
      tipo: "cuota",
      numero,
      concepto: `CUOTAS ${String(numero).padStart(2, "0")}`,
      amount_original: 400.0,
      amount: montoCuota,
      due_date: getFirstDayOfMonth(dueYear, realMonthIndex),
      status: montoCuota === 0 ? "exonerado" : "pending",
      fecha_pago: montoCuota === 0 ? ahora : null,
    });
  }

  return items;
}
