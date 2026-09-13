// Feature: gestion-ciclos-secciones
// Property-based tests (fast-check) para la lógica pura de promoción grupal.
//
// Cubre:
//  - Property 5 (task 6.2): decisión de promoción vs. egreso        (Req 6.3, 6.4, 9.1, 9.2)
//  - Property 6 (task 6.3): continuidad de montos y beneficios       (Req 7.2, 7.3)
//  - Property 7 (task 6.4): fechas de vencimiento del plan           (Req 7.4)
//  - Property 8 (task 6.5): exoneración con monto cero               (Req 7.5)
//
// La lógica de fechas/montos/estados se valida contra un modelo de referencia
// puro (`plan-model.ts`) que replica `src/lib/payment-service.ts` sin tocar BD.

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";

import { decidirPromocion, nuevoCiclo } from "../promocion-grupal";
import {
  generarPlanModel,
  DEFAULT_MATRICULA,
  DEFAULT_CUOTA,
  type BenefitConfig,
} from "../plan-model";

const NUM_RUNS = 100;

/** Formatea (año, mes 1-based, día) como `YYYY-MM-DD`. */
function fmtDate(year: number, month1: number, day: number): string {
  return `${year}-${String(month1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

describe("Promoción grupal — property based tests", () => {
  // ---------------------------------------------------------------------------
  // Feature: gestion-ciclos-secciones, Property 5
  // Decisión de promoción vs. egreso (Req 6.3, 6.4, 9.1, 9.2)
  // ---------------------------------------------------------------------------
  it("Property 5: promueve (+1) si ciclo < duración; egresa (sin avanzar) si ciclo >= duración", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 12 }),
        fc.integer({ min: 1, max: 12 }),
        (cicloActual, duracionCiclos) => {
          const decision = decidirPromocion(cicloActual, duracionCiclos);
          const siguiente = nuevoCiclo(cicloActual, duracionCiclos);

          if (cicloActual < duracionCiclos) {
            expect(decision).toBe("promover");
            expect(siguiente).toBe(cicloActual + 1);
          } else {
            expect(decision).toBe("egreso");
            expect(siguiente).toBe(cicloActual);
          }
        }
      ),
      { numRuns: NUM_RUNS }
    );
  });

  // ---------------------------------------------------------------------------
  // Feature: gestion-ciclos-secciones, Property 6
  // Continuidad de montos y beneficios (Req 7.2, 7.3)
  // ---------------------------------------------------------------------------
  it("Property 6: cada cuota toma el monto_final del beneficio activo, o el default", () => {
    // Beneficio presente (valor 0..500) o ausente (undefined), independientes.
    const optionalAmount = fc.option(fc.integer({ min: 0, max: 500 }), {
      nil: undefined,
    });

    fc.assert(
      fc.property(
        optionalAmount,
        optionalAmount,
        // start_date arbitrario válido; no afecta los montos.
        fc.integer({ min: 1, max: 28 }),
        fc.integer({ min: 1, max: 12 }),
        fc.integer({ min: 2024, max: 2030 }),
        (matriculaBenefit, cuotaBenefit, day, month1, year) => {
          const benefits: BenefitConfig = {
            matricula: matriculaBenefit,
            cuota: cuotaBenefit,
          };
          const startDate = fmtDate(year, month1, day);
          const items = generarPlanModel(startDate, benefits);

          const expectedMatricula = matriculaBenefit ?? DEFAULT_MATRICULA;
          const expectedCuota = cuotaBenefit ?? DEFAULT_CUOTA;

          for (const item of items) {
            if (item.tipo === "matricula") {
              expect(item.amount).toBe(expectedMatricula);
            } else {
              expect(item.amount).toBe(expectedCuota);
            }
          }

          // Estructura: 1 matrícula (numero 0) + 4 cuotas (01..04).
          expect(items).toHaveLength(5);
          expect(items.filter((i) => i.tipo === "matricula")).toHaveLength(1);
          expect(items.filter((i) => i.tipo === "cuota").map((i) => i.numero)).toEqual([
            1, 2, 3, 4,
          ]);
        }
      ),
      { numRuns: NUM_RUNS }
    );
  });

  // ---------------------------------------------------------------------------
  // Feature: gestion-ciclos-secciones, Property 7
  // Fechas de vencimiento del plan de pagos (Req 7.4)
  // ---------------------------------------------------------------------------
  it("Property 7: matrícula y cuota 01 al día 01 del mes base; cuotas 02-04 en meses consecutivos; corte por día >= 16", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 28 }),
        fc.integer({ min: 1, max: 12 }), // incluye Nov (11) y Dic (12) para frontera de año
        fc.integer({ min: 2024, max: 2030 }),
        (day, month1, year) => {
          const startDate = fmtDate(year, month1, day);
          const items = generarPlanModel(startDate, {});

          // Mes base 0-indexed a partir de la fecha de inicio.
          let baseMonth0 = month1 - 1;
          let baseYear = year;
          // Corte de fin de mes: día >= 16 corre el primer pago al mes siguiente.
          if (day >= 16) {
            baseMonth0 += 1;
            if (baseMonth0 > 11) {
              baseMonth0 = 0;
              baseYear += 1;
            }
          }

          // Fecha esperada del mes base + offset (en meses), con rollover de año.
          const expectedDue = (offset: number): string => {
            const total = baseMonth0 + offset;
            const y = baseYear + Math.floor(total / 12);
            const m0 = total % 12;
            return fmtDate(y, m0 + 1, 1);
          };

          const matricula = items.find((i) => i.tipo === "matricula")!;
          const cuota01 = items.find((i) => i.tipo === "cuota" && i.numero === 1)!;
          const cuota02 = items.find((i) => i.tipo === "cuota" && i.numero === 2)!;
          const cuota03 = items.find((i) => i.tipo === "cuota" && i.numero === 3)!;
          const cuota04 = items.find((i) => i.tipo === "cuota" && i.numero === 4)!;

          // Matrícula y cuota 01 → día 01 del mes base.
          expect(matricula.due_date).toBe(expectedDue(0));
          expect(cuota01.due_date).toBe(expectedDue(0));

          // Cuotas 02-04 → meses consecutivos siguientes (día 01), con rollover.
          expect(cuota02.due_date).toBe(expectedDue(1));
          expect(cuota03.due_date).toBe(expectedDue(2));
          expect(cuota04.due_date).toBe(expectedDue(3));

          // Todas las fechas caen en el día 01.
          for (const item of items) {
            expect(item.due_date.endsWith("-01")).toBe(true);
          }
        }
      ),
      { numRuns: NUM_RUNS }
    );
  });

  // ---------------------------------------------------------------------------
  // Feature: gestion-ciclos-secciones, Property 8
  // Exoneración con monto cero (Req 7.5)
  // ---------------------------------------------------------------------------
  it("Property 8: monto 0 → status 'exonerado' con fecha_pago; monto > 0 → status 'pending' sin fecha_pago", () => {
    fc.assert(
      fc.property(
        fc.option(fc.integer({ min: 0, max: 500 }), { nil: undefined }),
        fc.option(fc.integer({ min: 0, max: 500 }), { nil: undefined }),
        fc.integer({ min: 1, max: 28 }),
        fc.integer({ min: 1, max: 12 }),
        fc.integer({ min: 2024, max: 2030 }),
        (matriculaBenefit, cuotaBenefit, day, month1, year) => {
          const startDate = fmtDate(year, month1, day);
          const ahora = "2025-01-15T12:00:00.000Z";
          const items = generarPlanModel(
            startDate,
            { matricula: matriculaBenefit, cuota: cuotaBenefit },
            ahora
          );

          for (const item of items) {
            if (item.amount === 0) {
              expect(item.status).toBe("exonerado");
              expect(item.fecha_pago).not.toBeNull();
              expect(item.fecha_pago).toBe(ahora);
            } else {
              expect(item.amount).toBeGreaterThan(0);
              expect(item.status).toBe("pending");
              expect(item.fecha_pago).toBeNull();
            }
          }
        }
      ),
      { numRuns: NUM_RUNS }
    );
  });
});
